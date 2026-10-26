import type { Facility } from "./compileShared.js";
import { LINE_IDS, type LineId } from "./construction.js";
import { designInvariant } from "./errors.js";

export interface Yard {
  readonly facility: Facility;
  readonly capacity: Readonly<Record<LineId, number>>;
}

export interface YardDemand {
  readonly lengthMm: number;
  readonly beamMm: number;
  readonly displacementKg: number;
  readonly heaviestKg: number;
}

export function yardCapacityFor(
  facility: Facility,
  workPerTonneMonth: number,
): Record<LineId, number> {
  if (!Number.isSafeInteger(workPerTonneMonth) || workPerTonneMonth <= 0)
    throw designInvariant(
      `yardWorkPerTonneMonth must be a positive integer, got ${workPerTonneMonth}`,
    );
  const work = Math.floor((facility.maxDisplacementKg * workPerTonneMonth) / 1000);
  return Object.fromEntries(LINE_IDS.map((l) => [l, work])) as Record<LineId, number>;
}

export function buildYards(facilities: readonly Facility[], workPerTonneMonth: number): Yard[] {
  return facilities
    .map((facility) => ({ facility, capacity: yardCapacityFor(facility, workPerTonneMonth) }))
    .sort(
      (a, b) =>
        a.facility.maxDisplacementKg - b.facility.maxDisplacementKg ||
        (a.facility.id < b.facility.id ? -1 : a.facility.id > b.facility.id ? 1 : 0),
    );
}

export function yardFits(f: Facility, d: YardDemand): boolean {
  return (
    f.maxLengthMm >= d.lengthMm &&
    f.maxBeamMm >= d.beamMm &&
    f.maxDisplacementKg >= d.displacementKg &&
    f.craneLiftKg >= d.heaviestKg
  );
}

export type YardLimit = "LENGTH" | "BEAM" | "DISPLACEMENT" | "CRANE";

export function yardMisfits(f: Facility, d: YardDemand): YardLimit[] {
  const out: YardLimit[] = [];
  if (f.maxLengthMm < d.lengthMm) out.push("LENGTH");
  if (f.maxBeamMm < d.beamMm) out.push("BEAM");
  if (f.maxDisplacementKg < d.displacementKg) out.push("DISPLACEMENT");
  if (f.craneLiftKg < d.heaviestKg) out.push("CRANE");
  return out;
}
