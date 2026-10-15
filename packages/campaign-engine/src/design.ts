export interface CarrierAttributes {
  readonly aircraftCapacity: number;
}

/**
 * UI-shaped design projection — friendly units (metric tons, knots), not
 * the engine's raw stored micrometre/kg fields. `year` and
 * `requiredTechnologyIds` come from the content catalog, not the compiled
 * snapshot; ticket 14 (Construction Ordering) wires the real lookup.
 */
export interface CompiledDesignVersion {
  readonly designId: string;
  readonly className: string;
  readonly shipType: string;
  readonly nationId: string;
  readonly year: number;
  readonly mass: number; // metric tons
  readonly speed: number; // knots
  readonly machineryType: string;
  readonly requiredTechnologyIds: readonly string[];
  /** What ordering one of these costs the treasury, in treasury units (engine-computed; screens never derive it). */
  readonly projectedCost: number;
  /** Shipyard capacity units an order reserves. */
  readonly projectedCapacityUnits: number;
  /** Where the cost comes from: the ship-design cost model, or the displacement formula for authored designs. */
  readonly costBasis: "design_cost_model" | "displacement_formula";
  readonly carrierAttributes?: CarrierAttributes;
}

export type CompiledDesignVersionFields = Omit<CompiledDesignVersion, "designId">;

/**
 * Grounded in `construction-screen-state.test.ts`'s exact call shape:
 * `createCompiledDesignVersion("design_majestic", { className, shipType,
 * nationId, year, mass, speed, machineryType, requiredTechnologyIds })`.
 */
export function createCompiledDesignVersion(
  designId: string,
  fields: CompiledDesignVersionFields,
): CompiledDesignVersion {
  return { designId, ...fields };
}
