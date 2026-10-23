import { BluewaveError } from "@bluewave/contracts";
import {
  SUBSTEPS_PER_MINUTE,
  TACTICAL_MINUTE_MS,
  TACTICAL_SUBSTEP_MS,
} from "../core/tacticalTime.js";

export const tacticalTurnMilliseconds = TACTICAL_MINUTE_MS;
export const tacticalSubstepMilliseconds = TACTICAL_SUBSTEP_MS;
export const substepsPerTurn = SUBSTEPS_PER_MINUTE;
export const tacticalTimePolicyId = "tactical_time_v1" as const;
export const tacticalTimeFormulaVersion = "1.0.0" as const;

export interface TacticalTimeContract {
  tacticalTurnMilliseconds: number;
  tacticalSubstepMilliseconds: number;
  substepsPerTurn: number;
  tacticalTimePolicyId: string;
  tacticalTimeFormulaVersion: string;
}
export const SHIPPED_TACTICAL_TIME_CONTRACT: TacticalTimeContract = {
  tacticalTurnMilliseconds,
  tacticalSubstepMilliseconds,
  substepsPerTurn,
  tacticalTimePolicyId,
  tacticalTimeFormulaVersion,
};
export function validateTacticalTimeContract(
  c: Partial<TacticalTimeContract> | null | undefined,
): asserts c is TacticalTimeContract {
  if (
    !c ||
    c.tacticalTurnMilliseconds !== tacticalTurnMilliseconds ||
    c.tacticalSubstepMilliseconds !== tacticalSubstepMilliseconds ||
    c.substepsPerTurn !== substepsPerTurn ||
    c.tacticalTimePolicyId !== "tactical_time_v1" ||
    !c.tacticalTimeFormulaVersion
  ) {
    throw new BluewaveError("INVALID_TACTICAL_TIME_CONTRACT", {
      code: "INVALID_TACTICAL_TIME_CONTRACT",
      contract: c,
    });
  }
  if (c.tacticalTurnMilliseconds % c.tacticalSubstepMilliseconds !== 0) {
    throw new BluewaveError("INVALID_TACTICAL_TIME_CONTRACT: modulus", {
      code: "INVALID_TACTICAL_TIME_CONTRACT",
      contract: c,
    });
  }
}
