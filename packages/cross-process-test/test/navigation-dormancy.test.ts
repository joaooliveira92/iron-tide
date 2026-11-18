import type { NavigationRules as CombatNavigationRules } from "@bluewave/combat/navigation";
import { advanceMinutes } from "@bluewave/combat/simulation";
import { computeInitialMovementStates } from "@bluewave/combat/simulation";
import type { TacticalBattleState, TacticalShipUnit } from "@bluewave/combat/tactical";
import { navigationFromRulesets } from "@bluewave/content-compiler";
import {
  decodeNavigationRules,
  type NavigationRules as ContentNavigationRules,
} from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";

const OBSERVATION = "1900-01-01T00:00:00.000Z";

function unit(id: string, sideId: "ATTACKER" | "DEFENDER"): TacticalShipUnit {
  return {
    assetId: id,
    campaignShipId: id,
    sideId,
    name: id,
    className: "Battleship",
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

function battleState(): TacticalBattleState {
  const units = [unit("a1", "ATTACKER"), unit("d1", "DEFENDER")];
  return {
    battleId: "nav-dormancy",
    mapId: "eng_ch",
    sides: [
      { sideId: "ATTACKER", participantIds: ["a1"] },
      { sideId: "DEFENDER", participantIds: ["d1"] },
    ],
    forces: { ATTACKER: ["a1"], DEFENDER: ["d1"] },
    divisions: [],
    units,
    contacts: [],
    movementStates: computeInitialMovementStates(
      { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 },
      units.map((u) => ({
        assetId: u.assetId,
        sideId: u.sideId as "ATTACKER" | "DEFENDER",
        orderedSpeedBpKnots: 10_000,
        designedSpeedBpKnots: 20_000,
        turningRateMdegS: 1_000,
      })),
    ),
    objectives: [],
    weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
    exitZones: [],
    battleEventLedger: [],
  };
}

const orders = { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } };

function run(extra: Partial<Parameters<typeof advanceMinutes>[0]> = {}) {
  return advanceMinutes({
    state: battleState(),
    minutes: 6,
    observationTime: OBSERVATION,
    orders,
    ...extra,
  });
}

const sample = {
  sectionVersion: 1,
  fouling: {
    cruiseSpeedPercent: 70,
    classes: {
      OIL: {
        gratesFouledOnsetMinutes: 90,
        stokersExhaustedOnsetMinutes: 180,
        recoveryMinutes: 200,
      },
      COAL: {
        gratesFouledOnsetMinutes: 60,
        stokersExhaustedOnsetMinutes: 120,
        recoveryMinutes: 150,
      },
      VTE: { gratesFouledOnsetMinutes: 40, stokersExhaustedOnsetMinutes: 80, recoveryMinutes: 100 },
    },
  },
  breakdown: {
    baseChancePpm: 200,
    priorityChancePpm: 2_000,
    maxChancePpm: 5_000,
    repairMinutes: 30,
    repairSpeedCapPercent: 50,
  },
  vibration: { thresholdKnots: 25, gunneryMultiplierBp: 9_000 },
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [{ title: "Rule the Waves 3 manual", page: "86-88" }],
    note: "PROVISIONAL test fixture",
  },
};

const decoded = decodeNavigationRules(sample);
if (!decoded.ok) throw new Error(decoded.message);
const contentRules: ContentNavigationRules = decoded.value;
const combatRules: CombatNavigationRules = contentRules;

describe("navigation stays dormant without the ruleset section (#937)", () => {
  it("production rulesets carry no navigation section", () => {
    const { bundle } = compileProductionCampaign();
    expect(navigationFromRulesets(bundle.rulesets)).toBeUndefined();
  });

  it("advanceMinutes hashes are identical with the navigation input absent, undefined or empty", () => {
    const absent = run();
    const explicitUndefined = run({ navigation: undefined });
    const inert = run({ navigation: { rules: combatRules, ships: [] } });
    expect(explicitUndefined.hashes).toEqual(absent.hashes);
    expect(inert.hashes).toEqual(absent.hashes);
    expect(absent.results.every((result) => result.navigation === undefined)).toBe(true);
    expect(explicitUndefined.results.every((result) => result.navigation === undefined)).toBe(true);
  });

  it("a section without a separation block emits no separation state or records", () => {
    const ships = [{ shipId: "a1", machineryClass: "COAL" as const, enginePriorityBp: 0 }];
    const result = run({ navigation: { rules: combatRules, ships } });
    expect("separation" in combatRules).toBe(false);
    for (const minute of result.results) {
      expect(minute.navigation).toBeDefined();
      expect(minute.navigation?.separation).toBeUndefined();
      expect(minute.navigation?.separationRecords).toBeUndefined();
    }
  });

  it("a separation block without a formation context leaves the minute hashes unchanged", () => {
    const withBlock = decodeNavigationRules({
      ...sample,
      separation: {
        formationBaseBp: { LINE_ABREAST: 40, SEARCH_LINE: 60, SCREEN: 50 },
        nightFactorBp: 20_000,
        poorVisibilityFactorBp: 30_000,
        poorVisibilityThresholdUm: 4_000_000_000,
        cohesionReferenceBp: 10_000,
        heavyShipTypes: ["BB"],
        drift: { thresholdMinutes: 30, toleranceMultiplierBp: 30_000, steeringErrorDeg: 5 },
      },
    });
    if (!withBlock.ok) throw new Error(withBlock.message);
    const ships = [{ shipId: "a1", machineryClass: "COAL" as const, enginePriorityBp: 0 }];
    const without = run({ navigation: { rules: combatRules, ships } });
    const blocked = run({ navigation: { rules: withBlock.value, ships } });
    expect(blocked.hashes).toEqual(without.hashes);
    expect(blocked.results.every((minute) => minute.navigation?.separation === undefined)).toBe(
      true,
    );
  });

  it("a decoded content-schema NavigationRules feeds the combat NavigationRules input", () => {
    const result = run({
      navigation: {
        rules: combatRules,
        ships: [{ shipId: "a1", machineryClass: "COAL", enginePriorityBp: 0 }],
      },
    });
    expect(result.results.every((minute) => minute.navigation !== undefined)).toBe(true);
  });
});
