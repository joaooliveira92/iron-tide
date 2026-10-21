import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { runT1Acceptance, type T1Observation } from "../src/t1-acceptance.js";

// T-1 10 (#119, spec #109 R16): acceptance of the player battle offer on the compiled PRODUCTION pack. Every number
// asserted for the ruleset is the owner-authorized ADR-0254 balance target (go-live ADR-0263); none is a fixture value.
const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "dist", "run-t1-acceptance-child.js");

function runChild(): T1Observation | { error: string } {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!) as T1Observation | { error: string };
}

describe("T-1 acceptance (ticket 10): battle offer flow on the production pack", () => {
  const obs = runT1Acceptance();

  it("reads exactly the ADR-0254 value set, labelled a balance target", () => {
    expect(obs.section).toEqual({
      estimateKind: "PERTURBED",
      errorBoundBp: 2000,
      showComposition: false,
      pointsByMission: { FLEET_BATTLE: 5, CRUISER_BATTLE: 2 },
      opponentCredit: "NONE",
      threshold: 3,
      scope: "WAR",
      reset: "ON_WAR_END",
      enemyThresholdBp: 5000,
      enemyProbabilityBp: 5000,
      supportChanceBp: 2000,
      supportShareOfCapBp: 5000,
      supportSource: "ALLIED_ONLY",
      prestigeRule: "PROPORTIONAL_LOSS",
      prestigeBasisPoints: 300,
      prestigeRepeat: "EACH_FURTHER_DECLINE",
      provenanceStatus: "BALANCE_TARGET",
      provenanceKind: "balance_adjustment",
    });
  });

  it("raises an offer with mission type, area, a strength-only perturbed estimate and no enemy identity", () => {
    expect(obs.offer.missionType).toBe("FLEET_BATTLE");
    expect(obs.offer.acceptanceClass).toBeTruthy();
    expect(obs.offer.areaId).toBe("eng_home_coast");
    expect(obs.offer.estimateModel).toBe("PERTURBED");
    expect(obs.offer.hasComposition).toBe(false);
    expect(obs.offer.estimateDraws).toBeGreaterThan(0);
    expect(obs.offer.leaksEnemyIdentity).toBe(false);
    expect(obs.offer.reExecutionIdentical).toBe(true);
  });

  it("accepts and delegates to the same resolved state with the same war score", () => {
    expect(obs.accept.outcome).toBe("completed");
    expect(obs.delegate.outcome).toBe("completed");
    expect(obs.delegate.sameAsAccept).toBe(true);
    expect(obs.delegate.scores).toEqual(obs.accept.scores);
  });

  it("declines at 5 war-score points to the decliner only, with one terminal record and no resolved battle", () => {
    expect(obs.decline.outcome).toBe("completed");
    expect(obs.decline.scores).toEqual([[-5, 0]]);
    expect(obs.decline.declinedRecords).toBe(1);
    expect(obs.decline.declinedEvents).toBe(1);
    expect(obs.decline.battlesResolved).toBe(0);
  });

  it("refuses to decline an operationally unavoidable battle, leaving it pending and unscored", () => {
    expect(obs.unavoidable.outcome).toBe("suspended");
    expect(obs.unavoidable.refusalTag).toBe("BATTLE_DECLINE_NOT_ALLOWED");
    expect(obs.unavoidable.scores).toEqual([[0, 0]]);
    expect(obs.unavoidable.declinedRecords).toBe(0);
  });

  it("lets an outmatched enemy withdraw on one recorded draw, never drawing for an even match", () => {
    const e = obs.enemyDecline;
    expect(e.withdrewOutcome).toBe("completed");
    expect(e.withdrewEvents).toBe(1);
    expect(e.withdrewDraws).toBe(1);
    expect(e.withdrewBattles).toBe(0);
    expect(e.withdrewScores).toEqual([[0, 0]]);
    expect(e.proceedsOffer).toBe(true);
    expect(e.proceedsEvents).toBe(0);
    expect(e.evenMatchDraws).toBe(0);
  });

  it("joins a friendly allied support force on its recorded draw, disclosing nations only", () => {
    expect(obs.support.presentFlag).toBe(true);
    expect(obs.support.presentNations).toEqual(["italy"]);
    expect(obs.support.absentFlag).toBe(false);
    expect(obs.support.presentDraws).toBe(1);
    expect(obs.support.noAllyDraws).toBe(0);
  });

  it("raises the threshold event at the third decline and costs 3 percent of prestige at and after it", () => {
    const t = obs.threshold;
    expect(t.counts).toEqual([1, 2, 3, 4]);
    expect(t.thresholdEvents).toEqual([0, 0, 1, 1]);
    expect(t.prestigeEvents).toEqual([0, 0, 1, 1]);
    const loss = (p: number) => Math.max(1, Math.ceil((p * 300) / 10_000));
    expect(t.prestigeAfter[0]).toBe(t.prestigeStart);
    expect(t.prestigeAfter[1]).toBe(t.prestigeStart);
    expect(t.prestigeAfter[2]).toBe(t.prestigeStart - loss(t.prestigeStart));
    expect(t.prestigeAfter[3]).toBe(t.prestigeAfter[2]! - loss(t.prestigeAfter[2]!));
  });

  it("leaves peacetime months byte-identical with the section configured", () => {
    expect(obs.peacetime.identicalWithAndWithoutSection).toBe(true);
  });

  it("is byte-identical across the in-process run and two clean processes", () => {
    const a = runChild();
    const b = runChild();
    expect("error" in a ? a.error : undefined).toBeUndefined();
    expect(b).toEqual(a);
    expect(a).toEqual(obs);
  });
});
