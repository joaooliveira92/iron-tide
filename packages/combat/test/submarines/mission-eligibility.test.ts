import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  SUBMARINE_MISSION_INELIGIBLE,
  SUBMARINE_RELIABILITY_INSUFFICIENT,
  SUBMARINE_STATE_INVARIANT_FAILED,
  SUBMARINE_MISSIONS,
  submarineMissionsPolicyId,
  SHIPPED_SUBMARINE_MISSION_DEFINITIONS,
  SHIPPED_SUBMARINE_MISSIONS_CONTRACT,
  validateSubmarineMissionsContract,
  submarineMissionById,
  validateSubmarineMissionDefinition,
  verifySubmarineMissionContentHash,
  withSubmarineMissionContentHash,
  isSubmarineMissionEligible,
  SUBMARINE_MISSION_ELIGIBILITY_GUARDS,
  type SubmarineMissionDefinition,
  type SubmarineMissionEligibilityContext,
  type SubmarineMissionEligibilityVerdict,
  type SubmarineMissionRequest,
  type SubmarineStrategicAsset,
  withSubmarineStrategicAssetAggregateHash,
} from "../../src/submarines/index.js";

function baseAsset(
  overrides: Partial<SubmarineStrategicAsset> = {},
): Omit<SubmarineStrategicAsset, "aggregateHash"> {
  return {
    assetId: "sub-001",
    ownerNationId: "nation_germany",
    submarineTypeId: "COASTAL",
    representation: "TYPED_FLOTILLA_POOL",
    quantity: SafeInt(3),
    readiness: SafeInt(80),
    reliability: SafeInt(70),
    currentStrategicAreaId: "area_north_sea",
    homeBaseId: "base_kiel",
    fuelAndSupplyState: { fuelBp: SafeInt(9_000), supplyBp: SafeInt(8_500) },
    missionPolicyId: "PRIZE_RULES",
    damageLossState: { kind: "OPERATIONAL", damageBp: SafeInt(0) },
    monthlyBattleParticipationCount: SafeInt(0),
    rulesetVersion: "submarine_ruleset_v1",
    ...overrides,
  };
}

function validAsset(overrides: Partial<SubmarineStrategicAsset> = {}): SubmarineStrategicAsset {
  return withSubmarineStrategicAssetAggregateHash(baseAsset(overrides));
}

function rawAsset(overrides: Partial<SubmarineStrategicAsset> = {}): SubmarineStrategicAsset {
  return baseAsset(overrides) as SubmarineStrategicAsset;
}

function eligibleRequest(): SubmarineMissionRequest {
  return {
    missionId: "FLEET_INTERDICTION",
    requiredReadiness: SafeInt(80),
    requiredFuelBp: SafeInt(5_000),
  };
}

function eligibleContext(): SubmarineMissionEligibilityContext {
  return {
    atWar: true,
    availableTechnologyIds: new Set<string>(),
    baseProximityBand: "LOCAL",
    baseSupportAvailable: true,
  };
}

function expectRejected(
  verdict: SubmarineMissionEligibilityVerdict,
  guard: string,
  reasonCode: string,
): void {
  expect(verdict.accepted).toBe(false);
  if (!verdict.accepted) {
    expect(verdict.guard).toBe(guard);
    expect(verdict.reasonCode).toBe(reasonCode);
  }
}

