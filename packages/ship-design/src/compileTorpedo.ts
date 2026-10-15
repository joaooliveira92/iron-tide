/**
 * Compile a strictly decoded torpedo part into the neutral `CompiledTorpedo` contract
 * (ship-part-model ticket 13a, SPM-R17).
 *
 * Pure and total: either the compiled record, or typed, path-specific failures. It reads the
 * part's spec resolved at `month` (base spec plus every revision up to it) and validates every
 * value it carries, so a missing or malformed field is a named failure, never a zero, `false`,
 * empty list or guess. It does not read combat and does not change combat behaviour (ticket 13b).
 */
import type { FlattenedPart } from "@bluewave/content-schema";
import type { CompiledTorpedo, CompiledTorpedoSpeedSetting } from "@bluewave/armament";
import { specAt } from "./partFitConstraints.js";
import { revisionAt } from "./partQueries.js";

export type CompileTorpedoFailureCode =
  | "COMPILED_TORPEDO_NOT_A_TORPEDO"
  | "COMPILED_TORPEDO_MISSING_FIELD"
  | "COMPILED_TORPEDO_INVALID_FIELD"
  | "COMPILED_TORPEDO_OXYGEN_STATE";

export interface CompileTorpedoFailure {
  readonly code: CompileTorpedoFailureCode;
  readonly path: string;
  readonly message: string;
}

export type CompileTorpedoResult =
  | { readonly ok: true; readonly value: CompiledTorpedo }
  | { readonly ok: false; readonly failures: readonly CompileTorpedoFailure[] };

function readNumber(
  spec: Readonly<Record<string, unknown>>,
  field: string,
  failures: CompileTorpedoFailure[],
): number | undefined {
  const value = spec[field];
  if (value === undefined) {
    failures.push({
      code: "COMPILED_TORPEDO_MISSING_FIELD",
      path: field,
      message: `the torpedo spec has no '${field}'.`,
    });
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    failures.push({
      code: "COMPILED_TORPEDO_INVALID_FIELD",
      path: field,
      message: `'${field}' must be an integer.`,
    });
    return undefined;
  }
  return value;
}

function readString(
  spec: Readonly<Record<string, unknown>>,
  field: string,
  failures: CompileTorpedoFailure[],
): string | undefined {
  const value = spec[field];
  if (value === undefined) {
    failures.push({
      code: "COMPILED_TORPEDO_MISSING_FIELD",
      path: field,
      message: `the torpedo spec has no '${field}'.`,
    });
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    failures.push({
      code: "COMPILED_TORPEDO_INVALID_FIELD",
      path: field,
      message: `'${field}' must be a non-empty string.`,
    });
    return undefined;
  }
  return value;
}

function readStringList(
  spec: Readonly<Record<string, unknown>>,
  field: string,
  failures: CompileTorpedoFailure[],
): string[] | undefined {
  const value = spec[field];
  if (!Array.isArray(value) || value.length === 0) {
    failures.push({
      code:
        value === undefined ? "COMPILED_TORPEDO_MISSING_FIELD" : "COMPILED_TORPEDO_INVALID_FIELD",
      path: field,
      message: `'${field}' must be a non-empty list of mount types.`,
    });
    return undefined;
  }
  if (!value.every((v) => typeof v === "string" && v.length > 0)) {
    failures.push({
      code: "COMPILED_TORPEDO_INVALID_FIELD",
      path: field,
      message: `'${field}' must contain only non-empty strings.`,
    });
    return undefined;
  }
  return [...(value as string[])];
}

/** Like `readStringList`, but an empty list is valid (the technology-prerequisite field). */
function readStringListAllowEmpty(
  spec: Readonly<Record<string, unknown>>,
  field: string,
  failures: CompileTorpedoFailure[],
): string[] | undefined {
  const value = spec[field];
  if (!Array.isArray(value)) {
    failures.push({
      code:
        value === undefined ? "COMPILED_TORPEDO_MISSING_FIELD" : "COMPILED_TORPEDO_INVALID_FIELD",
      path: field,
      message: `'${field}' must be a list of stable ids.`,
    });
    return undefined;
  }
  if (!value.every((v) => typeof v === "string" && v.length > 0)) {
    failures.push({
      code: "COMPILED_TORPEDO_INVALID_FIELD",
      path: field,
      message: `'${field}' must contain only non-empty strings.`,
    });
    return undefined;
  }
  return [...(value as string[])];
}

