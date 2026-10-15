import type { Facility } from "./compileShared.js";
import { LINE_IDS, type LineId } from "./construction.js";

/** A shipyard: its physical limits plus the work each production line can apply per month (ADR-0067 section 6). */
export interface Yard {
  readonly facility: Facility;
  readonly capacity: Readonly<Record<LineId, number>>;
}

/** Hull measurements a yard must accommodate; the same four limits as the NO_FACILITY_FITS rule. */
export interface YardDemand {
  readonly lengthMm: number;
  readonly beamMm: number;
  readonly displacementKg: number;
  /** Heaviest single component, kg, against the crane lift. */
  readonly heaviestKg: number;
}

/**
 * Work micro-units per month per line for a yard: `maxDisplacementT * workPerTonneMonth`, integer (floor). A yard that can hold
 * a bigger hull has proportionally more slips, cranes and labour on every line.
 */
export function yardCapacityFor(
  facility: Facility,
  workPerTonneMonth: number,
): Record<LineId, number> {
  if (!Number.isSafeInteger(workPerTonneMonth) || workPerTonneMonth <= 0)
    throw new RangeError(
      `yardWorkPerTonneMonth must be a positive integer, got ${workPerTonneMonth}`,
    );
  const work = Math.floor((facility.maxDisplacementKg * workPerTonneMonth) / 1000);
  return Object.fromEntries(LINE_IDS.map((l) => [l, work])) as Record<LineId, number>;
}

/** Builds the yard list from the facility list, in a fixed order: ascending capacity, then id. */
export function buildYards(facilities: readonly Facility[], workPerTonneMonth: number): Yard[] {
  return facilities
    .map((facility) => ({ facility, capacity: yardCapacityFor(facility, workPerTonneMonth) }))
    .sort(
      (a, b) =>
        a.facility.maxDisplacementKg - b.facility.maxDisplacementKg ||
        (a.facility.id < b.facility.id ? -1 : a.facility.id > b.facility.id ? 1 : 0),
    );
}

/** True when the yard can lay down and lift the hull (inclusive limits). */
export function yardFits(f: Facility, d: YardDemand): boolean {
  return (
    f.maxLengthMm >= d.lengthMm &&
    f.maxBeamMm >= d.beamMm &&
    f.maxDisplacementKg >= d.displacementKg &&
    f.craneLiftKg >= d.heaviestKg
  );
}

/** The limits a hull can exceed at a yard. */
export type YardLimit = "LENGTH" | "BEAM" | "DISPLACEMENT" | "CRANE";

/** Every limit of the yard the hull exceeds (empty when `yardFits`), in a fixed order. */
export function yardMisfits(f: Facility, d: YardDemand): YardLimit[] {
  const out: YardLimit[] = [];
  if (f.maxLengthMm < d.lengthMm) out.push("LENGTH");
  if (f.maxBeamMm < d.beamMm) out.push("BEAM");
  if (f.maxDisplacementKg < d.displacementKg) out.push("DISPLACEMENT");
  if (f.craneLiftKg < d.heaviestKg) out.push("CRANE");
  return out;
}
