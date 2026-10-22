import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  evaluateTorpedoMachineryDamage,
  machinerySelectionWeightsBp,
  machinerySeverityToComponentOutcome,
  selectMachinerySeverity,
  torpedoMachineryStreamId,
  TORPEDO_MACHINERY_DAMAGE_CREATED,
  TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP,
} from "../../src/torpedoes/index.js";

const TRACK_ID = "B1:6:4:torpedo:LCH-1:tube0";

function evaluate(o: { zone?: "MACHINERY" | "CENTRAL"; draw?: number; battleId?: string } = {}) {
  return evaluateTorpedoMachineryDamage({
    battleId: o.battleId ?? "B1",
    impactMinute: 6,
    impactSubstep: 4,
    torpedoTrackId: TRACK_ID,
    zone: o.zone ?? "MACHINERY",
    machineryComponents: ["ENGINE-1", "SHAFT-1", "BOILER-1"],
    keyedRng: () => o.draw ?? 0.8,
  });
}

describe("AC-17 §19: the shipped severity weights total exactly 10_000", () => {
  it("ships the exact five weights summing to 10_000", () => {
    expect(TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP).toEqual({
      NO_EFFECT: 1_000,
      DEGRADED_PROPULSION: 4_000,
      MAJOR_PROPULSION_LOSS: 3_000,
      DEAD_IN_WATER: 1_500,
      CATASTROPHIC_MACHINERY_LOSS: 500,
    });
    const total = Object.values(TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP).reduce((a, b) => a + b, 0);
    expect(total).toBe(10_000);
  });

  it("machinery-space selection uses the weights verbatim (total 10_000)", () => {
    const w = machinerySelectionWeightsBp(true);
    expect(w).toEqual(TORPEDO_MACHINERY_SEVERITY_WEIGHTS_BP);
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it("non-machinery selection scales every effect by the 2_500 bp reduced eligibility", () => {
    const w = machinerySelectionWeightsBp(false);
    expect(w.DEGRADED_PROPULSION).toBe(Math.floor((4_000 * 2_500) / 10_000));
    expect(w.MAJOR_PROPULSION_LOSS).toBe(Math.floor((3_000 * 2_500) / 10_000));
    expect(w.DEAD_IN_WATER).toBe(Math.floor((1_500 * 2_500) / 10_000));
    expect(w.CATASTROPHIC_MACHINERY_LOSS).toBe(Math.floor((500 * 2_500) / 10_000));
    expect(w.NO_EFFECT).toBe(10_000 - (1_000 + 750 + 375 + 125));
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(10_000);
  });
});

describe("AC-17 §19: deterministic cumulative selection", () => {
  const weights = machinerySelectionWeightsBp(true);
  it("maps every drawBp region onto its severity bucket (boundaries exact)", () => {
    expect(selectMachinerySeverity(weights, 0)).toBe("NO_EFFECT");
    expect(selectMachinerySeverity(weights, 999)).toBe("NO_EFFECT");
    expect(selectMachinerySeverity(weights, 1_000)).toBe("DEGRADED_PROPULSION");
    expect(selectMachinerySeverity(weights, 4_999)).toBe("DEGRADED_PROPULSION");
    expect(selectMachinerySeverity(weights, 5_000)).toBe("MAJOR_PROPULSION_LOSS");
    expect(selectMachinerySeverity(weights, 7_999)).toBe("MAJOR_PROPULSION_LOSS");
    expect(selectMachinerySeverity(weights, 8_000)).toBe("DEAD_IN_WATER");
    expect(selectMachinerySeverity(weights, 9_499)).toBe("DEAD_IN_WATER");
    expect(selectMachinerySeverity(weights, 9_500)).toBe("CATASTROPHIC_MACHINERY_LOSS");
    expect(selectMachinerySeverity(weights, 9_999)).toBe("CATASTROPHIC_MACHINERY_LOSS");
  });

  it("rejects out-of-range draws (fail closed)", () => {
    expect(() => selectMachinerySeverity(weights, 10_000)).toThrow(BluewaveError);
    expect(() => selectMachinerySeverity(weights, -1)).toThrow(BluewaveError);
    expect(() => selectMachinerySeverity(weights, 0.5)).toThrow(BluewaveError);
  });
});

describe("AC-17 §19: severity -> ComponentOutcome mapping (seam vocabulary)", () => {
  it("writes the pinned B-4 outcomes", () => {
    expect(machinerySeverityToComponentOutcome("NO_EFFECT")).toBe("UNAFFECTED");
    expect(machinerySeverityToComponentOutcome("DEGRADED_PROPULSION")).toBe("DEGRADED");
    expect(machinerySeverityToComponentOutcome("MAJOR_PROPULSION_LOSS")).toBe("DISABLED");
    expect(machinerySeverityToComponentOutcome("DEAD_IN_WATER")).toBe("DISABLED");
    expect(machinerySeverityToComponentOutcome("CATASTROPHIC_MACHINERY_LOSS")).toBe("DESTROYED");
    expect(() => machinerySeverityToComponentOutcome("BOGUS" as never)).toThrow(BluewaveError);
  });
});

describe("AC-17 §19: the keyed weighted evaluation", () => {
  it("draw 0.8 (drawBp 8_000) on a machinery space selects DEAD_IN_WATER + the code", () => {
    const r = evaluate({ draw: 0.8 });
    expect(r.severity).toBe("DEAD_IN_WATER");
    expect(r.componentEffects).toEqual([
      { componentId: "ENGINE-1", outcome: "DISABLED" },
      { componentId: "SHAFT-1", outcome: "DISABLED" },
      { componentId: "BOILER-1", outcome: "DISABLED" },
    ]);
    expect(r.reasonCode).toBe(TORPEDO_MACHINERY_DAMAGE_CREATED);
    expect(r.decision.streamId).toBe(`battle/torpedo/damage/machinery:B1:6:4:${TRACK_ID}`);
    expect(r.decision.drawBp).toBe(8_000);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("a draw in the NO_EFFECT bucket records no machinery damage (no code)", () => {
    const r = evaluate({ draw: 0.0 });
    expect(r.severity).toBe("NO_EFFECT");
    expect(r.componentEffects).toEqual([
      { componentId: "ENGINE-1", outcome: "UNAFFECTED" },
      { componentId: "SHAFT-1", outcome: "UNAFFECTED" },
      { componentId: "BOILER-1", outcome: "UNAFFECTED" },
    ]);
    expect(r.reasonCode).toBeNull();
  });

  it("consumes EXACTLY ONE keyed draw (draw layout stable)", () => {
    let calls = 0;
    const r = evaluateTorpedoMachineryDamage({
      battleId: "B1",
      impactMinute: 6,
      impactSubstep: 4,
      torpedoTrackId: TRACK_ID,
      zone: "MACHINERY",
      machineryComponents: ["ENGINE-1"],
      keyedRng: () => {
        calls += 1;
        return 0.5;
      },
    });
    expect(r.severity).toBe("MAJOR_PROPULSION_LOSS");
    expect(calls).toBe(1);
  });

  it("a non-machinery zone runs the reduced 2_500-bp surface", () => {
    const reduced = machinerySelectionWeightsBp(false);
    expect(selectMachinerySeverity(reduced, 800)).toBe("NO_EFFECT");
    expect(selectMachinerySeverity(reduced, 7_800)).toBe("DEGRADED_PROPULSION");
    expect(evaluate({ zone: "CENTRAL", draw: 0.78 }).severity).toBe("DEGRADED_PROPULSION");
    expect(evaluate({ zone: "MACHINERY", draw: 0.78 }).severity).toBe("MAJOR_PROPULSION_LOSS");
  });

  it("rejects malformed inputs (unknown zone, bad rng)", () => {
    expect(() =>
      evaluateTorpedoMachineryDamage({
        battleId: "B1",
        impactMinute: 6,
        impactSubstep: 4,
        torpedoTrackId: TRACK_ID,
        zone: "BOGUS" as never,
        machineryComponents: ["E1"],
        keyedRng: () => 0.5,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      evaluateTorpedoMachineryDamage({
        battleId: "B1",
        impactMinute: 6,
        impactSubstep: 4,
        torpedoTrackId: TRACK_ID,
        zone: "MACHINERY",
        machineryComponents: ["E1"],
        keyedRng: "nope" as never,
      }),
    ).toThrow(BluewaveError);
  });

  it("determinism: same inputs + same keyed draw -> identical frozen result", () => {
    const a = evaluate({ draw: 0.12345, battleId: "B9" });
    const b = evaluate({ draw: 0.12345, battleId: "B9" });
    expect(a).toEqual(b);
    expect(Object.isFrozen(a.decision)).toBe(true);
    expect(evaluate({ draw: 0.05 }).severity).toBe("NO_EFFECT");
    expect(evaluate({ draw: 0.99 }).severity).toBe("CATASTROPHIC_MACHINERY_LOSS");
  });

  it("ships the deterministic stream-id builder", () => {
    expect(
      torpedoMachineryStreamId({
        battleId: "B1",
        impactMinute: 2,
        impactSubstep: 3,
        torpedoTrackId: "T",
      }),
    ).toBe("battle/torpedo/damage/machinery:B1:2:3:T");
    expect(() =>
      torpedoMachineryStreamId({
        battleId: "",
        impactMinute: 0,
        impactSubstep: 0,
        torpedoTrackId: "",
      }),
    ).toThrow(BluewaveError);
  });
});
