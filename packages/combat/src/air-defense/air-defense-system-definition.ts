import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { Result, Schema } from "effect";
import { formatContractIssues } from "../schema-issues.js";
import { AIR_DEFENSE_MODEL_VERSION, INVALID_AIR_DEFENSE_SYSTEM_DEFINITION } from "./constants.js";

export const AIR_DEFENSE_RULESET_VERSION = "air_defense_v1" as const;

export const AIR_DEFENSE_SYSTEM_DEFINITION_FIELD_KEYS = [
  "systemId",
  "layer",
  "category",
  "mountCount",
  "barrels",
  "rangeMinM",
  "rangeMaxM",
  "altitudeMinM",
  "altitudeMaxM",
  "targetSpeedLimitMps",
  "arcDegreesMax",
  "profileEligibility",
  "fireControl",
  "radar",
  "engagementChannels",
  "baseKillBp",
  "baseDamageBp",
  "baseAbortBp",
  "baseDisruptionBp",
  "rate",
  "roundsPerEngagement",
  "magazineCapacity",
  "localControlSupported",
  "saturationGroup",
  "contentVersion",
  "contentHash",
] as const;

export const Layer = {
  HEAVY_AA: "HEAVY_AA" as const,
  MEDIUM_AA: "MEDIUM_AA" as const,
  LIGHT_AA: "LIGHT_AA" as const,
  CIWS_TERMINAL_DEFENSE: "CIWS_TERMINAL_DEFENSE" as const,
} as const;

export type LayerId = (typeof Layer)[keyof typeof Layer];

export const Category = {
  HEAVY_AA: "HEAVY_AA" as const,
  MEDIUM_AA: "MEDIUM_AA" as const,
  LIGHT_AA: "LIGHT_AA" as const,
  CIWS_TERMINAL_DEFENSE: "CIWS_TERMINAL_DEFENSE" as const,
} as const;

export type CategoryId = (typeof Category)[keyof typeof Category];

const LayerLiteral = Schema.Literals([
  "HEAVY_AA",
  "MEDIUM_AA",
  "LIGHT_AA",
  "CIWS_TERMINAL_DEFENSE",
]);
const CategoryLiteral = Schema.Literals([
  "HEAVY_AA",
  "MEDIUM_AA",
  "LIGHT_AA",
  "CIWS_TERMINAL_DEFENSE",
]);

function safeIntSchema(
  message: string,
  opts?: { min?: number; max?: number; nonNegative?: boolean; positive?: boolean },
) {
  return Schema.Finite.check(
    Schema.makeFilter((val: number) => {
      if (!SafeInt.isSafeInt(val)) return message;
      if (opts?.positive && !(val > 0)) return message;
      if (opts?.nonNegative && !(val >= 0)) return message;
      if (opts?.min !== undefined && val < opts.min) return message;
      if (opts?.max !== undefined && val > opts.max) return message;
      return undefined;
    }),
  );
}

export interface AirDefenseSystemDefinition {
  systemId: string;
  layer: LayerId;
  category: CategoryId;
  mountCount: SafeInt;
  barrels: SafeInt;
  rangeMinM: SafeInt;
  rangeMaxM: SafeInt;
  altitudeMinM: SafeInt;
  altitudeMaxM: SafeInt;
  targetSpeedLimitMps: SafeInt;
  arcDegreesMax: SafeInt;
  profileEligibility: ReadonlySet<string>;
  fireControl: {
    trackingRangeM: SafeInt;
    maxElevationDegrees: SafeInt;
    updateRateHz: SafeInt;
  };
  radar: {
    frequencyBand: "S" | "X" | "K" | "Ka";
    peakPowerW: SafeInt;
    maxRangeM: SafeInt;
    resolutionDegrees: SafeInt;
  };
  engagementChannels: ReadonlySet<string>;
  baseKillBp: SafeInt;
  baseDamageBp: SafeInt;
  baseAbortBp: SafeInt;
  baseDisruptionBp: SafeInt;
  rate: SafeInt;
  roundsPerEngagement: SafeInt;
  magazineCapacity: SafeInt;
  localControlSupported: boolean;
  saturationGroup: SafeInt;
  contentVersion: string;
  contentHash: string;
}

