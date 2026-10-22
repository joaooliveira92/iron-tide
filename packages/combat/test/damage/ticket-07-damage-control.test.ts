import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import { advanceMinute, advanceMinutes } from "../../src/simulation/engine.js";
import type { DamageContext, DamageTargetContext } from "../../src/battleResolution/damage.js";
import { hpOfState, initialDamageState } from "../../src/battleResolution/damage.js";
import { INVALID_SHIP_DAMAGE_STATE } from "../../src/damage/reasonCodes.js";
import { FLOAT_UNIT, STABILITY_INITIAL_BP } from "../../src/battleResolution/constants.js";
import type { ShipDamageState } from "../../src/damage/state.js";
import { withDamageStateHash } from "../../src/damage/state.js";
import {
  applyDamageControlToState,
  requireDamageDesignSurface,
  resolveDamageControl,
  type DamageControlContext,
  type DamageControlStageResult,
} from "../../src/damage/damageControlEngineWiring.js";
import { createDefaultDamageControlResource } from "../../src/damage/damageControl.js";
import type { FireRecord, FloodingSourceRecord } from "../../src/damage/state.js";
import { buildTestState } from "../simulation/advance.test.js";

function makeFire(locationId: string, intensityBp: number, cause = "gunnery"): FireRecord {
  return { locationId, intensityBp, cause };
}

function makeFlood(
  compartmentId: string,
  rateKgMin: number,
  cause = "torpedo",
): FloodingSourceRecord {
  return { compartmentId, rateKgMin, cause };
}

const TEST_HULL_DISPLACEMENT_KG = 30_000_000;

function makeContext(overrides: Partial<DamageControlContext> = {}): DamageControlContext {
  return {
    fireRecords: [],
    floodingRecords: [],
    floodedWaterBp: 0,
    designDisplacementKg: TEST_HULL_DISPLACEMENT_KG,
    shipType: "BB",
    currentSpeedKt: 10,
    resources: createDefaultDamageControlResource(),
    keyedRng: null,
    ...overrides,
  };
}

function damageTarget(shipId: string, state: ShipDamageState): DamageTargetContext {
  return {
    shipId,
    zones: [],
    compartments: [],
    components: [],
    state,
    designFlotationReserve: FLOAT_UNIT,
    designStabilityScore: STABILITY_INITIAL_BP,
    designDisplacementKg: TEST_HULL_DISPLACEMENT_KG,
    beltArmorUm: 0,
    mainGunsCaliberUm: 0,
    shipType: "BB",
    maxHitPoints: 100,
  };
}

function damageContext(states: Record<string, ShipDamageState>): DamageContext {
  const targets: Record<string, DamageTargetContext> = {};
  for (const [shipId, state] of Object.entries(states)) {
    targets[shipId] = damageTarget(shipId, state);
  }
  return { battleId: "b1", targets };
}

const OBSERVATION_TIME = "1900-01-01T00:00:00.000Z";

