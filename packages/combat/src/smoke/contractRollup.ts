// INC-9: Full contract rollup for the smoke module.
// Exports a single combined validation function that proves all shipped smoke
// contracts pass their own validate guards.
import { validateAllSmokeContracts } from "./contracts.js";

export const SMOKE_V1_CONTRACTS = {};

export function validateAllSmokeContractsRollup(): void {
  validateAllSmokeContracts();
}
