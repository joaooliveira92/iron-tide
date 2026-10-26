import {
  makeValidAircraftModelDefinition_v1,
  validateAircraftModelDefinitionContract,
} from "./contracts.js";

export interface AircraftContractEntry {
  policyId: string;
  shippedContract: unknown;
  validate: (value: unknown) => void;
}

export const SHIPPED_AIRCRAFT_CONTRACTS: readonly AircraftContractEntry[] = [
  {
    policyId: "aircraft_model_definition_v1",
    shippedContract: makeValidAircraftModelDefinition_v1(),
    validate: validateAircraftModelDefinitionContract,
  },
] as const;

export function validateAllAircraftContracts(): void {
  for (const entry of SHIPPED_AIRCRAFT_CONTRACTS) {
    entry.validate(entry.shippedContract);
  }
}