describe("P-1 ticket 07: per-ship damage control", () => {
  describe("resolveDamageControl per-ship surface", () => {
    it("surfaces netDeltaKgMin and a ship-scoped smoke cloud/record id", () => {
      const ctxA = makeContext({
        shipId: "a1",
        fireRecords: [makeFire("COMP-BELT-1", 8_000)],
        floodingRecords: [makeFlood("COMP-BELT-1", 10_000)],
      });
      const ctxB = makeContext({
        shipId: "d1",
        fireRecords: [makeFire("COMP-BELT-1", 8_000)],
      });
      const ra = resolveDamageControl(ctxA, 1, 0);
      const rb = resolveDamageControl(ctxB, 1, 0);

      expect(ra.netDeltaKgMin).toBeGreaterThan(0);
      expect(rb.netDeltaKgMin).toBe(0);
      expect(ra.smokeEventRecords[0]!.sourceId).toBe("COMP-BELT-1");
      expect(ra.smokeEventRecords[0]!.cloudId).not.toBe(rb.smokeEventRecords[0]!.cloudId);
      expect(ra.smokeEventRecords[0]!.recordId).not.toBe(rb.smokeEventRecords[0]!.recordId);
      expect(ra.smokeEventRecords[0]!.cloudId).toContain("a1");
      expect(rb.smokeEventRecords[0]!.cloudId).toContain("d1");
    });

    it("two fires on ONE ship stay distinct (recordId embeds the location)", () => {
      const ctx = makeContext({
        shipId: "a1",
        fireRecords: [makeFire("COMP-BELT-1", 8_000), makeFire("COMP-MAGAZINE-1", 8_000)],
      });
      const r = resolveDamageControl(ctx, 1, 0);
      expect(r.smokeEventRecords).toHaveLength(2);
      expect(r.smokeEventRecords[0]!.recordId).not.toBe(r.smokeEventRecords[1]!.recordId);
    });

    it("allocation severity reads bp of displacement, not accumulated kg (F1/ADR-0047 d4)", () => {
      const HULL = 11_000_000;
      const allocationsFor = (floodedWaterBp: number) =>
        resolveDamageControl(
          makeContext({
            floodingRecords: [makeFlood("COMP-BELT-1", 500)],
            floodedWaterBp,
            designDisplacementKg: HULL,
          }),
          1,
          0,
        ).allocations;

      const minor = allocationsFor(548_900);
      expect(minor[0]!.severity).toBe("MINOR");
      expect(minor[0]!.priority).toBe("NON_CRITICAL_DEWATERING");

      const serious = allocationsFor(550_000);
      expect(serious[0]!.severity).toBe("SERIOUS");
      expect(serious[0]!.priority).toBe("NON_CRITICAL_DEWATERING");

      const major = allocationsFor(1_650_000);
      expect(major[0]!.severity).toBe("MAJOR");
      expect(major[0]!.priority).toBe("CRITICAL_FLOODING");

      const critical = allocationsFor(3_300_000);
      expect(critical[0]!.severity).toBe("CRITICAL");
      expect(critical[0]!.priority).toBe("CRITICAL_FLOODING");

      const regression = allocationsFor(500_000);
      expect(regression[0]!.severity).toBe("MINOR");
      expect(regression[0]!.priority).toBe("NON_CRITICAL_DEWATERING");
    });

    it("fail-closed design guard (F7): the write-back refuses a missing design surface", () => {
      const design = { designFlotationReserve: 50_000, designStabilityScore: 8_000 };
      expect(requireDamageDesignSurface(design, "b1", "a1")).toBe(design);
      expect(() => requireDamageDesignSurface(undefined, "b1", "a1")).toThrow(
        INVALID_SHIP_DAMAGE_STATE,
      );
      let caught: unknown;
      try {
        requireDamageDesignSurface(undefined, "b1", "a1");
      } catch (e) {
        caught = e;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect((caught as BluewaveError).message).toBe(INVALID_SHIP_DAMAGE_STATE);
      expect((caught as BluewaveError).context).toMatchObject({ battleId: "b1", shipId: "a1" });
    });
  });

  describe("applyDamageControlToState write-back", () => {
    function writer(state: ShipDamageState, stageResult: Partial<DamageControlStageResult> = {}) {
      return applyDamageControlToState({
        state,
        stageResult: {
          fireRecords: [],
          floodingRecords: [],
          nextFloodedWaterBp: state.progressiveFloodingTotal,
          allocations: [],
          smokeEventRecords: [],
          highSpeedLoss: false,
          netDeltaKgMin: 0,
          ...stageResult,
        },
        designFlotationReserve: FLOAT_UNIT,
        designStabilityScore: STABILITY_INITIAL_BP,
      });
    }

    it("flooding drains flotation reserve, flood total, and recomputes the hash", () => {
      const state = withDamageStateHash({
        ...initialDamageState("a1"),
        floodingRecords: [makeFlood("COMP-BELT-1", 10_000)],
      });
      const { state: next, changed } = writer(state, {
        floodingRecords: [makeFlood("COMP-BELT-1", 10_000)],
        nextFloodedWaterBp: 7_250,
        netDeltaKgMin: 7_250,
      });
      expect(changed).toBe(true);
      expect(next.flotationReserve).toBe(FLOAT_UNIT - 7_250);
      expect(next.progressiveFloodingTotal).toBe(7_250);
      expect(next.stateHash).not.toBe(state.stateHash);
      expect(next.terminalStatus).toBe("NORMAL");
    });

    it("reserve reaching 0 transitions the ship SINKING (flooding feeds §32)", () => {
      const state = withDamageStateHash({ ...initialDamageState("a1") });
      const { state: next } = writer(state, {
        nextFloodedWaterBp: FLOAT_UNIT + 1_000,
        netDeltaKgMin: FLOAT_UNIT + 1_000,
      });
      expect(next.flotationReserve).toBe(0);
      expect(next.terminalStatus).toBe("SINKING");
    });

    it("flotation 0 with structure 0 is FOUNDERED", () => {
      const state = withDamageStateHash({
        ...initialDamageState("a1"),
        structuralIntegrity: 0,
      });
      const { state: next } = writer(state, {
        nextFloodedWaterBp: FLOAT_UNIT + 1_000,
        netDeltaKgMin: FLOAT_UNIT + 1_000,
      });
      expect(next.terminalStatus).toBe("FOUNDERED");
    });

    it("decayed fire records write back; unchanged minutes keep the input state", () => {
      const state = withDamageStateHash({
        ...initialDamageState("a1"),
        fireRecords: [makeFire("COMP-BELT-1", 5_000)],
      });
      const decayed = writer(state, { fireRecords: [makeFire("COMP-BELT-1", 4_800)] });
      expect(decayed.changed).toBe(true);
      expect(decayed.state.fireRecords[0]!.intensityBp).toBe(4_800);

      const quiet = writer(state, { fireRecords: [makeFire("COMP-BELT-1", 5_000)] });
      expect(quiet.changed).toBe(false);
      expect(quiet.state).toBe(state);
    });
  });

  describe("engine step 8.6 per-ship resolution", () => {
    it("a wired-but-quiet map is a strict no-op: minuteHash byte-identical to no map", () => {
      const state = buildTestState();
      const damage = damageContext({
        a1: initialDamageState("a1"),
        d1: initialDamageState("d1"),
      });
      const base = advanceMinute({ state, minute: 1, observationTime: OBSERVATION_TIME, damage });
      const quiet = advanceMinute({
        state,
        minute: 1,
        observationTime: OBSERVATION_TIME,
        damage,
        damageControl: {
          a1: makeContext({ floodedWaterBp: 0 }),
          d1: makeContext({ floodedWaterBp: 0 }),
        },
      });
      expect(quiet.minuteHash).toBe(base.minuteHash);
      expect(quiet.events).toEqual(base.events);
      expect(quiet.damageStates).toBeUndefined();
    });

    it("emits per-ship smoke_fire events with distinct eventIds for the same compartment", () => {
      const state = buildTestState();
      const fire = makeFire("COMP-BELT-1", 8_000);
      const damage = damageContext({
        a1: withDamageStateHash({ ...initialDamageState("a1"), fireRecords: [fire] }),
        d1: withDamageStateHash({ ...initialDamageState("d1"), fireRecords: [fire] }),
      });
      const res = advanceMinute({
        state,
        minute: 1,
        observationTime: OBSERVATION_TIME,
        damage,
        damageControl: {
          a1: makeContext({ fireRecords: [fire] }),
          d1: makeContext({ fireRecords: [fire] }),
        },
      });
      const smoke = res.events.filter((e) => e.eventType === "smoke_fire");
      expect(smoke).toHaveLength(2);
      expect(smoke[0]!.eventId).not.toBe(smoke[1]!.eventId);
      expect(smoke.map((e) => e.actorId).sort()).toEqual(["fire-smoke:a1", "fire-smoke:d1"]);
      const a1 = res.damageStates!["a1"]!;
      const d1 = res.damageStates!["d1"]!;
      expect(a1.fireRecords[0]!.intensityBp).toBe(7_800);
      expect(d1.fireRecords[0]!.intensityBp).toBe(7_800);
    });

    it("advanceMinutes threads per-ship contexts: a torpedo flood founders the ship over time", () => {
      const state = buildTestState();
      const initial = withDamageStateHash({
        ...initialDamageState("a1"),
        floodingRecords: [makeFlood("COMP-BELT-1", FLOAT_UNIT / 4)],
      });
      const damage = damageContext({ a1: initial, d1: initialDamageState("d1") });
      const res = advanceMinutes({
        state,
        minutes: 8,
        observationTime: OBSERVATION_TIME,
        damage,
        damageControl: {
          a1: makeContext({
            floodingRecords: [makeFlood("COMP-BELT-1", FLOAT_UNIT / 4)],
            floodedWaterBp: 0,
          }),
          d1: makeContext({ floodedWaterBp: 0 }),
        },
      });

      const first = res.results[0]!.damageStates?.["a1"];
      expect(first).toBeDefined();
      expect(res.results[0]!.damageStates?.["d1"]).toBeUndefined();

      const last = res.results[res.results.length - 1]!.damageStates?.["a1"];
      expect(last).toBeDefined();
      expect(last!.flotationReserve).toBe(0);
      expect(last!.terminalStatus).toBe("SINKING");
      expect(last!.progressiveFloodingTotal).toBeGreaterThanOrEqual(FLOAT_UNIT);
      expect(hpOfState(last!, 100)).toBe(SafeInt(0));
      const rerun = advanceMinutes({
        state,
        minutes: 8,
        observationTime: OBSERVATION_TIME,
        damage,
        damageControl: {
          a1: makeContext({
            floodingRecords: [makeFlood("COMP-BELT-1", 10_000)],
            floodedWaterBp: 0,
          }),
          d1: makeContext({ floodedWaterBp: 0 }),
        },
      });
      expect(rerun.hashes).toEqual(res.hashes);
    });

    it("without the damageControl map the same flood never progresses (P-1 prior state)", () => {
      const state = buildTestState();
      const initial = withDamageStateHash({
        ...initialDamageState("a1"),
        floodingRecords: [makeFlood("COMP-BELT-1", 10_000)],
      });
      const damage = damageContext({ a1: initial, d1: initialDamageState("d1") });
      const res = advanceMinutes({
        state,
        minutes: 8,
        observationTime: OBSERVATION_TIME,
        damage,
      });
      for (const r of res.results) expect(r.damageStates).toBeUndefined();
    });
  });
});
