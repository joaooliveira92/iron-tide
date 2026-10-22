import { describe, it, expect } from "vite-plus/test";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import {
  compileDesign,
  runTrials,
  trialsStreamId,
  classifyRevision,
  changeKindOf,
  checkRevisionBalance,
  inPlaceRevisionFindings,
  type BuildProgress,
  type RevisionBalance,
  type RevisionFacts,
  type TrialsBalance,
  type TrialsInput,
} from "../src/index.js";
import { ctx, draft, plant } from "./fixtures/gunboat.js";

const compiled = compileDesign(draft, ctx);
const tb: TrialsBalance = {
  baseSpeedShortfallBp: 200,
  unreliabilityToShortfallBp: 4_000,
  overweightToShortfallBp: 5_000,
  firstOfClassShortfallBp: 300,
  acceptToleranceBp: 100,
  deficiencyToleranceBp: 500,
  baseDefectChanceBp: 500,
  unreliabilityToDefectChanceBp: 4_000,
  firstOfClassDefectChanceBp: 1_500,
  severityCumulativeBp: [6_000, 9_000],
};
const input = (o: Partial<TrialsInput> = {}): TrialsInput => ({
  projectId: "con_1",
  rulesetVersion: "1.0.0",
  plantReliabilityBp: plant.reliabilityBp,
  requiredSpeedMilliKnots: 20_000,
  firstOfClass: true,
  targetDisplacementKg: 705_000,
  ...o,
});
const run = (seed: string, o: Partial<TrialsInput> = {}, balance = tb) => {
  const ledger = new RandomLedger();
  const stream = new RandomEngine(seed).stream(trialsStreamId("con_1"));
  return { r: runTrials(compiled, input(o), balance, stream, ledger), ledger };
};

describe("runTrials", () => {
  it("same seed gives identical results and ledger; different seeds vary", () => {
    const a = run("seed-1");
    const b = run("seed-1");
    expect(b.r).toEqual(a.r);
    expect(b.ledger.hash()).toBe(a.ledger.hash());
    const outcomes = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(run(`s${i}`).r)));
    expect(outcomes.size).toBeGreaterThan(5);
  });
  it("logs every draw with stream, entity, phase, input hash", () => {
    const { ledger } = run("seed-2");
    expect(ledger.all.length).toBeGreaterThanOrEqual(2);
    for (const d of ledger.all) {
      expect(d.streamId).toBe("shipbuilding.trials:con_1");
      expect(d.entityKey).toBe("con_1");
      expect(d.phase).toBe("TRIALS");
      expect(d.inputHash).toBe(compiled.hash);
      expect(d.reasonCode).toMatch(/^TRIAL_/);
    }
  });
  it("achieved speed never exceeds design speed and the shortfall stays inside its ceiling", () => {
    for (let i = 0; i < 60; i++) {
      const { r } = run(`x${i}`);
      expect(r.achievedSpeedMilliKnots).toBeLessThanOrEqual(compiled.machinery!.maxSpeedMilliKnots);
      expect(r.speedShortfallBp).toBeGreaterThanOrEqual(0);
      expect(r.speedShortfallBp).toBeLessThanOrEqual(10_000);
    }
  });
  it("a perfect-reliability, no-defect-chance, no-shortfall configuration always accepts", () => {
    const clean: TrialsBalance = {
      ...tb,
      baseSpeedShortfallBp: 0,
      unreliabilityToShortfallBp: 0,
      overweightToShortfallBp: 0,
      firstOfClassShortfallBp: 0,
      baseDefectChanceBp: 0,
      unreliabilityToDefectChanceBp: 0,
      firstOfClassDefectChanceBp: 0,
    };
    for (let i = 0; i < 30; i++) {
      const { r } = run(
        `c${i}`,
        { plantReliabilityBp: 10_000, firstOfClass: false, requiredSpeedMilliKnots: 10_000 },
        clean,
      );
      expect(r.outcome).toBe("ACCEPTED");
      expect(r.defects).toEqual([]);
    }
  });
  it("a certain critical defect forces rework; unreliable first-of-class ships fail more often", () => {
    const doom: TrialsBalance = { ...tb, baseDefectChanceBp: 10_000, severityCumulativeBp: [0, 0] };
    const { r } = run("d", {}, doom);
    expect(r.outcome).toBe("REJECTED_REWORK");
    expect(r.reasonCodes).toContain("TRIAL_CRITICAL_DEFECT");
    const rate = (o: Partial<TrialsInput>) =>
      Array.from({ length: 200 }, (_, i) => run(`r${i}`, o).r.outcome).filter(
        (x) => x !== "ACCEPTED",
      ).length;
    expect(rate({ plantReliabilityBp: 6_000, firstOfClass: true })).toBeGreaterThan(
      rate({ plantReliabilityBp: 10_000, firstOfClass: false }),
    );
  });
  it("speed far below the requirement is rejected", () => {
    expect(run("f", { requiredSpeedMilliKnots: 40_000 }).r.reasonCodes).toContain(
      "TRIAL_SPEED_FAILED",
    );
  });
  it("does not influence validation: compileDesign is unchanged by trials", () => {
    const before = compileDesign(draft, ctx).hash;
    run("seed-3");
    expect(compileDesign(draft, ctx).hash).toBe(before);
  });
});

