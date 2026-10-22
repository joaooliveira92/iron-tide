import {
  applyEdit,
  buildWorkshopView,
  type DesignDraft,
  type DraftEdit,
  type WorkshopEnvironment,
  type WorkshopView,
} from "@bluewave/ship-design";

import type { PresentationFormat } from "../../lib/presentation-format/index.js";

/**
 * Comparison before commitment: the compiled consequences of an edit, so a player can see what an option would do
 * before choosing it. Pure: same inputs, same output, nothing is committed. The deltas are the same engineering
 * readouts the status strip shows (speed, displacement, cost, stability), so the preview cannot disagree with the
 * result of applying the edit. Every figure renders through the bound presentation format (ADR-0218).
 */

export interface Delta {
  readonly id: string;
  readonly label: string;
  /** Signed, unit-aware text, e.g. `+1.3 kn`, `-84 t`, `+1,260 NC`. */
  readonly text: string;
  readonly direction: "up" | "down" | "flat";
}

const dir = (value: number): Delta["direction"] => (value > 0 ? "up" : value < 0 ? "down" : "flat");
const plus = (value: number): string => (value > 0 ? "+" : "");

/** The engineering deltas between two compiled views: only the values that actually change. */
export function viewDeltas(
  before: WorkshopView,
  after: WorkshopView,
  format: PresentationFormat,
): Delta[] {
  const out: Delta[] = [];
  const bMach = before.compiled.machinery;
  const aMach = after.compiled.machinery;
  if (bMach !== null && aMach !== null) {
    const d = aMach.maxSpeedMilliKnots - bMach.maxSpeedMilliKnots;
    if (d !== 0)
      out.push({
        id: "speed",
        label: "Speed",
        text: `${plus(d)}${format.number(d / 1000, { maximumFractionDigits: 1 })} kn`,
        direction: dir(d),
      });
  }
  const dWeight = after.totalKg - before.totalKg;
  if (dWeight !== 0)
    out.push({
      id: "displacement",
      label: "Displacement",
      text: `${plus(dWeight)}${format.measurement(dWeight, "mass", { maximumFractionDigits: 0 })}`,
      direction: dir(dWeight),
    });
  const dCost = after.forecast.costMicro - before.forecast.costMicro;
  if (dCost !== 0)
    out.push({
      id: "cost",
      label: "Cost",
      text: `${plus(dCost)}${format.moneyFromMicro(dCost)}`,
      direction: dir(dCost),
    });
  const bStab = before.compiled.stability;
  const aStab = after.compiled.stability;
  if (bStab !== null && aStab !== null) {
    const d = aStab.gmMm - bStab.gmMm;
    if (d !== 0)
      out.push({
        id: "stability",
        label: "Stability",
        text: `${plus(d)}${format.number(d / 1000, { maximumFractionDigits: 2 })} m GM`,
        direction: dir(d),
      });
  }
  return out;
}

/**
 * What this edit would change, without applying it. Null when the edit is rejected by the model (so the preview
 * never shows what an invalid option would do).
 */
export function previewOptionDeltas(
  draft: DesignDraft,
  env: WorkshopEnvironment,
  before: WorkshopView,
  edit: DraftEdit,
  format: PresentationFormat,
): readonly Delta[] | null {
  let after: WorkshopView;
  try {
    after = buildWorkshopView(applyEdit(draft, edit), env);
  } catch {
    return null;
  }
  return viewDeltas(before, after, format);
}
