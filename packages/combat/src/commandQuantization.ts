import { BluewaveError } from "@bluewave/contracts";
export const COMMAND_CUTOFF_MILLISECONDS = 100 as const;
export const TACTICAL_SUBSTEP_MS = 1_000 as const;

export interface QuantizedCommandTime {
  effectiveMinute: number;
  effectiveSubstep: number;
  rawCeiling: number;
  wasAfterCutoff: boolean;
}

export function quantizeCommand(
  inputTimestampTacticalMilliseconds: number,
  opts?: { arrivedBeforeCutoff?: boolean },
): QuantizedCommandTime {
  if (
    !Number.isInteger(inputTimestampTacticalMilliseconds) ||
    inputTimestampTacticalMilliseconds < 0
  ) {
    throw new BluewaveError("TACTICAL_COMMAND_AFTER_CUTOFF", {
      code: "TACTICAL_COMMAND_AFTER_CUTOFF",
      inputTimestampTacticalMilliseconds,
    });
  }
  // MUST use authoritative clock — wall-clock check is caller responsibility; we enforce integer tactical ms
  let raw = Math.ceil(inputTimestampTacticalMilliseconds / 1_000); // §5 canonical rule
  const remainder = inputTimestampTacticalMilliseconds % 1_000;
  let wasAfterCutoff = false;

  if (remainder === 0) {
    // exactly on boundary: eligible for that substep only when arrived before cutoff
    const before = opts?.arrivedBeforeCutoff ?? true;
    if (!before) {
      raw += 1;
      wasAfterCutoff = true;
    }
  } else if (remainder > 900) {
    // within 100ms before next boundary -> after cutoff for next substep
    raw += 1;
    wasAfterCutoff = true;
  }
  // final cutoff of battle minute -> next minute substep 0 naturally via overflow
  const effectiveMinute = Math.floor(raw / 60);
  const effectiveSubstep = raw % 60;
  return {
    effectiveMinute,
    effectiveSubstep,
    rawCeiling: Math.ceil(inputTimestampTacticalMilliseconds / 1_000),
    wasAfterCutoff,
  };
}
export function isBeforeCutoff(tacticalMs: number): boolean {
  const r = tacticalMs % 1_000;
  return r !== 0 && r <= 900;
}
