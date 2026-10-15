import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import {
  resolveGunnery,
  computeGunneryEventHash,
  gunneryEventId,
  type GunneryEventRecord,
  type GunneryEventRecordBody,
  neutralAccuracyFactors,
  neutralRateFactors,
  withGunneryStateHash,
  type GunneryBattery,
} from "../../src/gunnery/index.js";
import type { TacticalContact } from "../../src/contact/lifecycle.js";

const BATTLE_ID = "battle-1";

function contact(assetId: string): TacticalContact {
  return {
    contactId: `${BATTLE_ID}:${assetId}`,
    battleId: BATTLE_ID,
    assetId,
    sideId: "DEFENDER",
    estimatedIdentity: "Battleship",
    position: [0, 0],
    course: 270,
    speed: 10_000,
    confidence: 10_000,
    observationTime: "1900-01-01T00:00:00.000Z",
    source: "visual",
    uncertainty: 0,
    lastUpdateMinute: 1,
    stale: false,
    sources: ["visual"],
  };
}

function firingBattery(over: Partial<GunneryBattery> = {}): GunneryBattery {
  return {
    id: "BAT-1",
    ownerShipId: "SHIP-ALPHA",
    sideId: "ATTACKER",
    mountOrdinal: 1,
    commandSource: "CENTRAL",
    baseReloadMs: 2_000,
    salvoCount: 4,
    preferredType: "ARMOR_PIERCING",
    rateFactors: neutralRateFactors(),
    accuracyFactors: neutralAccuracyFactors(5_000),
    state: withGunneryStateHash({
      batteryId: "BAT-1",
      ownerShipId: "SHIP-ALPHA",
      gunDefinitionId: "GUN-305-45",
      mountDefinitionId: "MNT-305-TWIN",
      targetContactId: `${BATTLE_ID}:d1`,
      acquisitionProgressBp: 8_000,
      rangeEstimateUm: 10_000_000_000,
      rangeUncertaintyUm: 150_000_000,
      fireControlSolutionQualityBp: 8_000,
      ammunition: { ARMOR_PIERCING: 120, COMMON: 80, HIGH_EXPLOSIVE: 40 },
      fireMode: "NORMAL",
      reloadProgressMs: 2_000,
      straddleState: null,
      damageState: null,
      aaEligibilityState: null,
      lastSalvoMinute: -1,
      lastSalvoSubstep: 0,
      rulesetVersion: "gunnery_ruleset_v1",
      formulaVersion: "gunnery_formula_v1",
    }),
    ...over,
  };
}

function stripHash(rec: GunneryEventRecord): GunneryEventRecordBody {
  const { eventHash: _eventHash, ...body } = rec;
  return body;
}

describe("AC-8 GunneryEventRecord completeness (DESIGN-39 §30, INC-4)", () => {
  it("every firing battery yields an immutable record carrying all §30 fields", () => {
    const out = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 7,
      batteries: [firingBattery()],
      contacts: [contact("d1")],
      engine: new RandomEngine("seed-1"),
    });
    expect(out.salvos).toHaveLength(1);
    const rec = out.salvos[0]!;
    expect(rec.eventId).toBe(
      gunneryEventId({
        battleId: BATTLE_ID,
        minute: 7,
        substep: 2,
        batteryId: "BAT-1",
        targetContactId: `${BATTLE_ID}:d1`,
      }),
    );
    // §30 field presence
    expect(rec.battleId).toBe(BATTLE_ID);
    expect(rec.minute).toBe(7);
    expect(typeof rec.substep).toBe("number");
    expect(rec.batteryId).toBe("BAT-1");
    expect(rec.shooterId).toBe("SHIP-ALPHA");
    expect(rec.targetContactId).toBe(`${BATTLE_ID}:d1`);
    expect(rec.commandSource).toBe("CENTRAL");
    expect(rec.fireMode).toBe("NORMAL");
    expect(rec.ammunition).toEqual({
      type: "ARMOR_PIERCING",
      rounds: 4,
      before: 120,
      after: 116,
    });
    expect(rec.accuracy.finalAccuracyBp).toBe(5_000);
    expect(rec.accuracy.factorKeys.length).toBe(16);
    expect(rec.rate.effectiveReloadMs).toBe(2_000);
    expect(rec.randomDecisions).toHaveLength(1);
    expect(rec.randomDecisions[0]!.streamId).toContain("gunnery/accuracy/hit");
    expect(rec.randomDecisions[0]!.draw).toBeGreaterThanOrEqual(0);
    expect(rec.randomDecisions[0]!.draw).toBeLessThanOrEqual(9_999);
    expect(rec.impactInputs).toBeNull(); // reserved this slice
    expect(rec.damageEventRefs).toEqual([]); // reserved this slice
    expect(["HIT", "MISS"]).toContain(rec.outcome);
    expect(rec.formulaVersion).toBe("gunnery_formula_v1");
    expect(rec.rulesetVersion).toBe("gunnery_ruleset_v1");
    expect(rec.eventHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("records are immutable (deeply frozen)", () => {
    const out = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [firingBattery()],
      contacts: [contact("d1")],
      engine: new RandomEngine("seed-immutable"),
    });
    const rec = out.salvos[0]!;
    expect(Object.isFrozen(rec)).toBe(true);
    expect(computeGunneryEventHash(stripHash(rec))).toBe(rec.eventHash);
  });

  it("event hash is stable for identical inputs and changes on any field change", () => {
    const recA = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [firingBattery()],
      contacts: [contact("d1")],
      engine: new RandomEngine("seed-hash"),
    }).salvos[0]!;
    const recB = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [firingBattery()],
      contacts: [contact("d1")],
      engine: new RandomEngine("seed-hash"),
    }).salvos[0]!;
    expect(recA.eventHash).toBe(recB.eventHash); // stable

    // change salvoCount -> different ammunition rounds + next state -> hash changes
    const recC = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [firingBattery({ salvoCount: 6 })],
      contacts: [contact("d1")],
      engine: new RandomEngine("seed-hash"),
    }).salvos[0]!;
    expect(recC.eventHash).not.toBe(recA.eventHash);

    // change fire mode -> hash changes
    const recD = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [
        firingBattery({ state: { ...firingBattery().state, fireMode: "LOCAL_CONTROL" } }),
      ],
      contacts: [contact("d1")],
      engine: new RandomEngine("seed-hash"),
    }).salvos[0]!;
    expect(recD.eventHash).not.toBe(recA.eventHash);
  });
});