describe("AC-4: seven canonical §6 missions", () => {
  it("SUBMARINE_MISSIONS enumerates exactly the seven §6 missions", () => {
    expect([...SUBMARINE_MISSIONS]).toEqual([
      "FLEET_INTERDICTION",
      "MERCHANT_RAIDING",
      "MINE_LAYING",
      "RECONNAISSANCE",
      "TACTICAL_BATTLE_SUPPORT",
      "RETURNING_SHIP_INTERCEPTION",
      "MISSILE_PATROL",
    ]);
  });

  it("SHIPPED_SUBMARINE_MISSION_DEFINITIONS covers exactly the seven §6 missions", () => {
    const ids = SHIPPED_SUBMARINE_MISSION_DEFINITIONS.map((m) => m.missionId).sort();
    expect(ids).toEqual([...SUBMARINE_MISSIONS].sort());
    expect(SHIPPED_SUBMARINE_MISSION_DEFINITIONS).toHaveLength(7);
  });

  it("every shipped mission definition validates, carries a topic label, version, and deterministic hash", () => {
    for (const def of SHIPPED_SUBMARINE_MISSION_DEFINITIONS) {
      expect(() => validateSubmarineMissionDefinition(def)).not.toThrow();
      expect(def.topicLabel.length).toBeGreaterThan(0);
      expect(def.contentVersion).toBe(submarineMissionsPolicyId);
      expect(def.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(verifySubmarineMissionContentHash(def)).toBe(true);
    }
  });

  it("content hash is deterministic and fails verification on tamper", () => {
    const a = submarineMissionById("FLEET_INTERDICTION");
    const b = submarineMissionById("FLEET_INTERDICTION");
    expect(a.contentHash).toBe(b.contentHash);
    const tampered = { ...a, topicLabel: "CHANGED" } as SubmarineMissionDefinition;
    expect(verifySubmarineMissionContentHash(tampered)).toBe(false);
    const changed = withSubmarineMissionContentHash({
      missionId: "FLEET_INTERDICTION",
      topicLabel: "Changed label",
      missionPriority: SafeInt(9),
      contentVersion: submarineMissionsPolicyId,
    });
    expect(changed.contentHash).not.toBe(a.contentHash);
  });

  it("submarineMissionById resolves every shipped mission and fails on an unknown id", () => {
    for (const def of SHIPPED_SUBMARINE_MISSION_DEFINITIONS) {
      expect(submarineMissionById(def.missionId).missionId).toBe(def.missionId);
    }
    let err: BluewaveError | undefined;
    try {
      submarineMissionById("BOGUS");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
  });
});

describe("AC-4 / §26.4: mission priority field (explicit, canonical order)", () => {
  it("every definition carries an explicit positive-integer mission priority", () => {
    for (const def of SHIPPED_SUBMARINE_MISSION_DEFINITIONS) {
      expect(typeof def.missionPriority).toBe("number");
      expect(Number.isInteger(def.missionPriority)).toBe(true);
      expect(def.missionPriority).toBeGreaterThan(0);
    }
  });

  it("priorities are strictly ascending (unique, total order) — the §26.4 canonical mission order", () => {
    const byPriority = [...SHIPPED_SUBMARINE_MISSION_DEFINITIONS].sort(
      (a, b) => a.missionPriority - b.missionPriority,
    );
    for (let i = 1; i < byPriority.length; i += 1) {
      expect(byPriority[i]!.missionPriority).toBeGreaterThan(byPriority[i - 1]!.missionPriority);
    }
    const priorities = new Set(SHIPPED_SUBMARINE_MISSION_DEFINITIONS.map((m) => m.missionPriority));
    expect(priorities.size).toBe(SHIPPED_SUBMARINE_MISSION_DEFINITIONS.length);
    expect(byPriority[0]!.missionId).toBe("MISSILE_PATROL");
  });

  it("a definition with a missing/invalid priority or bad content version fails closed", () => {
    let err: BluewaveError | undefined;
    try {
      validateSubmarineMissionDefinition({
        missionId: "MINE_LAYING",
        topicLabel: "Submarine-laid mine laying",
        missionPriority: SafeInt(0),
        contentVersion: submarineMissionsPolicyId,
        contentHash: "x".repeat(64),
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
    expect(err!.context.field).toBe("missionPriority");

    expect(() =>
      validateSubmarineMissionDefinition({
        missionId: "MINE_LAYING",
        topicLabel: "Submarine-laid mine laying",
        missionPriority: SafeInt(7),
        contentVersion: "submarine_missions_v2",
        contentHash: "x".repeat(64),
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-4: happy path", () => {
  it("accepts an eligible asset / request / context", () => {
    const verdict = isSubmarineMissionEligible(validAsset(), eligibleRequest(), eligibleContext());
    expect(verdict.accepted).toBe(true);
    if (verdict.accepted) {
      expect(verdict.missionId).toBe("FLEET_INTERDICTION");
      expect(verdict.reasonCode).toBe(null);
      expect(verdict.guard).toBe(null);
    }
  });

  it("is deterministic: identical inputs produce identical verdicts", () => {
    const a = isSubmarineMissionEligible(validAsset(), eligibleRequest(), eligibleContext());
    const b = isSubmarineMissionEligible(validAsset(), eligibleRequest(), eligibleContext());
    expect(a).toEqual(b);
  });
});

describe("AC-4: every §6 guard fails closed with SUBMARINE_MISSION_INELIGIBLE", () => {
  it("mission guard: a non-canonical mission id is rejected", () => {
    const verdict = isSubmarineMissionEligible(
      validAsset(),
      {
        missionId: "BOGUS" as never,
        requiredReadiness: SafeInt(80),
        requiredFuelBp: SafeInt(5_000),
      },
      eligibleContext(),
    );
    expectRejected(verdict, "mission", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("mission guard: a missing request is rejected (never a silent pass)", () => {
    const verdict = isSubmarineMissionEligible(
      validAsset(),
      null as unknown as SubmarineMissionRequest,
      eligibleContext(),
    );
    expectRejected(verdict, "mission", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("type guard: a type not mission-eligible for the mission is rejected (COASTAL + MISSILE_PATROL)", () => {
    const verdict = isSubmarineMissionEligible(
      validAsset(),
      {
        missionId: "MISSILE_PATROL",
        requiredReadiness: SafeInt(80),
        requiredFuelBp: SafeInt(5_000),
      },
      eligibleContext(),
    );
    expectRejected(verdict, "type", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("type guard: an unknown/corrupt type id is rejected", () => {
    const verdict = isSubmarineMissionEligible(
      rawAsset({ submarineTypeId: "NUCLEAR" as never }),
      eligibleRequest(),
      eligibleContext(),
    );
    expectRejected(verdict, "type", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("technology guard: a missing §4 technology prerequisite is rejected", () => {
    const asset = validAsset({ submarineTypeId: "LONG_RANGE" });
    const context = eligibleContext();
    const verdict = isSubmarineMissionEligible(
      asset,
      {
        missionId: "FLEET_INTERDICTION",
        requiredReadiness: SafeInt(80),
        requiredFuelBp: SafeInt(5_000),
      },
      context,
    );
    expectRejected(verdict, "technology", SUBMARINE_MISSION_INELIGIBLE);
    const withTech: SubmarineMissionEligibilityContext = {
      ...context,
      availableTechnologyIds: new Set(["long_range_submarine_technology"]),
    };
    const ok = isSubmarineMissionEligible(
      asset,
      {
        missionId: "FLEET_INTERDICTION",
        requiredReadiness: SafeInt(80),
        requiredFuelBp: SafeInt(5_000),
      },
      withTech,
    );
    expect(ok.accepted).toBe(true);
  });

  it("range guard: zero §9 remote efficiency at the band is rejected (coastal at EXTREME_REMOTE)", () => {
    const verdict = isSubmarineMissionEligible(validAsset(), eligibleRequest(), {
      ...eligibleContext(),
      baseProximityBand: "EXTREME_REMOTE",
    });
    expectRejected(verdict, "range", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("base-support guard: a REQUIRED support-base type with no base available is rejected", () => {
    const verdict = isSubmarineMissionEligible(validAsset(), eligibleRequest(), {
      ...eligibleContext(),
      baseSupportAvailable: false,
    });
    expectRejected(verdict, "baseSupport", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("readiness guard: asset readiness below the mission floor is rejected", () => {
    const verdict = isSubmarineMissionEligible(
      validAsset({ readiness: SafeInt(79) }),
      eligibleRequest(),
      eligibleContext(),
    );
    expectRejected(verdict, "readiness", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("damage guard: SUNK / CAPTURED / SCUTTLED assets are rejected", () => {
    for (const kind of ["SUNK", "CAPTURED", "SCUTTLED"] as const) {
      const verdict = isSubmarineMissionEligible(
        validAsset({ damageLossState: { kind } }),
        eligibleRequest(),
        eligibleContext(),
      );
      expectRejected(verdict, "damage", SUBMARINE_MISSION_INELIGIBLE);
    }
  });

  it("fuel guard: asset fuel below the mission floor is rejected", () => {
    const verdict = isSubmarineMissionEligible(
      validAsset({
        fuelAndSupplyState: { fuelBp: SafeInt(4_999), supplyBp: SafeInt(8_500) },
      }),
      eligibleRequest(),
      eligibleContext(),
    );
    expectRejected(verdict, "fuel", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("policy guard: a non-canonical §5 mission policy is rejected", () => {
    const verdict = isSubmarineMissionEligible(
      rawAsset({ missionPolicyId: "BOGUS" as never }),
      eligibleRequest(),
      eligibleContext(),
    );
    expectRejected(verdict, "policy", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("area guard: a missing current strategic area is rejected", () => {
    const verdict = isSubmarineMissionEligible(
      rawAsset({ currentStrategicAreaId: "" }),
      eligibleRequest(),
      eligibleContext(),
    );
    expectRejected(verdict, "area", SUBMARINE_MISSION_INELIGIBLE);
  });

  it("war-state guard: not at war is rejected", () => {
    const verdict = isSubmarineMissionEligible(validAsset(), eligibleRequest(), {
      ...eligibleContext(),
      atWar: false,
    });
    expectRejected(verdict, "warState", SUBMARINE_MISSION_INELIGIBLE);
  });
});

describe("AC-5: the reliability guard fires SUBMARINE_RELIABILITY_INSUFFICIENT", () => {
  it("asset reliability below the §7 floor of 20 is rejected with the dedicated code", () => {
    for (const reliability of [0, 10, 19]) {
      const verdict = isSubmarineMissionEligible(
        validAsset({ reliability: SafeInt(reliability) }),
        eligibleRequest(),
        eligibleContext(),
      );
      expectRejected(verdict, "reliability", SUBMARINE_RELIABILITY_INSUFFICIENT);
      if (!verdict.accepted) expect(verdict.message).toContain("REPAIR_TRANSFER");
    }
  });

  it("asset reliability at/above 20 passes the reliability guard", () => {
    const verdict = isSubmarineMissionEligible(
      validAsset({ reliability: SafeInt(20) }),
      eligibleRequest(),
      eligibleContext(),
    );
    expect(verdict.accepted).toBe(true);
  });
});

describe("AC-4: guard -> reason-code partition is the recorded INC-2 set", () => {
  it("exactly the two INC-2 codes fire, over all twelve §6 guards", () => {
    expect(SUBMARINE_MISSION_ELIGIBILITY_GUARDS).toHaveLength(12);
    const codes = new Set(SUBMARINE_MISSION_ELIGIBILITY_GUARDS.map((g) => g.reasonCode));
    expect([...codes].sort()).toEqual(
      [SUBMARINE_MISSION_INELIGIBLE, SUBMARINE_RELIABILITY_INSUFFICIENT].sort(),
    );
    const reliabilityGuards = SUBMARINE_MISSION_ELIGIBILITY_GUARDS.filter(
      (g) => g.guard === "reliability",
    );
    expect(reliabilityGuards).toHaveLength(1);
    expect(reliabilityGuards[0]!.reasonCode).toBe(SUBMARINE_RELIABILITY_INSUFFICIENT);
  });
});

describe("AC-21: submarine_missions_v1 contract + guard (fail closed)", () => {
  it("ships the *_v1 policy id and validates the shipped contract", () => {
    expect(submarineMissionsPolicyId).toBe("submarine_missions_v1");
    expect(SHIPPED_SUBMARINE_MISSIONS_CONTRACT.policyId).toBe("submarine_missions_v1");
    expect(() =>
      validateSubmarineMissionsContract(SHIPPED_SUBMARINE_MISSIONS_CONTRACT),
    ).not.toThrow();
  });

  it("wires the closed §6 seven-mission enum and the §26.4 priority fields", () => {
    const c = SHIPPED_SUBMARINE_MISSIONS_CONTRACT;
    expect([...c.missions]).toEqual([...SUBMARINE_MISSIONS]);
    expect(c.shippedMissionDefinitions).toHaveLength(7);
    for (const m of c.shippedMissionDefinitions) {
      expect(typeof m.missionPriority).toBe("number");
      expect(SUBMARINE_MISSIONS).toContain(m.missionId as never);
    }
    expect(c.shippedMissionIds).toHaveLength(7);
  });

  it("fails closed on a tampered mission list or a tampered mission id", () => {
    expect(() =>
      validateSubmarineMissionsContract({
        ...SHIPPED_SUBMARINE_MISSIONS_CONTRACT,
        missions: [...SUBMARINE_MISSIONS, "MISSION_X"] as never,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateSubmarineMissionsContract({
        ...SHIPPED_SUBMARINE_MISSIONS_CONTRACT,
        shippedMissionDefinitions:
          SHIPPED_SUBMARINE_MISSIONS_CONTRACT.shippedMissionDefinitions.map((m, i) =>
            i === 0 ? { ...m, missionId: "MISSION_X" } : m,
          ),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on tampered §26.4 priorities (tie / wrong value)", () => {
    expect(() =>
      validateSubmarineMissionsContract({
        ...SHIPPED_SUBMARINE_MISSIONS_CONTRACT,
        shippedMissionDefinitions:
          SHIPPED_SUBMARINE_MISSIONS_CONTRACT.shippedMissionDefinitions.map((m, i) =>
            i === 1 ? { ...m, missionPriority: 1 } : m,
          ),
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateSubmarineMissionsContract({
        ...SHIPPED_SUBMARINE_MISSIONS_CONTRACT,
        shippedMissionDefinitions:
          SHIPPED_SUBMARINE_MISSIONS_CONTRACT.shippedMissionDefinitions.map((m, i) =>
            i === 0 ? { ...m, missionPriority: 99 } : m,
          ),
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered shipped-mission-id list and null contract", () => {
    expect(() =>
      validateSubmarineMissionsContract({
        ...SHIPPED_SUBMARINE_MISSIONS_CONTRACT,
        shippedMissionIds: [],
      }),
    ).toThrow(BluewaveError);
    expect(() => validateSubmarineMissionsContract(null)).toThrow(BluewaveError);
    expect(() => validateSubmarineMissionsContract(undefined)).toThrow(BluewaveError);
  });
});