const rb: RevisionBalance = {
  freeBelowBp: 500,
  revisionBelowBp: 2_500,
  redesignBelowBp: 5_000,
  reworkBp: 3_000,
  t1DelayMonths: 1,
  redesignStudyCostBp: 6_000,
  redesignKeptBp: 5_000,
  t2DelayMonths: 4,
  inPlace: {
    displacementIncreaseBp: 1_000,
    displacementMinAllowanceKg: 1_000_000,
    speedChangeMilliKnots: 1_000,
    verticalArmourChangeUm: 25_400,
    horizontalArmourChangeUm: 12_700,
    mainGunMaxUm: 152_400,
  },
};
const prog = (hullBp: number, o: Partial<BuildProgress> = {}): BuildProgress => ({
  hullDoneWork: hullBp * 100,
  hullTotalWork: 1_000_000,
  armourStarted: false,
  machineryStarted: false,
  launched: false,
  affectedDoneWork: 200_000,
  ...o,
});

describe("classifyRevision", () => {
  it("early fittings changes are free", () => {
    const d = classifyRevision(["FITTINGS"], prog(100), rb);
    expect(d).toMatchObject({
      tier: "T0_FREE",
      reworkWorkMicro: 0,
      delayMonths: 0,
      hullDoneWorkAfter: 10_000,
    });
  });
  it("mid-build fittings changes cost rework and a delay (T1)", () => {
    const d = classifyRevision(["FITTINGS"], prog(1_500), rb);
    expect(d.tier).toBe("T1_REVISION");
    expect(d.reworkWorkMicro).toBe(60_000);
    expect(d.delayMonths).toBe(1);
    expect(d.requiresRebuildProject).toBe(false);
  });
  it("hull geometry, engines, main guns or armour escalate to redesign and discard hull progress", () => {
    for (const k of ["STRUCTURE", "MACHINERY", "MAIN_ARMAMENT", "ARMOUR"] as const) {
      const d = classifyRevision([k], prog(1_500), rb);
      expect(d.tier, k).toBe("T2_REDESIGN");
      expect(d.hullDoneWorkAfter).toBe(75_000);
      expect(d.studyCostMultiplierBp).toBe(6_000);
      expect(d.delayMonths).toBe(4);
    }
    expect(classifyRevision(["STRUCTURE"], prog(100), rb).tier).toBe("T0_FREE");
    expect(classifyRevision(["STRUCTURE"], prog(500), rb).tier).toBe("T2_REDESIGN");
  });
  it("ordered armour/machinery makes an early change a revision, not free", () => {
    expect(classifyRevision(["ARMOUR"], prog(100, { armourStarted: true }), rb).tier).toBe(
      "T1_REVISION",
    );
    expect(classifyRevision(["MACHINERY"], prog(100, { machineryStarted: true }), rb).tier).toBe(
      "T1_REVISION",
    );
  });
  it("late changes and anything after launch become reconstruction (rebuild project)", () => {
    expect(classifyRevision(["FITTINGS"], prog(6_000), rb)).toMatchObject({
      tier: "T3_RECONSTRUCTION",
      requiresRebuildProject: true,
    });
    const l = classifyRevision(["FITTINGS"], prog(100, { launched: true }), rb);
    expect(l.tier).toBe("T3_RECONSTRUCTION");
    expect(l.reasonCodes).toContain("REVISION_AFTER_LAUNCH");
  });
  it("tier never decreases as progress grows, and progress after the change is never negative", () => {
    const rank = ["T0_FREE", "T1_REVISION", "T2_REDESIGN", "T3_RECONSTRUCTION"];
    let last = 0;
    for (let bp = 0; bp <= 10_000; bp += 250) {
      const d = classifyRevision(["FITTINGS"], prog(bp), rb);
      expect(rank.indexOf(d.tier)).toBeGreaterThanOrEqual(last);
      last = rank.indexOf(d.tier);
      expect(d.hullDoneWorkAfter).toBeGreaterThanOrEqual(0);
    }
    expect(classifyRevision(["FITTINGS"], { ...prog(0), hullTotalWork: 0 }, rb).tier).toBe(
      "T3_RECONSTRUCTION",
    );
  });
});

