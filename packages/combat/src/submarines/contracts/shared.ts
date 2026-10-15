// Shared guards for the DESIGN-34 submarine contract validators.
import { BluewaveError } from "@bluewave/contracts";
import { INVALID_SUBMARINE_REPRESENTATION } from "../reasonCodes.js";

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function throwStrategicMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(INVALID_SUBMARINE_REPRESENTATION, {
    code: INVALID_SUBMARINE_REPRESENTATION,
    reason,
    contract,
  });
}

export { arrayEquals, throwStrategicMismatch };
