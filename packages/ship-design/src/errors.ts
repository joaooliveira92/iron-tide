import { BluewaveError } from "@bluewave/contracts";

export const SHIP_DESIGN_INVARIANT_FAILED = "SHIP_DESIGN_INVARIANT_FAILED" as const;

export function designInvariant(reason: string): BluewaveError {
  return new BluewaveError(reason, { code: SHIP_DESIGN_INVARIANT_FAILED, reason });
}