describe("changeKindOf", () => {
  const cat = (id: string) =>
    id === "gun" ? ("MAIN_GUN" as const) : id === "rf" ? ("RANGEFINDER" as const) : undefined;
  it("classifies edits", () => {
    expect(changeKindOf({ kind: "set_hull", patch: { beam: 1 as never } }, cat)).toBe("STRUCTURE");
    expect(changeKindOf({ kind: "set_hull", patch: { designMarginBp: 1 as never } }, cat)).toBe(
      "FITTINGS",
    );
    expect(changeKindOf({ kind: "set_machinery", patch: { installedKw: 1 } }, cat)).toBe(
      "MACHINERY",
    );
    expect(changeKindOf({ kind: "set_machinery", patch: { fuelCapacityKg: 1 } }, cat)).toBe(
      "FITTINGS",
    );
    expect(
      changeKindOf(
        { kind: "move_placement", instanceId: "gun", zoneId: "FORECASTLE", stationPermille: 1 },
        cat,
      ),
    ).toBe("MAIN_ARMAMENT");
    expect(changeKindOf({ kind: "remove_placement", instanceId: "rf" }, cat)).toBe("FITTINGS");
    expect(changeKindOf({ kind: "remove_armour_region", region: "BELT_MAIN" }, cat)).toBe("ARMOUR");
  });
  it("a change to the brief is not a build change", () => {
    expect(changeKindOf({ kind: "set_requirement", patch: { category: "CL" } }, cat)).toBeNull();
  });
});

