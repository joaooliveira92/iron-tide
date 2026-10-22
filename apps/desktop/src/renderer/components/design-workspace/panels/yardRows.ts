import type { YardLimit, YardOption } from "@bluewave/ship-design";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";

export type YardTone = "chosen" | "ok" | "blocked";

export interface YardRow {
  readonly yardId: string;
  readonly name: string;
  /** "Holds up to 12,000 t, 130 m x 24 m" */
  readonly capacity: string;
  readonly status: string;
  readonly tone: YardTone;
}

const LIMIT_TEXT: Record<YardLimit, string> = {
  LENGTH: "too long",
  BEAM: "too wide",
  DISPLACEMENT: "too heavy",
  CRANE: "heaviest fitting exceeds the crane",
};

const words = (id: string) => id.replaceAll("_", " ");
const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;

/**
 * Display rows for the yard list. Pure: all numbers come from the workshop view's `forecast.yards` and render
 * through the bound presentation format (ADR-0218).
 */
export function yardRows(yards: readonly YardOption[], format: PresentationFormat): YardRow[] {
  const metres = (mm: number) => `${format.number(mm / 1000, { maximumFractionDigits: 0 })} m`;
  const tonnes = (kg: number) => format.measurement(kg, "mass", { maximumFractionDigits: 0 });
  return yards.map((y) => {
    const capacity = `Holds up to ${tonnes(y.maxDisplacementKg)}, ${metres(y.maxLengthMm)} × ${metres(y.maxBeamMm)}`;
    if (y.exceeds.length > 0)
      return {
        yardId: y.yardId,
        name: words(y.yardId),
        capacity,
        status: `Cannot build: ${y.exceeds.map((l) => LIMIT_TEXT[l]).join(", ")}`,
        tone: "blocked",
      };
    if (y.months === null)
      return {
        yardId: y.yardId,
        name: words(y.yardId),
        capacity,
        status: "Can hold the hull but cannot finish it in time",
        tone: "blocked",
      };
    return {
      yardId: y.yardId,
      name: words(y.yardId),
      capacity,
      status: y.chosen ? `Builds here · ${months(y.months)}` : `Could build · ${months(y.months)}`,
      tone: y.chosen ? "chosen" : "ok",
    };
  });
}
