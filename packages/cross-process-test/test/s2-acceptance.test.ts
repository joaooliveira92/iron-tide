import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { runS2Acceptance, type S2Observation } from "../src/s2-acceptance.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "dist", "run-s2-acceptance-child.js");

function runChild(): S2Observation | { error: string } {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!) as S2Observation | { error: string };
}

describe("S-2 acceptance (ticket 09): prestige and career on the production pack", () => {
  const obs = runS2Acceptance();

  it("seeds every nation inside the authorized bounds from the authored 1880 pack", () => {
    expect(obs.everyNationSeeded).toBe(true);
    expect(obs.playerStartPrestige).toBe(20);
  });

  it("observes UNPAID_FUNDS from a real compiled month", () => {
    expect(obs.unpaidFunds.events).toEqual([
      expect.objectContaining({
        reasonCode: "UNPAID_FUNDS",
        nationId: "uk",
        ruleKind: "PROPORTIONAL_LOSS",
      }),
    ]);
    expect(obs.unpaidFunds.prestige).toBeLessThan(obs.playerStartPrestige);
  });

  it("observes BATTLE_LOST and BATTLE_WON from real resolved battles, within bounds", () => {
    expect(obs.battleLost.events).toEqual([
      expect.objectContaining({ reasonCode: "BATTLE_LOST", nationId: "uk" }),
    ]);
    expect(obs.battleLost.prestige).toBeLessThan(obs.playerStartPrestige);
    expect(obs.battleWon.events).toEqual([
      expect.objectContaining({ reasonCode: "BATTLE_WON", nationId: "uk", ruleKind: "FIXED_GAIN" }),
    ]);
    expect(obs.battleWon.prestige).toBeGreaterThan(obs.playerStartPrestige);
  });

  it("sacks a player at the threshold on a recorded draw and refuses further months", () => {
    expect(obs.sacked.sackingDraws).toBe(1);
    expect(obs.sacked.careerResult).toMatchObject({ nationId: "uk", reason: "SACKED" });
    expect(obs.retained.sackingDraws).toBe(1);
    expect(obs.retained.careerResult).toBeNull();
  });

  it("ends a surviving career at the final month with the prestige held as the score", () => {
    expect(obs.campaignEnd.careerResult).toMatchObject({
      nationId: "uk",
      reason: "CAMPAIGN_END",
      score: obs.campaignEnd.prestige,
      month: { year: 1970, month: 12 },
    });
    expect(obs.repeatedAdvanceOutcome).toBe("career_ended");
  });

  it("is byte-identical across the in-process run and two clean processes", () => {
    const a = runChild();
    const b = runChild();
    expect("error" in a).toBe(false);
    expect(a).toEqual(b);
    expect(a).toEqual(JSON.parse(JSON.stringify(obs)));
  });
});
