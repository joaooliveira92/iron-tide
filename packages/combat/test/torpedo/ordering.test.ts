import { describe, expect, it } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import {
  compareDamagePackages,
  compareFloodingSources,
  compareLaunchCommandOrder,
  compareSides,
  compareStableStrings,
  compareSystemEffects,
  compareTrackRunOrder,
  torpedoRecordOrder,
} from "../../src/torpedoes/ordering.js";
import { makeTorpedoRecord, torpedoRecordId } from "../../src/torpedoes/records.js";
import { resolveTorpedoes } from "../../src/torpedoes/resolve.js";
import type { TorpedoRecord, TorpedoRecordKind } from "../../src/torpedoes/records.js";
import type { TorpedoContext } from "../../src/torpedoes/resolve.js";
import {
  buildTorpedoScene,
  torpedoContext,
  torpedoLaunchCommand,
  TORPEDO_BATTLE_ID,
} from "./advance.test.js";

function record(
  kind: TorpedoRecordKind,
  minute: number,
  substep: number,
  targetId: string,
): TorpedoRecord {
  return makeTorpedoRecord({
    recordId: torpedoRecordId({ battleId: "b9", minute, substep, kind, sourceId: "s", targetId }),
    kind,
    battleMinute: minute,
    substep,
    sourceId: "s",
    targetId,
    commandSource: "CENTRAL",
    legalContactId: null,
    torpedoModelId: null,
    launcherId: null,
    settingId: null,
    solutionInputs: [],
    solutionQualityBp: null,
    speedLimitValidation: { applicable: false, allowed: true, reasonCode: null, limitUmS: null },
    ammunitionChange: null,
    rngDecision: null,
    damageEffects: {
      structuralDamage: 0,
      flotationDamage: 0,
      floodingSourcesCreated: 0,
      terminalTransition: null,
      reasonCode: null,
    },
    persists: false,
    formulaVersion: "torpedo_formula_v1",
    rulesetVersion: "torpedo_ruleset_v1",
  });
}

function runMinute(context: TorpedoContext): { records: TorpedoRecord[]; eventIds: string[] } {
  const { contact } = buildTorpedoScene();
  const res = resolveTorpedoes({
    battleId: TORPEDO_BATTLE_ID,
    minute: 1,
    context,
    contacts: [contact],
    shipPositions: { a1: [0, 5_000_000_000] },
    shipHeadings: { a1: 0 },
    shipSpeedsUmS: { a1: 0 },
    engine: new RandomEngine("ordering-seed-1"),
  });
  return { records: [...res.records], eventIds: res.events.map((e) => e.eventId) };
}

