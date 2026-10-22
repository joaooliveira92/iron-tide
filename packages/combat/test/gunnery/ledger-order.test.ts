import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import { BattleLedger, canonicalEventOrder, type BattleEvent } from "../../src/battleLedger.js";
import {
  resolveGunnery,
  GUNNERY_EVENT_PRIORITY,
  neutralAccuracyFactors,
  neutralRateFactors,
  withGunneryStateHash,
  type GunneryBattery,
} from "../../src/gunnery/index.js";
import type { TacticalContact } from "../../src/contact/lifecycle.js";
import { advanceMinutes } from "../../src/simulation/engine.js";
import type { TacticalBattleState, TacticalShipUnit } from "../../src/tactical/index.js";
import type { MovementState } from "../../src/movement.js";
import { computeInitialMovementStates } from "../../src/simulation/spawn.js";

const BATTLE_ID = "battle-9";

function battery(id: string, ship: string, targetAsset: string): GunneryBattery {
  return {
    id,
    ownerShipId: ship,
    sideId: "ATTACKER",
    mountOrdinal: 1,
    commandSource: "CENTRAL",
    baseReloadMs: 2_000,
    salvoCount: 2,
    preferredType: "ARMOR_PIERCING",
    rateFactors: neutralRateFactors(),
    accuracyFactors: neutralAccuracyFactors(5_000),
    state: withGunneryStateHash({
      batteryId: id,
      ownerShipId: ship,
      gunDefinitionId: "GUN-305-45",
      mountDefinitionId: "MNT-305-TWIN",
      targetContactId: `${BATTLE_ID}:${targetAsset}`,
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
  };
}

describe("AC-9 gunnery events via BattleLedger + canonicalEventOrder (INC-4)", () => {
  it("gunnery salvo BattleEvents are stably ordered regardless of insertion order (DB-independent)", () => {
    const out = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 3,
      batteries: [battery("BAT-B", "SHIP-ZULU", "d1"), battery("BAT-A", "SHIP-ALPHA", "d2")],
      contacts: [
        { contactId: `${BATTLE_ID}:d1` } as TacticalContact,
        { contactId: `${BATTLE_ID}:d2` } as TacticalContact,
      ],
      engine: new RandomEngine("seed"),
    });
    const events = out.events as BattleEvent[];
    expect(events.length).toBe(2);

    const ledger = new BattleLedger();
    for (const e of [...events].reverse()) ledger.append(e);

    const sorted = ledger.sorted();
    expect(sorted[0]!.actorId).toBe("BAT-A");
    expect(sorted[1]!.actorId).toBe("BAT-B");
    expect(sorted).toEqual([...sorted].sort(canonicalEventOrder));
    for (const e of sorted) {
      expect(e.eventType).toBe("gunnery_salvo");
      expect(e.eventPriority).toBe(GUNNERY_EVENT_PRIORITY);
      expect(e.eventHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("the minute pipeline emits gunnery_salvo events through the same BattleLedger path", () => {
    const state = buildGunneryState();
    const res = advanceMinutes({
      state,
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      engine: new RandomEngine("seed-pipeline"),
      gunnery: [battery("BAT-1", "a1", "d1")],
    });
    const minute = res.results[0]!;
    const gunneryEvents = minute.events.filter((e) => e.eventType === "gunnery_salvo");
    expect(gunneryEvents.length).toBe(1);
    for (const e of gunneryEvents) {
      expect(e.battleId).toBe(BATTLE_ID);
      expect(e.minute).toBe(1);
      expect(e.substep).toBe(2);
    }
    expect(minute.events).toEqual([...minute.events].sort(canonicalEventOrder));
  });
});

function unit(id: string, sideId: "ATTACKER" | "DEFENDER", className: string): TacticalShipUnit {
  return {
    assetId: id,
    campaignShipId: id,
    sideId,
    name: id,
    className,
    designVersionId: "dv-1",
    shipType: "BB",
    displacementKg: SafeInt(30_000_000),
    designedSpeedUms: SafeInt(15_433_320),
    armorBeltUm: SafeInt(305_000),
    mainGunsCaliberUm: SafeInt(343_000),
    mainGunsCount: SafeInt(10),
    crewComplement: SafeInt(1_000),
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    sourceStateHash: "pre",
    provenance: {
      battleAssetId: id,
      campaignAssetId: id,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "dv-1",
      sourceCompiledDesignHash: "design-1",
      preBattleStateHash: "pre",
      projectionReason: "test",
      persistenceDisposition: "persistent",
      provenanceHash: "prov",
    },
  };
}

export function buildGunneryState(): TacticalBattleState {
  const units = [unit("a1", "ATTACKER", "Battleship"), unit("d1", "DEFENDER", "Battleship")];
  const movementStates: Record<string, MovementState> = computeInitialMovementStates(
    { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 },
    units.map((u) => ({
      assetId: u.assetId,
      sideId: u.sideId as "ATTACKER" | "DEFENDER",
      orderedSpeedBpKnots: 10_000,
      designedSpeedBpKnots: 20_000,
      turningRateMdegS: 1_000,
    })),
  );
  const contact: TacticalContact = {
    contactId: `${BATTLE_ID}:d1`,
    battleId: BATTLE_ID,
    assetId: "d1",
    sideId: "DEFENDER",
    estimatedIdentity: "Battleship",
    position: movementStates["d1"]!.position,
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
  const state: TacticalBattleState = {
    battleId: BATTLE_ID,
    mapId: "eng_ch",
    sides: [
      { sideId: "ATTACKER", participantIds: ["a1"] },
      { sideId: "DEFENDER", participantIds: ["d1"] },
    ],
    forces: { ATTACKER: ["a1"], DEFENDER: ["d1"] },
    divisions: [],
    units,
    contacts: [contact],
    movementStates,
    objectives: [],
    weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
    exitZones: [],
    battleEventLedger: [],
  };
  return state;
}
