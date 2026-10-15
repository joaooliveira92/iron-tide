// AC-24 seeds (INC-1): `mine_type_definitions_v1` SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT
// + validate guard fail-closed on tampering; exact shipped §9/§15/§21 integers;
// the shipped six-type set.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  INVALID_MINE_TYPE_DEFINITION,
  MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP,
  MINE_TYPES,
  mineTypeDefinitionsPolicyId,
  SHIPPED_MINE_TYPE_DEFINITIONS,
  SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
  validateMineTypeDefinitionsContract,
} from "../../src/mines/index.js";

describe("AC-24: mine_type_definitions_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT", () => {
    expect(mineTypeDefinitionsPolicyId).toBe("mine_type_definitions_v1");
    expect(SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT.policyId).toBe("mine_type_definitions_v1");
  });

  it("validates the shipped contract without throwing", () => {
    expect(() =>
      validateMineTypeDefinitionsContract(SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT),
    ).not.toThrow();
  });

  it("fails closed on a mismatched policy id", () => {
    let err: BluewaveError | undefined;
    try {
      validateMineTypeDefinitionsContract({
        ...SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        policyId: "x",
      });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(INVALID_MINE_TYPE_DEFINITION);
  });

  it("fails closed on a tampered basis-point scale", () => {
    expect(() =>
      validateMineTypeDefinitionsContract({
        ...SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        basisPointsPerUnit: 999,
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §2 mine-type closed enum", () => {
    expect(() =>
      validateMineTypeDefinitionsContract({
        ...SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        mineTypes: [...MINE_TYPES, "NUCLEAR"] as never,
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered §15 base severity weight", () => {
    expect(() =>
      validateMineTypeDefinitionsContract({
        ...SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        strikeBaseSeverityWeightsBp: {
          ...MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP,
          SUNK: 251,
        },
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered policy id (friendly-fire / battle-generation / report-signature)", () => {
    expect(() =>
      validateMineTypeDefinitionsContract({
        ...SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        friendlyFirePolicyId: "x",
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateMineTypeDefinitionsContract({
        ...SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        battleGenerationPolicyId: "x",
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateMineTypeDefinitionsContract({
        ...SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        reportSignaturePolicyId: "x",
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered shipped-mine-type-id list", () => {
    expect(() =>
      validateMineTypeDefinitionsContract({
        ...SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT,
        shippedMineTypeIds: [],
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing contract", () => {
    expect(() => validateMineTypeDefinitionsContract(null)).toThrow(BluewaveError);
    expect(() => validateMineTypeDefinitionsContract(undefined)).toThrow(BluewaveError);
  });
});

describe("AC-24: exact shipped constant surface", () => {
  it("ships the closed §2 mine-type enum with exactly six values", () => {
    expect([...MINE_TYPES]).toEqual([
      "CONTACT",
      "MAGNETIC",
      "ACOUSTIC",
      "CONTROLLED_DEFENSIVE",
      "SUBMARINE_LAID",
      "SCENARIO_SPECIAL",
    ]);
  });

  it("ships the exact §15 base severity weights totaling 10_000", () => {
    expect(MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP).toEqual({
      DUD_OR_NO_DAMAGE: 1_500,
      MINOR_DAMAGE: 3_500,
      MAJOR_DAMAGE: 2_500,
      MISSION_KILL: 1_500,
      SINKING: 750,
      SUNK: 250,
    });
    const total = Object.values(MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP).reduce((a, b) => a + b, 0);
    expect(total).toBe(10_000);
  });

  it("ships the shipped six-type MineTypeDefinition set with deterministic hashes", () => {
    expect(SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT.shippedMineTypeIds).toEqual(
      SHIPPED_MINE_TYPE_DEFINITIONS.map((d) => d.mineTypeId),
    );
    for (const def of SHIPPED_MINE_TYPE_DEFINITIONS) {
      expect(def.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