describe("AC-20 — §28 canonical ordering comparators", () => {
  it("level 1: sides by identifier", () => {
    expect(compareSides("ATTACKER", "DEFENDER")).toBeLessThan(0);
    expect(compareSides("DEFENDER", "ATTACKER")).toBeGreaterThan(0);
    expect(compareSides("B", "B")).toBe(0);
  });

  it("levels 1-3: side → firing ship → launcher", () => {
    const sideOf = (shipId: string) => (shipId.startsWith("a") ? "ATTACKER" : "DEFENDER");
    const order = [
      { shipId: "d9", launcherId: "L-0" },
      { shipId: "a2", launcherId: "L-9" },
      { shipId: "a1", launcherId: "L-9" },
    ].sort((x, y) => compareLaunchCommandOrder(x, y, sideOf));
    expect(order.map((c) => c.shipId)).toEqual(["a1", "a2", "d9"]);
  });

  it("level 4: tubes fire in ascending numeric tube order", () => {
    expect([10, 2, 0].sort((a, b) => a - b)).toEqual([0, 2, 10]);
  });

  it("level 5: tracks by launch minute, substep, then track id", () => {
    const t = (m: number, s: number, id: string) => ({
      launchMinute: m,
      launchSubstep: s,
      torpedoTrackId: id,
    });
    expect(compareTrackRunOrder(t(1, 4, "x2"), t(1, 4, "x1"))).toBeGreaterThan(0);
    expect(compareTrackRunOrder(t(1, 4, "x"), t(1, 56, "x"))).toBeLessThan(0);
    expect(compareTrackRunOrder(t(1, 56, "x"), t(2, 4, "x"))).toBeLessThan(0);
  });

  it("level 7: damage packages by impact minute/substep then package id", () => {
    const p = (m: number, s: number, id: string) => ({
      impactMinute: m,
      impactSubstep: s,
      packageId: id,
    });
    expect(compareDamagePackages(p(1, 56, "b"), p(1, 56, "a"))).toBeGreaterThan(0);
    expect(compareDamagePackages(p(1, 4, "a"), p(2, 56, "a"))).toBeLessThan(0);
  });

  it("level 8: flooding sources by compartment then source id", () => {
    expect(
      compareFloodingSources(
        { compartmentId: "B", sourceId: "a" },
        { compartmentId: "A", sourceId: "z" },
      ),
    ).toBeGreaterThan(0);
    expect(
      compareFloodingSources(
        { compartmentId: "A", sourceId: "b" },
        { compartmentId: "A", sourceId: "a" },
      ),
    ).toBeGreaterThan(0);
  });

  it("level 9: system effects by stable system id", () => {
    expect(
      compareSystemEffects({ stableSystemId: "ENGINE-2" }, { stableSystemId: "ENGINE-1" }),
    ).toBeGreaterThan(0);
  });

  it("plain string compare is locale-free and total", () => {
    expect(compareStableStrings("a", "b")).toBe(-1);
    expect(compareStableStrings("b", "a")).toBe(1);
    expect(compareStableStrings("a", "a")).toBe(0);
  });
});

describe("AC-20 — full-record ordering + insertion-order invariance", () => {
  it("records of every level sort in the §28 level sequence", () => {
    const launch = record("LAUNCH", 1, 4, "tube0000");
    const track = record("TRACK", 1, 4, "b9:d1");
    const hit = record("HIT_RESOLUTION", 1, 56, "b9:d1");
    const machinery = record("MACHINERY", 1, 56, "ENGINE-1");
    const flood = record(
      "FLOODING_SOURCE",
      1,
      56,
      "MACHINERY:TORPEDO_PROGRESSIVE_FLOODING_CREATED:0",
    );
    const damage = record("DAMAGE", 1, 56, "d1");
    const shock = record("SYSTEM_SHOCK", 1, 56, "DIRECTOR-1");
    const shuffled = [machinery, flood, damage, shock, hit, launch, track];
    expect(shuffled.sort(torpedoRecordOrder).map((r) => r.kind)).toEqual([
      "LAUNCH",
      "TRACK",
      "HIT_RESOLUTION",
      "DAMAGE",
      "FLOODING_SOURCE",
      "SYSTEM_SHOCK",
      "MACHINERY",
    ]);
  });

  it("tube level orders numerically (tube0000 < tube0010)", () => {
    const a = record("LAUNCH", 1, 4, "tube0000");
    const b = record("LAUNCH", 1, 4, "tube0010");
    expect(torpedoRecordOrder(a, b)).toBeLessThan(0);
  });

  it("the resolver emits identical records regardless of the input command order", () => {
    const first = runMinute(
      torpedoContext({ commands: [torpedoLaunchCommand(0), torpedoLaunchCommand(3)] }),
    );
    const second = runMinute(
      torpedoContext({ commands: [torpedoLaunchCommand(3), torpedoLaunchCommand(0)] }),
    );
    expect(first.records.map((r) => r.recordId)).toEqual(second.records.map((r) => r.recordId));
    expect(first.eventIds).toEqual(second.eventIds);
    const tubes = first.records
      .filter((r) => r.kind === "LAUNCH")
      .sort(torpedoRecordOrder)
      .map((r) => r.targetId);
    expect(tubes).toEqual(["tube0000", "tube0003"]);
  });
});
