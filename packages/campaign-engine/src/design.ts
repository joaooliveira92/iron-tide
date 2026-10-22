export interface CarrierAttributes {
  readonly aircraftCapacity: number;
}

export interface CompiledDesignVersion {
  readonly designId: string;
  readonly className: string;
  readonly shipType: string;
  readonly nationId: string;
  readonly year: number;
  readonly available: boolean;
  readonly mass: number;
  readonly speed: number;
  readonly machineryType: string;
  readonly requiredTechnologyIds: readonly string[];
  readonly projectedCost: number;
  readonly projectedCapacityUnits: number;
  readonly costBasis: "design_cost_model" | "displacement_formula";
  readonly carrierAttributes?: CarrierAttributes;
}

export type CompiledDesignVersionFields = Omit<CompiledDesignVersion, "designId">;

export function createCompiledDesignVersion(
  designId: string,
  fields: CompiledDesignVersionFields,
): CompiledDesignVersion {
  return { designId, ...fields };
}