const AirDefenseSystemDefinitionSchema = Schema.Struct({
  systemId: Schema.String.check(
    Schema.isMinLength(1, { message: "systemId must be a non-empty string" }),
  ),

  layer: LayerLiteral,

  category: CategoryLiteral,

  mountCount: safeIntSchema("mountCount must be a non-negative integer", { nonNegative: true }),

  barrels: safeIntSchema("barrels must be a positive integer", { positive: true }),

  rangeMinM: safeIntSchema("rangeMinM must be a non-negative integer", { nonNegative: true }),

  rangeMaxM: safeIntSchema("rangeMaxM must be a positive integer", { positive: true }),

  altitudeMinM: safeIntSchema("altitudeMinM must be a non-negative integer", {
    nonNegative: true,
  }),

  altitudeMaxM: safeIntSchema("altitudeMaxM must be a non-negative integer", {
    nonNegative: true,
  }),

  targetSpeedLimitMps: safeIntSchema("targetSpeedLimitMps must be a non-negative integer", {
    nonNegative: true,
  }),

  arcDegreesMax: safeIntSchema("arcDegreesMax must be 0-360", { min: 0, max: 360 }),

  profileEligibility: Schema.ReadonlySet(Schema.String).check(
    Schema.isMinSize(1, { message: "profileEligibility must not be empty" }),
  ),

  fireControl: Schema.Struct({
    trackingRangeM: safeIntSchema("trackingRangeM must be a non-negative integer", {
      nonNegative: true,
    }),
    maxElevationDegrees: safeIntSchema("maxElevationDegrees must be 0-90", { min: 0, max: 90 }),
    updateRateHz: safeIntSchema("updateRateHz must be a positive integer", { positive: true }),
  }),

  radar: Schema.Struct({
    frequencyBand: Schema.Literals(["S", "X", "K", "Ka"]),
    peakPowerW: safeIntSchema("peakPowerW must be a non-negative integer", { nonNegative: true }),
    maxRangeM: safeIntSchema("maxRangeM must be a positive integer", { positive: true }),
    resolutionDegrees: safeIntSchema("resolutionDegrees must be a positive integer", {
      positive: true,
    }),
  }),

  engagementChannels: Schema.ReadonlySet(Schema.String).check(
    Schema.isMinSize(1, { message: "engagementChannels must not be empty" }),
  ),

  baseKillBp: Schema.optional(
    safeIntSchema("baseKillBp must be a non-negative integer", { nonNegative: true }),
  ),
  baseDamageBp: Schema.optional(
    safeIntSchema("baseDamageBp must be a non-negative integer", { nonNegative: true }),
  ),
  baseAbortBp: Schema.optional(
    safeIntSchema("baseAbortBp must be a non-negative integer", { nonNegative: true }),
  ),
  baseDisruptionBp: Schema.optional(
    safeIntSchema("baseDisruptionBp must be a non-negative integer", { nonNegative: true }),
  ),
  rate: Schema.optional(safeIntSchema("rate must be a positive integer", { positive: true })),
  roundsPerEngagement: Schema.optional(
    safeIntSchema("roundsPerEngagement must be a positive integer", { positive: true }),
  ),
  magazineCapacity: Schema.optional(
    safeIntSchema("magazineCapacity must be a positive integer", { positive: true }),
  ),
  localControlSupported: Schema.optional(Schema.Boolean),
  saturationGroup: Schema.optional(
    safeIntSchema("saturationGroup must be a non-negative integer", { nonNegative: true }),
  ),

  contentVersion: Schema.String.check(
    Schema.isMinLength(1, { message: "contentVersion must be a non-empty string" }),
  ),

  contentHash: Schema.String.check(
    Schema.isBetweenLength(64, 64, {
      message: "contentHash must be a 64-character SHA-256 hex string",
    }),
  ),
});

const parseOptions = { onExcessProperty: "error", errors: "all" } as const;

