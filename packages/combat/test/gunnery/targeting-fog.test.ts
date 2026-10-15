import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import {
  resolveGunnery,
  NO_TARGET,
  neutralAccuracyFactors,
  neutralRateFactors,
  withGunneryStateHash,
  type GunneryBattery,
} from "../../src/gunnery/index.js";
import type { TacticalContact } from "../../src/contact/lifecycle.js";

const BATTLE_ID = "battlex";

function contact(id: string, confidence = 10_000): TacticalContact {
  return {
    contactId: id,
    battleId: BATTLE_ID,
    assetId: id,
    sideId: "DEFENDER",
    estimatedIdentity: "Battleship",
    position: [0, 0],
    course: 270,
    speed: 10_000,
    confidence,
    observationTime: "1900-01-01T00:00:00.000Z",
    source: "visual",
    uncertainty: 0,
    lastUpdateMinute: 1,
    stale: false,
    sources: ["visual"],
  };
}

function battery(targetContactId: string): GunneryBattery {
  return {
    id: "BAT-1",
    ownerShipId: "a1",
    sideId: "ATTACKER",
    mountOrdinal: 1,
    commandSource: "CENTRAL",
    baseReloadMs: 2_000,
    salvoCount: 2,
    preferredType: "ARMOR_PIERCING",
    rateFactors: neutralRateFactors(),
    accuracyFactors: neutralAccuracyFactors(5_000),
    state: withGunneryStateHash({
      batteryId: "BAT-1",
      ownerShipId: "a1",
      gunDefinitionId: "GUN-305-45",
      mountDefinitionId: "MNT-305-TWIN",
      targetContactId,
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

describe("AC-12 fog-of-war targeting (DESIGN-39 §1 / DESIGN-38, INC-4)", () => {
  it("a battery fires only when referencing a legal contact track", () => {
    const out = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [battery(`${BATTLE_ID}:d1`)],
      contacts: [contact(`${BATTLE_ID}:d1`)],
      engine: new RandomEngine("legal"),
    });
    expect(out.salvos).toHaveLength(1);
    expect(out.salvos[0]!.outcome).toMatch(/HIT|MISS/);
  });

  it("a battery targeting a hidden/illegal true asset fails with TACTICAL_FOG_OF_WAR_VIOLATION", () => {
    // target "battlex:d1" is NOT among the legal tracks.
    let err: BluewaveError | undefined;
    try {
      resolveGunnery({
        battleId: BATTLE_ID,
        minute: 1,
        batteries: [battery(`${BATTLE_ID}:d1`)],
        contacts: [],
        engine: new RandomEngine("hidden"),
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("TACTICAL_FOG_OF_WAR_VIOLATION");
  });

  it("a contact with zero confidence is not a legal target (hidden asset)", () => {
    let err: BluewaveError | undefined;
    try {
      resolveGunnery({
        battleId: BATTLE_ID,
        minute: 1,
        batteries: [battery(`${BATTLE_ID}:d1`)],
        contacts: [contact(`${BATTLE_ID}:d1`, 0)],
        engine: new RandomEngine("conf0"),
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("TACTICAL_FOG_OF_WAR_VIOLATION");
  });

  it("a battery with NO_TARGET simply does not fire (no violation, no ammo spent)", () => {
    const out = resolveGunnery({
      battleId: BATTLE_ID,
      minute: 1,
      batteries: [battery(NO_TARGET)],
      contacts: [contact(`${BATTLE_ID}:d1`)],
      engine: new RandomEngine("none"),
    });
    expect(out.salvos).toHaveLength(0);
    // ammo untouched for NO_TARGET
    expect(out.nextStates["BAT-1"]!.ammunition.ARMOR_PIERCING).toBe(120);
  });
});
