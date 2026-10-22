import type { NationNavalProfile } from "./nationProfile.js";
import type { YardDemand } from "./yards.js";

export const DOCK_MASS_LIMIT_KEYS = [
  "maximumNewConstructionMassKg",
  "maximumMajorRepairMassKg",
  "maximumRebuildMassKg",
  "maximumConversionMassKg",
] as const;
export type DockMassLimitKey = (typeof DOCK_MASS_LIMIT_KEYS)[number];

export interface DockDimensions {
  readonly maxLengthMm: number;
  readonly maxBeamMm: number;
  readonly maxHeaviestComponentKg: number;
}

export interface DockRecord {
  readonly maximumNewConstructionMassKg: number;
  readonly maximumMajorRepairMassKg: number;
  readonly maximumRebuildMassKg: number;
  readonly maximumConversionMassKg: number;
  readonly dimensions: DockDimensions | null;
  readonly emergencyRepairPolicyId: string;
  readonly dockPolicyVersion: number;
}

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

export function missingDockLimits(dock: Partial<DockRecord>): DockMassLimitKey[] {
  return DOCK_MASS_LIMIT_KEYS.filter((k) => {
    const v = dock[k];
    return typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0;
  });
}

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
