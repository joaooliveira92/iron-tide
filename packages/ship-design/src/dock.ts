// packages/ship-design/src/dock.ts
// DESIGN-16 section 4: the national dock — its mass ceilings and dimension predicate — and the new-construction
// eligibility it governs. Pure and dependency-free; composes with (never replaces) the per-yard fit in `yards.ts`.
// The manual gives no numbers, so a nation's dock is authored content (`NationNavalProfile.dock`) with provenance;
// nothing is invented in code. It is distinct from the production/throughput ceiling `maxPracticalDisplacementKg`
// (ADR-0135): that figure wrongly refused real domestic ships when used as a dock limit.
import type { NationNavalProfile } from "./nationProfile.js";
import type { YardDemand } from "./yards.js";

/** DESIGN-16 section 4.1/4.2/4.4: the four mass ceilings a dock must declare, in canonical kilograms. */
export const DOCK_MASS_LIMIT_KEYS = [
  "maximumNewConstructionMassKg",
  "maximumMajorRepairMassKg",
  "maximumRebuildMassKg",
  "maximumConversionMassKg",
] as const;
export type DockMassLimitKey = (typeof DOCK_MASS_LIMIT_KEYS)[number];

/** DESIGN-16 section 4.1: a ship-dimension predicate a hull must pass, separate from `YardDemand`'s per-yard fit. */
export interface DockDimensions {
  readonly maxLengthMm: number;
  readonly maxBeamMm: number;
  /** Heaviest single component, against the dock's crane. */
  readonly maxHeaviestComponentKg: number;
}

export interface DockRecord {
  readonly maximumNewConstructionMassKg: number;
  readonly maximumMajorRepairMassKg: number;
  readonly maximumRebuildMassKg: number;
  readonly maximumConversionMassKg: number;
  /** Null means the national dock imposes no extra dimension bound beyond the per-yard fit. */
  readonly dimensions: DockDimensions | null;
  readonly emergencyRepairPolicyId: string;
  readonly dockPolicyVersion: number;
}

/** DESIGN-16 section 4.1/4.2 and section 18: the stable reasons a dock check rejects. */
export const DOCK_LIMIT_MISSING = "DOCK_LIMIT_MISSING" as const;
export const SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT = "SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT" as const;
export type DockRejectionCode = typeof DOCK_LIMIT_MISSING | typeof SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT;

export interface DockRejection {
  readonly code: DockRejectionCode;
  readonly message: string;
}

export interface DockEligibility {
  readonly eligible: boolean;
  readonly rejections: readonly DockRejection[];
}

/**
 * Build a partial `DockRecord` from an authored dock definition. Every limit is read explicitly from the definition; a
 * missing limit is left absent so `missingDockLimits` fails it with `DOCK_LIMIT_MISSING` (never copied across limits).
 * The dimension predicate is optional and defaults to none.
 */
export function dockRecordFromDefinition(def: {
  maximumNewConstructionMassKg?: number;
  maximumMajorRepairMassKg?: number;
  maximumRebuildMassKg?: number;
  maximumConversionMassKg?: number;
  dimensions?: DockDimensions | null;
  emergencyRepairPolicyId?: string;
  dockPolicyVersion?: number;
}): Partial<DockRecord> {
  return {
    ...(def.maximumNewConstructionMassKg !== undefined
      ? { maximumNewConstructionMassKg: def.maximumNewConstructionMassKg }
      : {}),
    ...(def.maximumMajorRepairMassKg !== undefined
      ? { maximumMajorRepairMassKg: def.maximumMajorRepairMassKg }
      : {}),
    ...(def.maximumRebuildMassKg !== undefined
      ? { maximumRebuildMassKg: def.maximumRebuildMassKg }
      : {}),
    ...(def.maximumConversionMassKg !== undefined
      ? { maximumConversionMassKg: def.maximumConversionMassKg }
      : {}),
    dimensions: def.dimensions ?? null,
    emergencyRepairPolicyId: def.emergencyRepairPolicyId ?? "none",
    dockPolicyVersion: def.dockPolicyVersion ?? 1,
  };
}

/** The complete `DockRecord` a resolved naval profile authors (DESIGN-16 section 4, ADR-0135). */
export function dockRecordFor(profile: NationNavalProfile): DockRecord {
  const d = profile.dock;
  return {
    maximumNewConstructionMassKg: d.maximumNewConstructionMassKg,
    maximumMajorRepairMassKg: d.maximumMajorRepairMassKg,
    maximumRebuildMassKg: d.maximumRebuildMassKg,
    maximumConversionMassKg: d.maximumConversionMassKg,
    dimensions: d.dimensions ?? null,
    emergencyRepairPolicyId: "none",
    dockPolicyVersion: 1,
  };
}

/** The declared mass limits that are absent or not a positive safe integer (DESIGN-16 section 4.1). */
export function missingDockLimits(dock: Partial<DockRecord>): DockMassLimitKey[] {
  return DOCK_MASS_LIMIT_KEYS.filter((k) => {
    const v = dock[k];
    return typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0;
  });
}

/** The dimension bounds a hull exceeds (empty when it fits or no predicate is declared). */
export function dockDimensionMisfits(
  dock: DockDimensions,
  d: YardDemand,
): ("LENGTH" | "BEAM" | "CRANE")[] {
  const out: ("LENGTH" | "BEAM" | "CRANE")[] = [];
  if (d.lengthMm > dock.maxLengthMm) out.push("LENGTH");
  if (d.beamMm > dock.maxBeamMm) out.push("BEAM");
  if (d.heaviestKg > dock.maxHeaviestComponentKg) out.push("CRANE");
  return out;
}

/**
 * Whether a domestic new-construction hull fits the national dock (DESIGN-16 section 4.2). A missing limit fails with
 * `DOCK_LIMIT_MISSING`; a hull over the new-construction mass or a dimension bound fails with
 * `SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT`. The per-yard fit is checked separately and composes with this.
 */
export function newConstructionDockEligibility(
  dock: Partial<DockRecord>,
  demand: YardDemand,
): DockEligibility {
  const missing = missingDockLimits(dock);
  if (missing.length > 0)
    return {
      eligible: false,
      rejections: [
        {
          code: DOCK_LIMIT_MISSING,
          message: `The dock is missing required limit(s): ${missing.join(", ")}.`,
        },
      ],
    };
  const rejections: DockRejection[] = [];
  if (demand.displacementKg > dock.maximumNewConstructionMassKg!)
    rejections.push({
      code: SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT,
      message: `Displacement ${demand.displacementKg} kg exceeds the dock's new-construction ceiling ${dock.maximumNewConstructionMassKg!} kg.`,
    });
  if (dock.dimensions != null && dockDimensionMisfits(dock.dimensions, demand).length > 0)
    rejections.push({
      code: SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT,
      message: `The hull exceeds the dock's dimension predicate (${dockDimensionMisfits(dock.dimensions, demand).join(", ")}).`,
    });
  return { eligible: rejections.length === 0, rejections };
}
