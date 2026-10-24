import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  validateAirDefenseContract,
  validateAaDirectorScalingContract,
  validateRadarSaturationContract,
  validateCiwsRedundancyContract,
  makeValidAirDefensePolicy_v1,
  makeValidAaDirectorScalingPolicy_v1,
  makeValidRadarSaturationPolicy_v1,
  makeValidCiwsRedundancyPolicy_v1,
  validateAllAirDefenseContracts,
  SHIPPED_AIR_DEFENSE_CONTRACTS,
  AIR_DEFENSE_CONTRACT_POLICY_ID,
  AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID,
  AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
  AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
  AIR_DEFENSE_INVARIANT_FAILED,
  AIR_DEFENSE_SHIPPED_REASON_CODE_LIST,
  AIR_DEFENSE_SYSTEM_DEFINITION_FIELD_KEYS,
  ENGAGEMENT_FACTOR_SLOT_NAMES,
  DISRUPTION_MULTIPLIERS,
  DisruptionMultipliers_v1,
  AirDefensePolicy_v1,
  AaDirectorScalingPolicy_v1,
  RadarSaturationPolicy_v1,
  CiwsRedundancyPolicy_v1,
} from "@bluewave/combat/air-defense";

const AIR_DEFENSE_CONTRACTS_GOLDEN_HASH =
  "92d3008abba718f0198180411ebd410b2beebbf25209426bf0ad1396622679e9";