describe("checkRevisionBalance", () => {
  const good: RevisionBalance = {
    freeBelowBp: 500,
    revisionBelowBp: 2_500,
    redesignBelowBp: 5_000,
    reworkBp: 3_000,
    t1DelayMonths: 1,
    redesignStudyCostBp: 6_000,
    redesignKeptBp: 5_000,
    t2DelayMonths: 4,
    inPlace: rb.inPlace,
  };
  it("accepts the shipped values", () => {
    expect(checkRevisionBalance(good)).toEqual([]);
  });
  it.each([
    ["a threshold above 100 %", { redesignBelowBp: 12_000 }, /redesignBelowBp/],
    ["thresholds out of order", { revisionBelowBp: 400 }, /ascend/],
    ["fractional basis points", { reworkBp: 10.5 }, /reworkBp/],
    ["a revision with no delay (spec: at least a month)", { t1DelayMonths: 0 }, /t1DelayMonths/],
    [
      "a redesign that delays less than a revision",
      { t1DelayMonths: 6, t2DelayMonths: 2 },
      /delay less/,
    ],
    [
      "a redesign that loses less work than a revision adds",
      { reworkBp: 7_000, redesignKeptBp: 5_000 },
      /lose less/,
    ],
    ["a negative study cost", { redesignStudyCostBp: -1 }, /redesignStudyCostBp/],
  ])("rejects %s", (_name, patch, message) => {
    const problems = checkRevisionBalance({ ...good, ...patch });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(" ")).toMatch(message);
  });
  it("reports every problem at once", () => {
    expect(
      checkRevisionBalance({ ...good, reworkBp: -1, t2DelayMonths: 0 }).length,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe("in-place design-revision limits (manual p27, ADR-0132)", () => {
  const limits = rb.inPlace;
  const facts = (o: Partial<RevisionFacts> = {}): RevisionFacts => ({
    displacementKg: 10_000_000,
    speedMilliKnots: 16_000,
    verticalArmourUm: 0,
    horizontalArmourUm: 0,
    maxMainGunUm: 0,
    maxSecondaryGunUm: 0,
    ...o,
  });
  const ids = (f: RevisionFacts, t: RevisionFacts) =>
    inPlaceRevisionFindings(f, t, limits).map((x) => x.id);

  it("allows displacement up to 10 % (or 1000 t, whichever is larger)", () => {
    expect(ids(facts(), facts({ displacementKg: 11_000_000 }))).toEqual([]);
    expect(ids(facts(), facts({ displacementKg: 11_000_001 }))).toContain(
      "REVISION_DISPLACEMENT_EXCEEDED",
    );
    expect(ids(facts({ displacementKg: 2_000_000 }), facts({ displacementKg: 3_000_000 }))).toEqual(
      [],
    );
  });

  it("allows speed within ±1 kn", () => {
    expect(ids(facts(), facts({ speedMilliKnots: 17_000 }))).toEqual([]);
    expect(ids(facts(), facts({ speedMilliKnots: 15_000 }))).toEqual([]);
    expect(ids(facts(), facts({ speedMilliKnots: 17_001 }))).toContain("REVISION_SPEED_EXCEEDED");
    expect(ids(facts(), facts({ speedMilliKnots: 14_999 }))).toContain("REVISION_SPEED_EXCEEDED");
  });

  it("allows vertical armour within ±1 in and horizontal within ±0.5 in", () => {
    expect(ids(facts(), facts({ verticalArmourUm: 25_400 }))).toEqual([]);
    expect(ids(facts(), facts({ verticalArmourUm: 25_401 }))).toContain(
      "REVISION_VERTICAL_ARMOUR_EXCEEDED",
    );
    expect(ids(facts(), facts({ horizontalArmourUm: 12_700 }))).toEqual([]);
    expect(ids(facts(), facts({ horizontalArmourUm: 12_701 }))).toContain(
      "REVISION_HORIZONTAL_ARMOUR_EXCEEDED",
    );
  });

  it("does not change main guns above 6 in", () => {
    const twelve = facts({ maxMainGunUm: 12 * 25_400 });
    expect(ids(twelve, { ...twelve })).toEqual([]);
    expect(ids(twelve, { ...twelve, maxMainGunUm: 11 * 25_400 })).toContain(
      "REVISION_MAIN_GUN_UNCHANGEABLE",
    );
    const six = facts({ maxMainGunUm: 6 * 25_400 });
    expect(ids(six, { ...six, maxMainGunUm: 5 * 25_400 })).toEqual([]);
  });

  it("does not change secondary guns above 6 in", () => {
    const eight = facts({ maxSecondaryGunUm: 8 * 25_400 });
    expect(ids(eight, { ...eight })).toEqual([]);
    expect(ids(eight, { ...eight, maxSecondaryGunUm: 7 * 25_400 })).toContain(
      "REVISION_SECONDARY_GUN_LIMIT",
    );
  });
});
