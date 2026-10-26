import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { Result } from "effect";

export const SHIP_DESIGN_INVARIANT_FAILED = "SHIP_DESIGN_INVARIANT_FAILED" as const;

export function designInvariant(reason: string): BluewaveError {
  return new BluewaveError(reason, { code: SHIP_DESIGN_INVARIANT_FAILED, reason });
}

export function designInvariantResult<A>(run: () => A): Result.Result<A, BluewaveError> {
  try {
    return Result.succeed(run());
  } catch (error) {
    if (!isBluewaveError(error)) throw error;
    return Result.fail(error);
  }
}