describe("AC-17: versioned air-defense contracts", () => {
  describe("air_defense_v1", () => {
    it("validates the shipped manifest", () => {
      expect(validateAirDefenseContract(makeValidAirDefensePolicy_v1()).policyId).toBe(
        AIR_DEFENSE_CONTRACT_POLICY_ID,
      );
    });

    it("rejects a wrong rulesetVersion", () => {
      expect(() =>
        validateAirDefenseContract({
          ...makeValidAirDefensePolicy_v1(),
          rulesetVersion: "air_defense_v2",
        }),
      ).toThrow(BluewaveError);
    });

    it("rejects a wrong basisPoints value", () => {
      expect(() =>
        validateAirDefenseContract({
          ...makeValidAirDefensePolicy_v1(),
          basisPoints: 100,
        }),
      ).toThrow(BluewaveError);
    });

    it("rejects a truncated layer order", () => {
      const valid = makeValidAirDefensePolicy_v1();
      expect(() =>
        validateAirDefenseContract({ ...valid, layerOrder: valid.layerOrder.slice(0, 4) }),
      ).toThrow(BluewaveError);
    });

    it("rejects a reordered layer order (tuple positions are significant)", () => {
      const valid = makeValidAirDefensePolicy_v1();
      const reordered = [...valid.layerOrder];
      const first = reordered[0];
      reordered[0] = reordered[1];
      reordered[1] = first;
      expect(() => validateAirDefenseContract({ ...valid, layerOrder: reordered })).toThrow(
        BluewaveError,
      );
    });

    it("rejects a mismatched reason-code catalog (one code swapped)", () => {
      const valid = makeValidAirDefensePolicy_v1();
      const tampered: string[] = [...valid.reasonCodes];
      tampered[19] = "NOT_A_SHIPPED_CODE";
      expect(() => validateAirDefenseContract({ ...valid, reasonCodes: tampered })).toThrow(
        BluewaveError,
      );
    });

    it("rejects an extra system-definition field key", () => {
      const valid = makeValidAirDefensePolicy_v1();
      expect(() =>
        validateAirDefenseContract({
          ...valid,
          systemDefinitionFieldKeys: [...valid.systemDefinitionFieldKeys, "extraField"],
        }),
      ).toThrow(BluewaveError);
    });

    it("rejects an unknown top-level key (previously Zod .strict())", () => {
      expect(() =>
        validateAirDefenseContract({
          ...makeValidAirDefensePolicy_v1(),
          unmodeledKey: true,
        }),
      ).toThrow(BluewaveError);
    });

    it("rejects an unknown nested key in disruptionMultipliers (previously Zod .strict())", () => {
      const valid = makeValidAirDefensePolicy_v1();
      expect(() =>
        validateAirDefenseContract({
          ...valid,
          disruptionMultipliers: { ...valid.disruptionMultipliers, UNMODELED: {} },
        }),
      ).toThrow(BluewaveError);
    });

    it("rejects an unknown key inside a nested disruption severity object", () => {
      const valid = makeValidAirDefensePolicy_v1();
      expect(() =>
        validateAirDefenseContract({
          ...valid,
          disruptionMultipliers: {
            ...valid.disruptionMultipliers,
            LIGHT: { ...valid.disruptionMultipliers.LIGHT, unmodeled: 1 },
          },
        }),
      ).toThrow(BluewaveError);
    });

    it("validateAirDefenseContract passes the shipped manifest", () => {
      expect(validateAirDefenseContract(makeValidAirDefensePolicy_v1()).policyId).toBe(
        AIR_DEFENSE_CONTRACT_POLICY_ID,
      );
    });

    it("validateAirDefenseContract throws BluewaveError tagged AIR_DEFENSE_INVARIANT_FAILED", () => {
      let caught: BluewaveError | null = null;
      try {
        validateAirDefenseContract({});
      } catch (error) {
        caught = error as BluewaveError;
      }
      expect(isBluewaveError(caught)).toBe(true);
      expect(caught?.context.code).toBe(AIR_DEFENSE_INVARIANT_FAILED);
    });

    it("preserves the error contract while rejecting excess properties", () => {
      let caught: BluewaveError | null = null;
      try {
        validateAirDefenseContract({ ...makeValidAirDefensePolicy_v1(), unmodeled: 1 });
      } catch (error) {
        caught = error as BluewaveError;
      }

      expect(isBluewaveError(caught)).toBe(true);
      expect(caught?.message).toBe(`${AIR_DEFENSE_CONTRACT_POLICY_ID} contract validation failed`);
      expect(caught?.context.code).toBe(AIR_DEFENSE_INVARIANT_FAILED);
      expect(caught?.context.policyId).toBe(AIR_DEFENSE_CONTRACT_POLICY_ID);
      expect(caught?.context.field).toBe("unmodeled");
      expect(caught?.context.reason).toBe("Expected no excess property");
      expect(caught?.context.issues).toEqual([
        { path: "unmodeled", message: "Expected no excess property" },
      ]);
      expect("value" in (caught?.context ?? {})).toBe(false);
    });
  });

  describe("aa_director_scaling_v1", () => {
    it("validates the shipped scaling table and cap", () => {
      expect(
        validateAaDirectorScalingContract(makeValidAaDirectorScalingPolicy_v1()).policyId,
      ).toBe(AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID);
    });

    it("rejects a wrong normalScalingCap literal", () => {
      expect(() =>
        validateAaDirectorScalingContract({
          ...makeValidAaDirectorScalingPolicy_v1(),
          normalScalingCap: 3,
        }),
      ).toThrow(BluewaveError);
    });

    it("rejects a tampered table row value", () => {
      const valid = makeValidAaDirectorScalingPolicy_v1();
      const rows = valid.scalingTable.map((row: readonly [number, number]) => [...row]);
      rows[0] = [0, 9_999];
      expect(() => validateAaDirectorScalingContract({ ...valid, scalingTable: rows })).toThrow(
        BluewaveError,
      );
    });

    it("rejects a reordered pair row (pair positions are significant)", () => {
      const valid = makeValidAaDirectorScalingPolicy_v1();
      const rows = valid.scalingTable.map((row: readonly [number, number]) => [...row]);
      const [a, b] = rows[0];
      rows[0] = [b, a];
      expect(() => validateAaDirectorScalingContract({ ...valid, scalingTable: rows })).toThrow(
        BluewaveError,
      );
    });

    it("validateAaDirectorScalingContract fail-closed", () => {
      expect(() =>
        validateAaDirectorScalingContract(makeValidAaDirectorScalingPolicy_v1()),
      ).not.toThrow();
      expect(() => validateAaDirectorScalingContract({ normalScalingCap: 7 })).toThrow(
        BluewaveError,
      );
    });
  });

  describe("radar_saturation_v1", () => {
    it("validates the shipped §14 marginal schedule", () => {
      expect(validateRadarSaturationContract(makeValidRadarSaturationPolicy_v1()).policyId).toBe(
        AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
      );
    });

    it("rejects a wrong §14 marginal value", () => {
      const valid = makeValidRadarSaturationPolicy_v1();
      const rows = valid.saturationTable.map((row: readonly [number, number]) => [...row]);
      rows[0] = [1, 9_000];
      expect(() => validateRadarSaturationContract({ ...valid, saturationTable: rows })).toThrow(
        BluewaveError,
      );
    });

    it("validateRadarSaturationContract fail-closed", () => {
      expect(() =>
        validateRadarSaturationContract(makeValidRadarSaturationPolicy_v1()),
      ).not.toThrow();
      expect(() => validateRadarSaturationContract({ saturationTable: [] })).toThrow(BluewaveError);
    });
  });

  describe("ciws_redundancy_v1", () => {
    it("validates the shipped §16 marginal schedule", () => {
      expect(validateCiwsRedundancyContract(makeValidCiwsRedundancyPolicy_v1()).policyId).toBe(
        AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
      );
    });

    it("rejects a wrong §16 marginal value", () => {
      const valid = makeValidCiwsRedundancyPolicy_v1();
      const rows = valid.redundancyTable.map((row: readonly [number, number]) => [...row]);
      rows[1] = [2, 9_000];
      expect(() => validateCiwsRedundancyContract({ ...valid, redundancyTable: rows })).toThrow(
        BluewaveError,
      );
    });

    it("validateCiwsRedundancyContract fail-closed", () => {
      expect(() =>
        validateCiwsRedundancyContract(makeValidCiwsRedundancyPolicy_v1()),
      ).not.toThrow();
      expect(() => validateCiwsRedundancyContract({ redundancyTable: [[1, 10_000]] })).toThrow(
        BluewaveError,
      );
    });
  });

  describe("registry (contractRollup)", () => {
    it("ships exactly 4 contracts in canonical order", () => {
      expect(SHIPPED_AIR_DEFENSE_CONTRACTS.map((e) => e.policyId)).toEqual([
        AIR_DEFENSE_CONTRACT_POLICY_ID,
        AIR_DEFENSE_DIRECTOR_SCALING_POLICY_ID,
        AIR_DEFENSE_RADAR_SATURATION_POLICY_ID,
        AIR_DEFENSE_CIWS_REDUNDANCY_POLICY_ID,
      ]);
    });

    it("validateAllAirDefenseContracts passes every shipped contract through its own validator", () => {
      expect(() => validateAllAirDefenseContracts()).not.toThrow();
    });
  });

  describe("shipped manifest content (pinned literals)", () => {
    const valid = makeValidAirDefensePolicy_v1();

    it("pins the 8-layer §1 order and the 4-layer AA subset", () => {
      expect(valid.layerOrder).toEqual([
        "CAP",
        "HEAVY_SAM",
        "MEDIUM_SAM",
        "LIGHT_SAM",
        "HEAVY_AA",
        "MEDIUM_AA",
        "LIGHT_AA",
        "CIWS_TERMINAL_DEFENSE",
      ]);
      expect(valid.aaLayerOrder).toEqual([
        "HEAVY_AA",
        "MEDIUM_AA",
        "LIGHT_AA",
        "CIWS_TERMINAL_DEFENSE",
      ]);
    });

    it("pins the §19 nine-factor order", () => {
      expect(valid.factorKeys).toEqual([...ENGAGEMENT_FACTOR_SLOT_NAMES]);
    });

    it("pins the §28 reason-code catalog to the exact 20 shipped codes", () => {
      expect(valid.reasonCodes).toEqual([...AIR_DEFENSE_SHIPPED_REASON_CODE_LIST]);
    });

    it("pins the §3 system-definition schema key surface", () => {
      expect(valid.systemDefinitionFieldKeys).toEqual([
        ...AIR_DEFENSE_SYSTEM_DEFINITION_FIELD_KEYS,
      ]);
    });

    it("pins the §6 disruption multipliers to the shipped constant pairs", () => {
      const expected = Object.fromEntries(
        Object.entries(DISRUPTION_MULTIPLIERS).map(([severity, pair]) => [severity, pair]),
      );
      expect(valid.disruptionMultipliers).toEqual(expected);
    });

    it("pins the §29.8 guaranteed light-AA policy to exactly one authoritative substep", () => {
      expect(valid.guaranteedLightAaDisruption).toEqual({ exactlyOneAuthoritativeSubstep: 1 });
    });

    it("pins the §7 protected radius, §8 fire-control minimum, and §21 local-control multiplier", () => {
      expect(valid.protectedRadiusNm).toBe(5);
      expect(valid.protectedRadiusM).toBe(9_260);
      expect(valid.mediumAaFireControlMinimumBp).toBe(4_000);
      expect(valid.localControlMultiplierBp).toBe(5_000);
    });

    it("pins the §19 formula constants (10_000^8, floor once)", () => {
      expect(valid.formulaDenominator).toBe(10_000);
      expect(valid.formulaExponent).toBe(8);
      expect(valid.floorOnce).toBe(true);
    });
  });

  describe("pinned contract golden hash (module golden, INC-5)", () => {
    it("the canonical serialization of the 4 shipped contracts matches the pinned hash", () => {
      const body = SHIPPED_AIR_DEFENSE_CONTRACTS.map((entry) => ({
        policyId: entry.policyId,
        shippedContract: entry.shippedContract,
      }));
      const envelope = createEnvelope("air-defense-contracts", "inc5", body);
      expect(envelope.bodyHash).toBe(AIR_DEFENSE_CONTRACTS_GOLDEN_HASH);
    });
  });

  describe("public surface parity (12-F1)", () => {
    it("exports the five pre-migration policy schemas", () => {
      for (const schema of [
        DisruptionMultipliers_v1,
        AirDefensePolicy_v1,
        AaDirectorScalingPolicy_v1,
        RadarSaturationPolicy_v1,
        CiwsRedundancyPolicy_v1,
      ]) {
        expect(schema).toBeDefined();
      }
    });

    it("the exported schemas decode the shipped values", () => {
      expect(() =>
        Schema.decodeUnknownSync(AirDefensePolicy_v1)(makeValidAirDefensePolicy_v1()),
      ).not.toThrow();
      expect(() =>
        Schema.decodeUnknownSync(AaDirectorScalingPolicy_v1)(makeValidAaDirectorScalingPolicy_v1()),
      ).not.toThrow();
      expect(() =>
        Schema.decodeUnknownSync(RadarSaturationPolicy_v1)(makeValidRadarSaturationPolicy_v1()),
      ).not.toThrow();
      expect(() =>
        Schema.decodeUnknownSync(CiwsRedundancyPolicy_v1)(makeValidCiwsRedundancyPolicy_v1()),
      ).not.toThrow();
      expect(() =>
        Schema.decodeUnknownSync(DisruptionMultipliers_v1)(DISRUPTION_MULTIPLIERS),
      ).not.toThrow();
    });

    it("strictness stays with validate*Contract, not the exported AST", () => {
      const withExcess = { ...makeValidAirDefensePolicy_v1(), unexpected: true };
      expect(() => Schema.decodeUnknownSync(AirDefensePolicy_v1)(withExcess)).not.toThrow();
      expect(() => validateAirDefenseContract(withExcess)).toThrow(BluewaveError);
    });
  });
});