function readSpeedSettings(
  spec: Readonly<Record<string, unknown>>,
  failures: CompileTorpedoFailure[],
): CompiledTorpedoSpeedSetting[] | undefined {
  const value = spec["speedSettings"];
  if (!Array.isArray(value) || value.length === 0) {
    failures.push({
      code:
        value === undefined ? "COMPILED_TORPEDO_MISSING_FIELD" : "COMPILED_TORPEDO_INVALID_FIELD",
      path: "speedSettings",
      message: "'speedSettings' must be a non-empty list of settings.",
    });
    return undefined;
  }
  const out: CompiledTorpedoSpeedSetting[] = [];
  value.forEach((entry, index) => {
    const setting = entry as {
      readonly settingId?: unknown;
      readonly speedMilliKnots?: unknown;
      readonly rangeM?: unknown;
    };
    const settingId = setting.settingId;
    const speed = setting.speedMilliKnots;
    const range = setting.rangeM;
    if (
      typeof settingId !== "string" ||
      settingId.length === 0 ||
      typeof speed !== "number" ||
      !Number.isInteger(speed) ||
      typeof range !== "number" ||
      !Number.isInteger(range)
    ) {
      failures.push({
        code: "COMPILED_TORPEDO_INVALID_FIELD",
        path: `speedSettings.${index}`,
        message: "a speed setting needs an id, speed and range.",
      });
      return;
    }
    out.push({ settingId, speedMilliKnots: speed, rangeM: range });
  });
  return out.length === value.length ? out : undefined;
}

/**
 * Compile a torpedo part at `month`. Returns the typed compiled record, or the failures that
 * prevented it. A part of another family is a named failure, not a cast.
 */
export function compileTorpedo(part: FlattenedPart, month: string): CompileTorpedoResult {
  if (part.family !== "torpedo") {
    return {
      ok: false,
      failures: [
        {
          code: "COMPILED_TORPEDO_NOT_A_TORPEDO",
          path: part.id,
          message: `part '${part.id}' is a '${part.family}', not a torpedo.`,
        },
      ],
    };
  }
  const failures: CompileTorpedoFailure[] = [];
  const resolved = { revision: revisionAt(part, month), spec: specAt(part, month) };
  const spec = resolved.spec;

  const diameterUm = readNumber(spec, "diameterUm", failures);
  const massKg = readNumber(spec, "massKg", failures);
  const warheadType = readString(spec, "warheadType", failures);
  const warheadExplosiveMassKg = readNumber(spec, "warheadExplosiveMassKg", failures);
  const warheadExplosiveEquivalentMassKg = readNumber(
    spec,
    "warheadExplosiveEquivalentMassKg",
    failures,
  );
  const propulsionType = readString(spec, "propulsionType", failures);
  const minimumArmingDistanceM = readNumber(spec, "minimumArmingDistanceM", failures);
  const reliabilityBp = readNumber(spec, "reliabilityBp", failures);
  const guidanceCapability = readString(spec, "guidanceCapability", failures);
  const launchTypes = readStringList(spec, "launchTypes", failures);
  const technologyPrerequisiteIds = readStringListAllowEmpty(
    spec,
    "technologyPrerequisiteIds",
    failures,
  );
  const tubeHitHazardPolicy = readString(spec, "tubeHitHazardPolicy", failures);
  const speedSettings = readSpeedSettings(spec, failures);

  const isOxygen = propulsionType === "OXYGEN";
  const oxygenModifier = spec["oxygenWakeVisibilityModifierBp"];
  if (isOxygen && typeof oxygenModifier !== "number") {
    failures.push({
      code: "COMPILED_TORPEDO_OXYGEN_STATE",
      path: "oxygenWakeVisibilityModifierBp",
      message: "an OXYGEN torpedo must carry its wake-visibility modifier.",
    });
  }
  if (!isOxygen && oxygenModifier !== undefined) {
    failures.push({
      code: "COMPILED_TORPEDO_OXYGEN_STATE",
      path: "oxygenWakeVisibilityModifierBp",
      message: "a non-OXYGEN torpedo carries no wake-visibility modifier.",
    });
  }

  if (
    failures.length > 0 ||
    diameterUm === undefined ||
    massKg === undefined ||
    warheadType === undefined ||
    warheadExplosiveMassKg === undefined ||
    warheadExplosiveEquivalentMassKg === undefined ||
    propulsionType === undefined ||
    minimumArmingDistanceM === undefined ||
    reliabilityBp === undefined ||
    guidanceCapability === undefined ||
    launchTypes === undefined ||
    technologyPrerequisiteIds === undefined ||
    tubeHitHazardPolicy === undefined ||
    speedSettings === undefined
  ) {
    return { ok: false, failures };
  }

  return {
    ok: true,
    value: {
      partId: part.id,
      revision: resolved.revision,
      diameterUm,
      massKg,
      warheadType,
      warheadExplosiveMassKg,
      warheadExplosiveEquivalentMassKg,
      propulsionType,
      speedSettings,
      minimumArmingDistanceM,
      reliabilityBp,
      guidanceCapability,
      launchTypes,
      technologyPrerequisiteIds,
      tubeHitHazardPolicy,
      ...(isOxygen ? { oxygenWakeVisibilityModifierBp: oxygenModifier as number } : {}),
    },
  };
}