export function validateAirDefenseSystemDefinition(value: unknown): AirDefenseSystemDefinition {
  const result = Schema.decodeUnknownResult(AirDefenseSystemDefinitionSchema, parseOptions)(value);
  if (Result.isFailure(result)) {
    const errors = formatContractIssues(result.failure).map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    throw new BluewaveError(
      `AirDefenseSystemDefinition validation failed: ${JSON.stringify(errors, null, 2)}`,
      { code: INVALID_AIR_DEFENSE_SYSTEM_DEFINITION, errors },
    );
  }
  return result.success as AirDefenseSystemDefinition;
}

function withDefault<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function createAirDefenseSystemDefinition(
  params: Partial<AirDefenseSystemDefinition>,
): AirDefenseSystemDefinition {
  const input = params ?? {};

  const knownKeys = new Set(Object.keys(AirDefenseSystemDefinitionSchema.fields));
  for (const key of Object.keys(input)) {
    if (!knownKeys.has(key)) {
      throw new BluewaveError(
        `AirDefenseSystemDefinition validation failed: unknown field "${key}"`,
        { code: INVALID_AIR_DEFENSE_SYSTEM_DEFINITION, field: key },
      );
    }
  }

  const merged = {
    systemId: withDefault(input.systemId, ""),
    layer: withDefault(input.layer, Layer.HEAVY_AA),
    category: withDefault(input.category, Category.HEAVY_AA),
    mountCount: withDefault(input.mountCount, SafeInt.ZERO),
    barrels: withDefault(input.barrels, SafeInt(1)),
    rangeMinM: withDefault(input.rangeMinM, SafeInt.ZERO),
    rangeMaxM: withDefault(input.rangeMaxM, SafeInt(10_000)),
    altitudeMinM: withDefault(input.altitudeMinM, SafeInt.ZERO),
    altitudeMaxM: withDefault(input.altitudeMaxM, SafeInt(30_000)),
    targetSpeedLimitMps: withDefault(input.targetSpeedLimitMps, SafeInt(500)),
    arcDegreesMax: withDefault(input.arcDegreesMax, SafeInt(360)),
    profileEligibility: withDefault(input.profileEligibility, new Set(["DEFAULT"])),
    fireControl: withDefault(input.fireControl, {
      trackingRangeM: SafeInt(10_000),
      maxElevationDegrees: SafeInt(85),
      updateRateHz: SafeInt(10),
    }),
    radar: withDefault(input.radar, {
      frequencyBand: "S",
      peakPowerW: SafeInt(1_000),
      maxRangeM: SafeInt(50_000),
      resolutionDegrees: SafeInt(1),
    }),
    engagementChannels: withDefault(input.engagementChannels, new Set(["default"])),
    baseKillBp: withDefault(input.baseKillBp, SafeInt(100)),
    baseDamageBp: withDefault(input.baseDamageBp, SafeInt(50)),
    baseAbortBp: withDefault(input.baseAbortBp, SafeInt(30)),
    baseDisruptionBp: withDefault(input.baseDisruptionBp, SafeInt(15)),
    rate: withDefault(input.rate, SafeInt(100)),
    roundsPerEngagement: withDefault(input.roundsPerEngagement, SafeInt.ONE),
    magazineCapacity: withDefault(input.magazineCapacity, SafeInt(1_000)),
    localControlSupported: withDefault(input.localControlSupported, false),
    saturationGroup: withDefault(input.saturationGroup, SafeInt.ZERO),
    contentVersion: withDefault(input.contentVersion, AIR_DEFENSE_MODEL_VERSION),
    contentHash: withDefault(
      input.contentHash,
      "0000000000000000000000000000000000000000000000000000000000000000",
    ),
  };

  return validateAirDefenseSystemDefinition(merged);
}

export function isValidLayer(layer: string): layer is LayerId {
  return ["HEAVY_AA", "MEDIUM_AA", "LIGHT_AA", "CIWS_TERMINAL_DEFENSE"].includes(layer);
}

export function isValidCategory(category: string): category is CategoryId {
  return ["HEAVY_AA", "MEDIUM_AA", "LIGHT_AA", "CIWS_TERMINAL_DEFENSE"].includes(category);
}
