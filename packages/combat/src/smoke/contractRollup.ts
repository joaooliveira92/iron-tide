import { validateAllSmokeContracts } from "./contracts.js";

export const SMOKE_V1_CONTRACTS = {};

export function validateAllSmokeContractsRollup(): void {
  validateAllSmokeContracts();
}
