//packages/combat/src/aircraft/development-duration.ts
// DESIGN-43 §7 development duration formula.
// INC-3: base 4 paid months, range 3-6, modifiers for complexity/technology/industry.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  AIRCRAFT_DEVELOPMENT_BASE_MONTHS,
  AIRCRAFT_DEVELOPMENT_COMPLEXITY_MODIFIER,
  AIRCRAFT_DEVELOPMENT_INDUSTRY_MODIFIER,
  AIRCRAFT_DEVELOPMENT_MAX_MONTHS,
  AIRCRAFT_DEVELOPMENT_MIN_MONTHS,
  AIRCRAFT_DEVELOPMENT_TECHNOLOGY_MODIFIER,
  AIRCRAFT_DESIGN_STREAM_KEY_PREFIX,
} from "./constants.js";
import { AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT } from "./reasonCodes.js";

export interface DevelopmentDurationInput {
  roleComplexity: number;
  technologyLevel: number;
  industryCapacity: number;
}

export function computeDevelopmentDuration(input: DevelopmentDurationInput): SafeInt {
  const raw =
    AIRCRAFT_DEVELOPMENT_BASE_MONTHS +
    (input.roleComplexity > 3 ? AIRCRAFT_DEVELOPMENT_COMPLEXITY_MODIFIER : 0) +
    (input.technologyLevel >= 3 ? AIRCRAFT_DEVELOPMENT_TECHNOLOGY_MODIFIER : 0) +
    (input.industryCapacity >= 3 ? AIRCRAFT_DEVELOPMENT_INDUSTRY_MODIFIER : 0);
  const clamped = Math.max(
    AIRCRAFT_DEVELOPMENT_MIN_MONTHS,
    Math.min(AIRCRAFT_DEVELOPMENT_MAX_MONTHS, raw),
  );
  return SafeInt(clamped);
}

export function computeMonthlyCost(durationMonths: SafeInt): SafeInt {
  const baseCost = 500;
  const totalCost = SafeInt.mul(SafeInt(baseCost), durationMonths);
  return totalCost;
}

export function designStreamKey(nationId: string, role: string): string {
  return `${AIRCRAFT_DESIGN_STREAM_KEY_PREFIX}/${nationId}/${role}/proposal`;
}

export function assertSufficientPayment(treasury: SafeInt, monthlyCost: SafeInt): void {
  if (treasury < monthlyCost) {
    throw new BluewaveError(AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT, {
      code: AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT,
      treasury: Number(treasury),
      monthlyCost: Number(monthlyCost),
    });
  }
}
