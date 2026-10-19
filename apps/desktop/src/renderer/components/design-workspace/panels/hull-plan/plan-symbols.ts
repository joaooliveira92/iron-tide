import { mountClassOf, type MountClass } from "@bluewave/ship-visual";
import type { FittingKind } from "./sections.js";

/**
 * What the plan draws for one fitting. A drawing choice from data the design already carries (mount class, gun count
 * and calibre for guns; kind for the rest): sizes are conventions, the class and counts are not.
 */
export type PlanSymbolSpec =
  | {
      readonly shape: "gun";
      readonly mountClass: MountClass;
      readonly barrels: number;
      readonly radius: number;
    }
  | { readonly shape: "tube" }
  /** Drawn by another layer (a funnel is the topside layer's oval); only its hidden anchor remains here. */
  | { readonly shape: "anchor" }
  | { readonly shape: "space"; readonly kind: "magazine" | "machinery" | "other" };

export interface PlanSymbolInput {
  readonly kind: FittingKind;
  readonly category?: string;
  readonly mountType?: string;
  readonly gunCount?: number;
  readonly caliberUm?: number;
}

const UM_PER_INCH = 25_400;
const MAX_BARRELS = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Turret radius (SVG units) from calibre: heavier guns sit in bigger mounts. Unknown calibre draws a mid-size mount. */
export function turretRadius(caliberUm: number | undefined): number {
  if (caliberUm === undefined || !Number.isFinite(caliberUm) || caliberUm <= 0) return 4;
  return clamp(2.2 + (caliberUm / UM_PER_INCH) * 0.45, 2.2, 7.5);
}

/** The symbol for a fitting. A funnel is an anchor only: the topside layer draws its oval. */
export function planSymbolFor(input: PlanSymbolInput): PlanSymbolSpec {
  switch (input.kind) {
    case "funnel":
      return { shape: "anchor" };
    case "torpedo":
      return { shape: "tube" };
    case "gun": {
      const mountClass = mountClassOf(input.category ?? "MAIN_GUN", input.mountType) ?? "TURRET";
      const barrels = clamp(Math.round(input.gunCount ?? 1), 1, MAX_BARRELS);
      return {
        shape: "gun",
        mountClass,
        barrels: mountClass === "TURRET" || mountClass === "BARBETTE" ? barrels : 1,
        radius: turretRadius(input.caliberUm),
      };
    }
    case "magazine":
    case "machinery":
    case "other":
      return { shape: "space", kind: input.kind };
  }
}
