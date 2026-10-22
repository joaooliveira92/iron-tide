import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  assertSystemShockCandidate,
  eligibleShockSystems,
  evaluateTorpedoSystemShock,
  selectShockSystem,
  shockSelectionWeights,
  TORPEDO_SYSTEM_SHOCK_BASE_BP,
  TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED,
  type SystemShockCandidate,
} from "@bluewave/combat/torpedoes";

function candidate(id: string, band: SystemShockCandidate["band"]): SystemShockCandidate {
  return { stableSystemId: id, band };
}

describe("AC-17 §20: the shipped base probabilities", () => {
  it("ships PRIMARY 3_000 / SECONDARY 1_000 / OUTSIDE 0 exactly", () => {
    expect(TORPEDO_SYSTEM_SHOCK_BASE_BP).toEqual({
      PRIMARY: 3_000,
      SECONDARY: 1_000,
      OUTSIDE: 0,
    });
  });
});

describe("AC-17 §20: eligibility + ascending stable-id ordering", () => {
  it("excludes OUTSIDE systems and sorts ascending by stable id", () => {
    const pool = eligibleShockSystems([
      candidate("TURRET-3", "PRIMARY"),
      candidate("TURRET-1", "SECONDARY"),
      candidate("RADAR-1", "OUTSIDE"),
      candidate("DIRECTOR-2", "PRIMARY"),
    ]);
    expect(pool.map((c) => c.stableSystemId)).toEqual(["DIRECTOR-2", "TURRET-1", "TURRET-3"]);
    expect(Object.isFrozen(pool)).toBe(true);
  });

  it("an all-OUTSIDE candidate list yields an empty pool (never selects it)", () => {
    expect(eligibleShockSystems([candidate("RADAR-1", "OUTSIDE")])).toEqual([]);
  });

  it("refuses malformed candidates (fail closed)", () => {
    expect(() => eligibleShockSystems([{ stableSystemId: "", band: "PRIMARY" }])).toThrow(
      BluewaveError,
    );
    expect(() => eligibleShockSystems([candidate("X", "BOGUS" as never)])).toThrow(BluewaveError);
    expect(() => assertSystemShockCandidate(null)).toThrow(BluewaveError);
  });
});

describe("AC-17 §20: keyed weighted selection over the pool", () => {
  it("each eligible system's weight is its band base; the residual is NO_DAMAGE", () => {
    const pool = eligibleShockSystems([candidate("A", "PRIMARY"), candidate("B", "SECONDARY")]);
    expect(shockSelectionWeights(pool)).toEqual([3_000, 1_000]);
    expect(selectShockSystem(pool, 0)).toEqual(candidate("A", "PRIMARY"));
    expect(selectShockSystem(pool, 2_999)).toEqual(candidate("A", "PRIMARY"));
    expect(selectShockSystem(pool, 3_000)).toEqual(candidate("B", "SECONDARY"));
    expect(selectShockSystem(pool, 3_999)).toEqual(candidate("B", "SECONDARY"));
    expect(selectShockSystem(pool, 4_000)).toBeNull();
    expect(selectShockSystem(pool, 9_999)).toBeNull();
  });

  it("rejects out-of-range draws", () => {
    const pool = eligibleShockSystems([candidate("A", "PRIMARY")]);
    expect(() => selectShockSystem(pool, 10_000)).toThrow(BluewaveError);
    expect(() => selectShockSystem(pool, -1)).toThrow(BluewaveError);
  });
});

describe("AC-17 §20: the evaluation record", () => {
  const judge = (o: { candidates?: readonly SystemShockCandidate[]; draw?: number } = {}) =>
    evaluateTorpedoSystemShock({
      battleId: "B1",
      impactMinute: 6,
      impactSubstep: 4,
      entityId: "T1",
      candidates: o.candidates ?? [candidate("TURRET-1", "PRIMARY")],
      keyedRng: () => o.draw ?? 0.01,
    });

  it("a sub-base draw selects the eligible system + records the code + DESTROYED", () => {
    const r = judge({ draw: 0.001 });
    expect(r.affectedSystem).toEqual(candidate("TURRET-1", "PRIMARY"));
    expect(r.componentOutcome).toBe("DESTROYED");
    expect(r.reasonCode).toBe(TORPEDO_SYSTEM_SHOCK_DAMAGE_CREATED);
    expect(r.decision?.streamId).toBe("battle/torpedo/damage/system-shock:B1:6:4:T1");
    expect(r.decision?.drawBp).toBe(10);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("a draw at/above the pool mass damages nothing (NO_DAMAGE, no code)", () => {
    const r = judge({ draw: 0.9 });
    expect(r.affectedSystem).toBeNull();
    expect(r.componentOutcome).toBeNull();
    expect(r.reasonCode).toBeNull();
    expect(r.decision?.drawBp).toBe(9_000);
  });

  it("never destroys an ineligible system — the OUTSIDE candidate is excluded", () => {
    let calls = 0;
    const r = evaluateTorpedoSystemShock({
      battleId: "B1",
      impactMinute: 6,
      impactSubstep: 4,
      entityId: "T1",
      candidates: [candidate("RADAR-1", "OUTSIDE")],
      keyedRng: () => {
        calls += 1;
        throw new Error("an empty pool must not consume a draw");
      },
    });
    expect(r.affectedSystem).toBeNull();
    expect(r.reasonCode).toBeNull();
    expect(calls).toBe(0);
  });

  it("consumes exactly ONE draw when the pool is non-empty", () => {
    let calls = 0;
    const r = evaluateTorpedoSystemShock({
      battleId: "B1",
      impactMinute: 6,
      impactSubstep: 4,
      entityId: "T1",
      candidates: [
        candidate("A", "PRIMARY"),
        candidate("B", "SECONDARY"),
        candidate("C", "SECONDARY"),
      ],
      keyedRng: () => {
        calls += 1;
        return 0.35;
      },
    });
    expect(r.affectedSystem?.stableSystemId).toBe("B");
    expect(calls).toBe(1);
  });

  it("determinism: same inputs + same draw -> identical frozen result", () => {
    const a = judge({ draw: 0.25 });
    const b = judge({ draw: 0.25 });
    expect(a).toEqual(b);
    expect(judge({ draw: 0.25, candidates: [candidate("Z", "PRIMARY")] }).affectedSystem).toEqual(
      candidate("Z", "PRIMARY"),
    );
  });

  it("rejects malformed identity inputs", () => {
    expect(() =>
      evaluateTorpedoSystemShock({
        battleId: "",
        impactMinute: 6,
        impactSubstep: 4,
        entityId: "T1",
        candidates: [],
        keyedRng: () => 0.5,
      }),
    ).toThrow(BluewaveError);
  });
});
