import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  INVALID_MINE_TYPE_DEFINITION,
  mineTypeDefinitionById,
  mineTypeDefinitionsContentVersion,
  MINE_TYPES,
  SHIPPED_MINE_TYPE_DEFINITIONS,
  type MineTypeDefinition,
  validateMineTypeDefinition,
  verifyMineTypeDefinitionContentHash,
  withMineTypeDefinitionContentHash,
} from "../../src/mines/index.js";

function validDefinition(overrides: Partial<MineTypeDefinition> = {}): MineTypeDefinition {
  const contact = mineTypeDefinitionById("CONTACT");
  const { contentHash: _ignored, ...surface } = contact;
  return withMineTypeDefinitionContentHash({ ...surface, ...overrides });
}

function brokenDefinition(mutate: (m: Record<string, unknown>) => void): MineTypeDefinition {
  const m = validDefinition() as unknown as Record<string, unknown>;
  mutate(m);
  return m as unknown as MineTypeDefinition;
}

function expectInvalid(build: () => MineTypeDefinition, field: string): BluewaveError {
  let err: BluewaveError | undefined;
  try {
    validateMineTypeDefinition(build());
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(INVALID_MINE_TYPE_DEFINITION);
  expect(err!.context.field).toBe(field);
  return err!;
}

describe("AC-2: MineTypeDefinition accepts every fully-specified type", () => {
  it("every shipped canonical type validates and carries content version + hash", () => {
    for (const def of SHIPPED_MINE_TYPE_DEFINITIONS) {
      expect(() => validateMineTypeDefinition(def)).not.toThrow();
      expect(def.contentVersion).toBe(mineTypeDefinitionsContentVersion);
      expect(def.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(verifyMineTypeDefinitionContentHash(def)).toBe(true);
    }
  });

  it("ships exactly the six canonical §2 mine types", () => {
    const ids = SHIPPED_MINE_TYPE_DEFINITIONS.map((d) => d.mineTypeId).sort();
    expect(ids).toEqual([...MINE_TYPES].sort());
  });

  it("content hash is deterministic: identical content -> identical hash", () => {
    const a = validDefinition();
    const b = validDefinition();
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash.length).toBe(64);
  });

  it("content hash changes when a field changes and verification fails on tamper", () => {
    const a = validDefinition();
    const b = validDefinition({ baseLayingValue: a.baseLayingValue + 1 });
    expect(b.contentHash).not.toBe(a.contentHash);
    const tampered = { ...a, baseLayingValue: a.baseLayingValue + 1 } as MineTypeDefinition;
    expect(verifyMineTypeDefinitionContentHash(tampered)).toBe(false);
  });
});

describe("AC-2: exact §9/§15/§21 shipped constants wired per type", () => {
  it("§9 sweep resistance: CONTACT flat 10_000", () => {
    expect(mineTypeDefinitionById("CONTACT").sweepResistance).toEqual({
      kind: "FLAT",
      valueBp: 10_000,
    });
  });

  it("§9 sweep resistance: MAGNETIC/ACOUSTIC capability-gated 10_000/7_500", () => {
    expect(mineTypeDefinitionById("MAGNETIC").sweepResistance).toEqual({
      kind: "CAPABILITY_GATED",
      withCapabilityBp: 10_000,
      withoutCapabilityBp: 7_500,
    });
    expect(mineTypeDefinitionById("ACOUSTIC").sweepResistance).toEqual({
      kind: "CAPABILITY_GATED",
      withCapabilityBp: 10_000,
      withoutCapabilityBp: 7_500,
    });
  });

  it("§9 sweep resistance: CONTROLLED_DEFENSIVE flat 5_000, SUBMARINE_LAID flat 9_000", () => {
    expect(mineTypeDefinitionById("CONTROLLED_DEFENSIVE").sweepResistance).toEqual({
      kind: "FLAT",
      valueBp: 5_000,
    });
    expect(mineTypeDefinitionById("SUBMARINE_LAID").sweepResistance).toEqual({
      kind: "FLAT",
      valueBp: 9_000,
    });
  });

  it("§9 sweep resistance: SCENARIO_SPECIAL is definition-required", () => {
    expect(mineTypeDefinitionById("SCENARIO_SPECIAL").sweepResistance).toEqual({
      kind: "DEFINITION_REQUIRED",
    });
  });

  it("§15 base severity weights total exactly 10_000 for every type", () => {
    for (const def of SHIPPED_MINE_TYPE_DEFINITIONS) {
      const w = def.strikeProfile.baseSeverityWeightsBp;
      expect(w.DUD_OR_NO_DAMAGE).toBe(1_500);
      expect(w.MINOR_DAMAGE).toBe(3_500);
      expect(w.MAJOR_DAMAGE).toBe(2_500);
      expect(w.MISSION_KILL).toBe(1_500);
      expect(w.SINKING).toBe(750);
      expect(w.SUNK).toBe(250);
      const total = Object.values(w).reduce((a, b) => a + b, 0);
      expect(total).toBe(10_000);
    }
  });

  it("§21 decay retention: CONTACT 9_750, MAGNETIC 9_500, ACOUSTIC 9_250, SUBMARINE_LAID 9_500", () => {
    expect(mineTypeDefinitionById("CONTACT").decayPolicy).toEqual({
      kind: "FLAT",
      retentionBp: 9_750,
      freshnessRetentionBp: null,
    });
    expect(mineTypeDefinitionById("MAGNETIC").decayPolicy).toEqual({
      kind: "FLAT",
      retentionBp: 9_500,
      freshnessRetentionBp: null,
    });
    expect(mineTypeDefinitionById("ACOUSTIC").decayPolicy).toEqual({
      kind: "FLAT",
      retentionBp: 9_250,
      freshnessRetentionBp: null,
    });
    expect(mineTypeDefinitionById("SUBMARINE_LAID").decayPolicy).toEqual({
      kind: "FLAT",
      retentionBp: 9_500,
      freshnessRetentionBp: null,
    });
  });

  it("§21 decay retention: CONTROLLED_DEFENSIVE infrastructure-gated 9_900/9_000", () => {
    expect(mineTypeDefinitionById("CONTROLLED_DEFENSIVE").decayPolicy).toEqual({
      kind: "INFRASTRUCTURE_GATED",
      operationalRetentionBp: 9_900,
      nonOperationalRetentionBp: 9_000,
      freshnessRetentionBp: null,
    });
  });

  it("§21 decay retention: SCENARIO_SPECIAL is definition-required", () => {
    expect(mineTypeDefinitionById("SCENARIO_SPECIAL").decayPolicy).toEqual({
      kind: "DEFINITION_REQUIRED",
    });
  });

  it("SUBMARINE_LAID ships as a data type only: eligible source is exactly MINELAYING_SUBMARINE", () => {
    expect(mineTypeDefinitionById("SUBMARINE_LAID").eligibleLayingSourceKinds).toEqual([
      "MINELAYING_SUBMARINE",
    ]);
  });
});

describe("AC-2: missing or invalid fields fail with INVALID_MINE_TYPE_DEFINITION", () => {
  it("rejects an unknown mineTypeId", () => {
    expectInvalid(
      () => validDefinition({ mineTypeId: "NUCLEAR" } as unknown as Partial<MineTypeDefinition>),
      "mineTypeId",
    );
  });

  it("rejects missing technologyPrerequisiteIds", () => {
    expectInvalid(
      () => brokenDefinition((m) => delete m.technologyPrerequisiteIds),
      "technologyPrerequisiteIds",
    );
  });

  it("rejects empty or unknown eligibleLayingSourceKinds", () => {
    expectInvalid(
      () => validDefinition({ eligibleLayingSourceKinds: [] }),
      "eligibleLayingSourceKinds",
    );
    expectInvalid(
      () =>
        validDefinition({
          eligibleLayingSourceKinds: [
            "UNKNOWN_SOURCE",
          ] as unknown as Partial<MineTypeDefinition>["eligibleLayingSourceKinds"],
        }),
      "eligibleLayingSourceKinds",
    );
  });

  it("rejects a non-integer or non-positive baseLayingValue", () => {
    expectInvalid(() => validDefinition({ baseLayingValue: 1.5 }), "baseLayingValue");
    expectInvalid(() => validDefinition({ baseLayingValue: 0 }), "baseLayingValue");
  });

  it("rejects a missing strikeProfile and a tampered §15 weight", () => {
    expectInvalid(() => brokenDefinition((m) => delete m.strikeProfile), "strikeProfile");
    expectInvalid(
      () =>
        validDefinition({
          strikeProfile: {
            baseSeverityWeightsBp: {
              DUD_OR_NO_DAMAGE: 1_501,
              MINOR_DAMAGE: 3_500,
              MAJOR_DAMAGE: 2_500,
              MISSION_KILL: 1_500,
              SINKING: 750,
              SUNK: 250,
            },
          },
        }),
      "strikeProfile.baseSeverityWeightsBp.DUD_OR_NO_DAMAGE",
    );
  });

  it("rejects empty or unknown targetEligibility", () => {
    expectInvalid(() => validDefinition({ targetEligibility: [] }), "targetEligibility");
    expectInvalid(
      () =>
        validDefinition({
          targetEligibility: [
            "AIRCRAFT",
          ] as unknown as Partial<MineTypeDefinition>["targetEligibility"],
        }),
      "targetEligibility",
    );
  });

  it("rejects an invalid sweepResistance shape", () => {
    expectInvalid(
      () =>
        validDefinition({
          sweepResistance: { kind: "FLAT", valueBp: 10_001 } as never,
        }),
      "sweepResistance.valueBp",
    );
    expectInvalid(
      () =>
        validDefinition({
          sweepResistance: { kind: "BOGUS" } as never,
        }),
      "sweepResistance.kind",
    );
  });

  it("rejects an invalid decayPolicy shape", () => {
    expectInvalid(
      () =>
        validDefinition({
          decayPolicy: { kind: "FLAT", retentionBp: -1, freshnessRetentionBp: null } as never,
        }),
      "decayPolicy.retentionBp",
    );
    expectInvalid(
      () =>
        validDefinition({
          decayPolicy: { kind: "BOGUS" } as never,
        }),
      "decayPolicy.kind",
    );
  });

  it("rejects a mismatched friendly-fire/battle-generation/report-signature policy id", () => {
    expectInvalid(() => validDefinition({ friendlyFirePolicyId: "x" }), "friendlyFirePolicyId");
    expectInvalid(
      () => validDefinition({ battleGenerationPolicyId: "x" }),
      "battleGenerationPolicyId",
    );
    expectInvalid(
      () => validDefinition({ reportSignaturePolicyId: "x" }),
      "reportSignaturePolicyId",
    );
  });

  it("rejects a missing contentVersion and a missing contentHash", () => {
    expectInvalid(() => brokenDefinition((m) => delete m.contentVersion), "contentVersion");
    expectInvalid(() => brokenDefinition((m) => delete m.contentHash), "contentHash");
  });
});

describe("AC-2: fail-closed type lookup", () => {
  it("mineTypeDefinitionById resolves every shipped type", () => {
    for (const def of SHIPPED_MINE_TYPE_DEFINITIONS) {
      expect(mineTypeDefinitionById(def.mineTypeId).mineTypeId).toBe(def.mineTypeId);
    }
  });

  it("mineTypeDefinitionById fails with INVALID_MINE_TYPE_DEFINITION on an unknown id (never a silent default)", () => {
    let err: BluewaveError | undefined;
    try {
      mineTypeDefinitionById("NUCLEAR");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_MINE_TYPE_DEFINITION);
  });
});
