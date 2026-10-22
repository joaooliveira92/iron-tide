import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  SUBMARINE_STATE_INVARIANT_FAILED,
  SUBMARINE_TYPES,
  type SubmarineTypeDefinition,
  SHIPPED_SUBMARINE_TYPE_DEFINITIONS,
  submarineTypeDefinitionById,
  submarineTypesPolicyId,
  validateSubmarineTypeDefinition,
  verifySubmarineTypeDefinitionContentHash,
  withSubmarineTypeDefinitionContentHash,
  strategicRepresentationForType,
} from "../../src/submarines/index.js";

function validDefinition(
  overrides: Partial<SubmarineTypeDefinition> = {},
): SubmarineTypeDefinition {
  const coastal = submarineTypeDefinitionById("COASTAL");
  const { contentHash: _ignored, ...surface } = coastal;
  return withSubmarineTypeDefinitionContentHash({ ...surface, ...overrides });
}

function brokenDefinition(mutate: (m: Record<string, unknown>) => void): SubmarineTypeDefinition {
  const m = validDefinition() as unknown as Record<string, unknown>;
  mutate(m);
  return m as unknown as SubmarineTypeDefinition;
}

function expectInvalid(build: () => SubmarineTypeDefinition, field: string): void {
  let err: BluewaveError | undefined;
  try {
    validateSubmarineTypeDefinition(build());
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
  expect(err!.context.field).toBe(field);
}

describe("AC-2: every canonical type validates with all §4 fields", () => {
  it("ships exactly the five canonical §4 types with content version + hash", () => {
    const ids = SHIPPED_SUBMARINE_TYPE_DEFINITIONS.map((d) => d.submarineTypeId).sort();
    expect(ids).toEqual([...SUBMARINE_TYPES].sort());
    expect([...SUBMARINE_TYPES]).toEqual([
      "COASTAL",
      "MEDIUM_RANGE",
      "LONG_RANGE",
      "MINELAYING",
      "MISSILE",
    ]);
    for (const def of SHIPPED_SUBMARINE_TYPE_DEFINITIONS) {
      expect(() => validateSubmarineTypeDefinition(def)).not.toThrow();
      expect(def.contentVersion).toBe(submarineTypesPolicyId);
      expect(def.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(verifySubmarineTypeDefinitionContentHash(def)).toBe(true);
    }
  });

  it("carries every §4 field (range class, profiles, eligibility, support, projection, tech)", () => {
    for (const def of SHIPPED_SUBMARINE_TYPE_DEFINITIONS) {
      expect(["SHORT", "MEDIUM", "LONG"]).toContain(def.rangeClass);
      expect(def.remoteEfficiencyProfileBp).toBeDefined();
      expect(def.aswVulnerabilityProfileBp).toBeDefined();
      expect(Array.isArray(def.missionEligibility) && def.missionEligibility.length > 0).toBe(true);
      expect(["REQUIRED", "OPTIONAL"]).toContain(def.baseSupportRequirement);
      expect(typeof def.tacticalProjectionId).toBe("string");
      expect(Array.isArray(def.technologyPrerequisiteIds)).toBe(true);
    }
  });

  it("content hash is deterministic and fails verification on tamper", () => {
    const a = validDefinition();
    const b = validDefinition();
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash.length).toBe(64);
    const tampered = { ...a, rangeClass: "LONG" as never } as SubmarineTypeDefinition;
    expect(verifySubmarineTypeDefinitionContentHash(tampered)).toBe(false);
    const changed = validDefinition({ tacticalProjectionId: "other_v1" });
    expect(changed.contentHash).not.toBe(a.contentHash);
  });
});

describe("AC-2: §1 type -> representation mapping", () => {
  it("MISSILE maps to PERSISTENT_UNIT; the other four to TYPED_FLOTILLA_POOL", () => {
    for (const def of SHIPPED_SUBMARINE_TYPE_DEFINITIONS) {
      const expected =
        def.submarineTypeId === "MISSILE" ? "PERSISTENT_UNIT" : "TYPED_FLOTILLA_POOL";
      expect(strategicRepresentationForType(def.submarineTypeId)).toBe(expected);
    }
  });
});

describe("AC-2: exact §9 remote-efficiency and §10 ASW-vulnerability tables", () => {
  it("§9 remote-efficiency profile per type is DESIGN-34-exact", () => {
    const coastal = submarineTypeDefinitionById("COASTAL").remoteEfficiencyProfileBp;
    expect([coastal.LOCAL, coastal.REGIONAL, coastal.REMOTE, coastal.EXTREME_REMOTE]).toEqual([
      10_000, 7_500, 2_500, 0,
    ]);
    const medium = submarineTypeDefinitionById("MEDIUM_RANGE").remoteEfficiencyProfileBp;
    expect([medium.LOCAL, medium.REGIONAL, medium.REMOTE, medium.EXTREME_REMOTE]).toEqual([
      10_000, 10_000, 7_500, 5_000,
    ]);
    const long = submarineTypeDefinitionById("LONG_RANGE").remoteEfficiencyProfileBp;
    expect([long.LOCAL, long.REGIONAL, long.REMOTE, long.EXTREME_REMOTE]).toEqual([
      10_000, 11_000, 12_500, 10_000,
    ]);
    const minelaying = submarineTypeDefinitionById("MINELAYING").remoteEfficiencyProfileBp;
    expect([
      minelaying.LOCAL,
      minelaying.REGIONAL,
      minelaying.REMOTE,
      minelaying.EXTREME_REMOTE,
    ]).toEqual([10_000, 10_000, 8_000, 5_000]);
    const missile = submarineTypeDefinitionById("MISSILE").remoteEfficiencyProfileBp;
    expect([missile.LOCAL, missile.REGIONAL, missile.REMOTE, missile.EXTREME_REMOTE]).toEqual([
      10_000, 10_000, 10_000, 9_000,
    ]);
  });

  it("§10 long-range ASW-vulnerability is DESIGN-34-exact; other types neutral 10_000", () => {
    const long = submarineTypeDefinitionById("LONG_RANGE").aswVulnerabilityProfileBp;
    expect([long.LOCAL, long.REGIONAL, long.REMOTE, long.EXTREME_REMOTE]).toEqual([
      10_500, 10_750, 11_000, 11_500,
    ]);
    for (const t of ["COASTAL", "MEDIUM_RANGE", "MINELAYING", "MISSILE"] as const) {
      const p = submarineTypeDefinitionById(t).aswVulnerabilityProfileBp;
      expect(Object.values(p)).toEqual([10_000, 10_000, 10_000, 10_000]);
    }
  });
});

describe("AC-2: missing or invalid fields fail with SUBMARINE_STATE_INVARIANT_FAILED", () => {
  it("rejects an unknown submarineTypeId", () => {
    expectInvalid(
      () =>
        validDefinition({
          submarineTypeId: "NUCLEAR",
        } as unknown as Partial<SubmarineTypeDefinition>),
      "submarineTypeId",
    );
  });

  it("rejects a missing rangeClass and a bogus rangeClass value", () => {
    expectInvalid(() => brokenDefinition((m) => delete m.rangeClass), "rangeClass");
    expectInvalid(
      () =>
        validDefinition({ rangeClass: "ULTRALONG" } as unknown as Partial<SubmarineTypeDefinition>),
      "rangeClass",
    );
  });

  it("rejects a tampered §9 remote-efficiency value", () => {
    expectInvalid(
      () =>
        validDefinition({
          remoteEfficiencyProfileBp: {
            LOCAL: 9_999,
            REGIONAL: 7_500,
            REMOTE: 2_500,
            EXTREME_REMOTE: 0,
          },
        }),
      "remoteEfficiencyProfileBp.LOCAL",
    );
  });

  it("rejects a tampered §10 ASW-vulnerability value for long range", () => {
    const long = submarineTypeDefinitionById("LONG_RANGE");
    const { contentHash: _ignored, ...surface } = long;
    expectInvalid(
      () =>
        withSubmarineTypeDefinitionContentHash({
          ...surface,
          aswVulnerabilityProfileBp: {
            LOCAL: 10_500,
            REGIONAL: 10_750,
            REMOTE: 11_001,
            EXTREME_REMOTE: 11_500,
          },
        }),
      "aswVulnerabilityProfileBp.REMOTE",
    );
  });

  it("rejects empty missionEligibility and a bogus base-support requirement", () => {
    expectInvalid(() => validDefinition({ missionEligibility: [] }), "missionEligibility");
    expectInvalid(
      () =>
        validDefinition({
          baseSupportRequirement: "MAYBE",
        } as unknown as Partial<SubmarineTypeDefinition>),
      "baseSupportRequirement",
    );
  });

  it("rejects a missing contentVersion and a missing contentHash", () => {
    expectInvalid(() => brokenDefinition((m) => delete m.contentVersion), "contentVersion");
    expectInvalid(() => brokenDefinition((m) => delete m.contentHash), "contentHash");
  });
});

describe("AC-2: fail-closed type lookup", () => {
  it("submarineTypeDefinitionById resolves every shipped type", () => {
    for (const def of SHIPPED_SUBMARINE_TYPE_DEFINITIONS) {
      expect(submarineTypeDefinitionById(def.submarineTypeId).submarineTypeId).toBe(
        def.submarineTypeId,
      );
    }
  });

  it("submarineTypeDefinitionById fails on an unknown id (never silent default)", () => {
    let err: BluewaveError | undefined;
    try {
      submarineTypeDefinitionById("NUCLEAR");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
  });
});
