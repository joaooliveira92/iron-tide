import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { SUBMARINE_BASIS_POINTS_PER_UNIT } from "./constants.js";
import { SUBMARINE_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const SUBMARINE_FRIENDLY_IDENTIFICATION_BASE_BP = 500 as const;
export const SUBMARINE_FRIENDLY_IDENTIFICATION_MIN_BP = 0 as const;
export const SUBMARINE_FRIENDLY_IDENTIFICATION_MAX_BP = SUBMARINE_BASIS_POINTS_PER_UNIT;

export interface FriendlyIdentificationInput {
  baseProbabilityBp?: SafeInt;
  visibilityModifierBp: SafeInt;
  communicationModifierBp: SafeInt;
  doctrineModifierBp: SafeInt;
  fatigueModifierBp: SafeInt;
  identificationQualityBp: SafeInt;
}

function isBpInRange(v: unknown): v is number {
  return (
    typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v) && v >= 0 && v <= 20_000
  );
}

export function computeMisidentificationProbability(input: FriendlyIdentificationInput): SafeInt {
  const base = input.baseProbabilityBp ?? SafeInt(SUBMARINE_FRIENDLY_IDENTIFICATION_BASE_BP);
  const vis = input.visibilityModifierBp;
  const comm = input.communicationModifierBp;
  const doc = input.doctrineModifierBp;
  const fat = input.fatigueModifierBp;
  const qual = input.identificationQualityBp;

  for (const [name, val] of [
    ["baseProbabilityBp", base],
    ["visibilityModifierBp", vis],
    ["communicationModifierBp", comm],
    ["doctrineModifierBp", doc],
    ["fatigueModifierBp", fat],
    ["identificationQualityBp", qual],
  ] as const) {
    if (!isBpInRange(val)) {
      throw new BluewaveError(SUBMARINE_STATE_INVARIANT_FAILED, {
        code: SUBMARINE_STATE_INVARIANT_FAILED,
        reason: `§23 ${name} must be a basis-point value [0, 20_000]`,
        field: name,
        value: val,
      });
    }
  }

  const raw = base + vis + comm + doc + fat - qual;
  const clamped = Math.max(
    SUBMARINE_FRIENDLY_IDENTIFICATION_MIN_BP,
    Math.min(SUBMARINE_FRIENDLY_IDENTIFICATION_MAX_BP, raw),
  );
  return SafeInt(clamped);
}
