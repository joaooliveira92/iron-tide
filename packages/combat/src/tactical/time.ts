import { BluewaveError } from "@bluewave/contracts";

export const tacticalTurnMilliseconds = 60_000 as const;
export const tacticalSubstepMilliseconds = 1_000 as const;
export const substepsPerTurn = 60 as const;
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
    c.tacticalTurnMilliseconds !== 60_000 ||
    c.tacticalSubstepMilliseconds !== 1_000 ||
    c.substepsPerTurn !== 60 ||
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
