import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  INVALID_SUBMARINE_REPRESENTATION,
  STRATEGIC_REPRESENTATIONS,
  SUBMARINE_TYPES,
  type SubmarineStrategicAsset,
  validateSubmarineStrategicAsset,
  withSubmarineStrategicAssetAggregateHash,
  verifySubmarineStrategicAssetAggregateHash,
  strategicRepresentationForType,
} from "@bluewave/combat/submarines";

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

function validAsset(): SubmarineStrategicAsset {
  return withSubmarineStrategicAssetAggregateHash(baseAsset());
}

function brokenAsset(mutate: (a: Record<string, unknown>) => void): SubmarineStrategicAsset {
  const a = validAsset() as unknown as Record<string, unknown>;
  mutate(a);
  return a as unknown as SubmarineStrategicAsset;
}

function expectInvalidRepresentation(build: () => SubmarineStrategicAsset, field: string): void {
  let err: BluewaveError | undefined;
  try {
    validateSubmarineStrategicAsset(build());
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(INVALID_SUBMARINE_REPRESENTATION);
  expect(err!.context.field).toBe(field);
}

describe("AC-1: strategic representation vocabulary", () => {
  it("declares exactly the two canonical representations", () => {
    expect([...STRATEGIC_REPRESENTATIONS]).toEqual(["PERSISTENT_UNIT", "TYPED_FLOTILLA_POOL"]);
  });

  it("maps §1: MISSILE -> PERSISTENT_UNIT, the rest -> TYPED_FLOTILLA_POOL", () => {
    expect(strategicRepresentationForType("MISSILE")).toBe("PERSISTENT_UNIT");
    for (const t of ["COASTAL", "MEDIUM_RANGE", "LONG_RANGE", "MINELAYING"] as const) {
      expect(strategicRepresentationForType(t)).toBe("TYPED_FLOTILLA_POOL");
    }
  });
});

describe("AC-1: a valid asset with the full §1 field set validates", () => {
  it("validates a flotilla-pool asset and carries a deterministic aggregate hash", () => {
    const a = validAsset();
    expect(() => validateSubmarineStrategicAsset(a)).not.toThrow();
    expect(a.representation).toBe("TYPED_FLOTILLA_POOL");
    expect(a.aggregateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifySubmarineStrategicAssetAggregateHash(a)).toBe(true);
  });

  it("validates a persistent-unit asset with quantity exactly 1", () => {
    const a = withSubmarineStrategicAssetAggregateHash(
      baseAsset({
        submarineTypeId: "MISSILE",
        representation: "PERSISTENT_UNIT",
        quantity: SafeInt(1),
      }),
    );
    expect(() => validateSubmarineStrategicAsset(a)).not.toThrow();
    expect(verifySubmarineStrategicAssetAggregateHash(a)).toBe(true);
  });

  it("aggregate hash is deterministic: identical state -> identical hash", () => {
    const a = validAsset();
    const b = validAsset();
    expect(a.aggregateHash).toBe(b.aggregateHash);
    expect(a.aggregateHash.length).toBe(64);
  });

  it("aggregate hash changes when a field changes; tamper fails verification", () => {
    const a = validAsset();
    const b = withSubmarineStrategicAssetAggregateHash(baseAsset({ readiness: SafeInt(81) }));
    expect(b.aggregateHash).not.toBe(a.aggregateHash);
    const tampered = { ...a, reliability: SafeInt(71) } as SubmarineStrategicAsset;
    expect(verifySubmarineStrategicAssetAggregateHash(tampered)).toBe(false);
  });
});

describe("AC-1: missing or mixed representation fails with INVALID_SUBMARINE_REPRESENTATION", () => {
  it("rejects a MISSING representation (field absent)", () => {
    expectInvalidRepresentation(
      () => brokenAsset((a) => delete a.representation),
      "representation",
    );
  });

  it("rejects a MIXED / non-canonical representation value", () => {
    expectInvalidRepresentation(
      () =>
        brokenAsset((a) => {
          a.representation = "BOTH";
        }),
      "representation",
    );
    expectInvalidRepresentation(
      () =>
        brokenAsset((a) => {
          a.representation = "PERSISTENT_UNIT_AND_POOL";
        }),
      "representation",
    );
  });

  it("rejects a persistent unit whose quantity is not exactly 1 (§1 rule)", () => {
    expectInvalidRepresentation(
      () =>
        withSubmarineStrategicAssetAggregateHash(
          baseAsset({
            submarineTypeId: "MISSILE",
            representation: "PERSISTENT_UNIT",
            quantity: SafeInt(2),
          }),
        ),
      "quantity",
    );
  });
});

describe("AC-1: §1 type→representation coherence (shipped mapping pinned at the boundary)", () => {
  it("rejects a non-missile type carrying PERSISTENT_UNIT (mapping mismatch)", () => {
    for (const t of ["COASTAL", "MEDIUM_RANGE", "LONG_RANGE", "MINELAYING"] as const) {
      expectInvalidRepresentation(
        () =>
          withSubmarineStrategicAssetAggregateHash(
            baseAsset({
              submarineTypeId: t,
              representation: "PERSISTENT_UNIT",
              quantity: SafeInt(1),
            }),
          ),
        "representation",
      );
    }
  });

  it("rejects MISSILE carrying TYPED_FLOTILLA_POOL (mapping mismatch)", () => {
    expectInvalidRepresentation(
      () =>
        withSubmarineStrategicAssetAggregateHash(
          baseAsset({ submarineTypeId: "MISSILE", representation: "TYPED_FLOTILLA_POOL" }),
        ),
      "representation",
    );
  });

  it("accepts every type with its §1 mapped representation", () => {
    for (const t of SUBMARINE_TYPES) {
      const representation = strategicRepresentationForType(t);
      const quantity = representation === "PERSISTENT_UNIT" ? SafeInt(1) : SafeInt(3);
      const a = withSubmarineStrategicAssetAggregateHash(
        baseAsset({ submarineTypeId: t, representation, quantity }),
      );
      expect(() => validateSubmarineStrategicAsset(a)).not.toThrow();
      expect(verifySubmarineStrategicAssetAggregateHash(a)).toBe(true);
    }
  });
});

describe("AC-1: boundary cases on the remaining §1 fields", () => {
  it("rejects a flotilla-pool asset with quantity < 1", () => {
    expectInvalidRepresentation(
      () => withSubmarineStrategicAssetAggregateHash(baseAsset({ quantity: SafeInt(0) })),
      "quantity",
    );
  });

  it("rejects an unknown submarine type", () => {
    expectInvalidRepresentation(
      () =>
        withSubmarineStrategicAssetAggregateHash(
          baseAsset({ submarineTypeId: "NUCLEAR" } as unknown as Partial<SubmarineStrategicAsset>),
        ),
      "submarineTypeId",
    );
  });

  it("rejects an empty assetId / owner nation / area / home base", () => {
    expectInvalidRepresentation(
      () => withSubmarineStrategicAssetAggregateHash(baseAsset({ assetId: "" })),
      "assetId",
    );
    expectInvalidRepresentation(
      () => withSubmarineStrategicAssetAggregateHash(baseAsset({ ownerNationId: "" })),
      "ownerNationId",
    );
    expectInvalidRepresentation(
      () => withSubmarineStrategicAssetAggregateHash(baseAsset({ currentStrategicAreaId: "" })),
      "currentStrategicAreaId",
    );
    expectInvalidRepresentation(
      () => withSubmarineStrategicAssetAggregateHash(baseAsset({ homeBaseId: "" })),
      "homeBaseId",
    );
  });

  it("rejects reliability outside [0, 100] (DESIGN-34 §7 range)", () => {
    expectInvalidRepresentation(
      () => withSubmarineStrategicAssetAggregateHash(baseAsset({ reliability: SafeInt(101) })),
      "reliability",
    );
    expectInvalidRepresentation(
      () => withSubmarineStrategicAssetAggregateHash(baseAsset({ reliability: SafeInt(-1) })),
      "reliability",
    );
  });

  it("rejects a non-canonical §5 mission policy", () => {
    expectInvalidRepresentation(
      () =>
        withSubmarineStrategicAssetAggregateHash(
          baseAsset({ missionPolicyId: "BOGUS" } as unknown as Partial<SubmarineStrategicAsset>),
        ),
      "missionPolicyId",
    );
  });

  it("rejects a missing aggregate hash at full validation", () => {
    let err: BluewaveError | undefined;
    try {
      validateSubmarineStrategicAsset(brokenAsset((a) => delete a.aggregateHash));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_SUBMARINE_REPRESENTATION);
    expect(err!.context.field).toBe("aggregateHash");
  });
});
