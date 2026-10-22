import { mountClassOf, type MountClass } from "@bluewave/ship-visual";
import type { FittingKind } from "./sections.js";

export type PlanSymbolSpec =
  | {
      readonly shape: "gun";
      readonly mountClass: MountClass;
      readonly barrels: number;
      readonly radius: number;
    }
  | { readonly shape: "tube" }
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

export function turretRadius(caliberUm: number | undefined): number {
  if (caliberUm === undefined || !Number.isFinite(caliberUm) || caliberUm <= 0) return 4;
  return clamp(2.2 + (caliberUm / UM_PER_INCH) * 0.45, 2.2, 7.5);
}

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
