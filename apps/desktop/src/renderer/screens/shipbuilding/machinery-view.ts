import type { DesignDraft, WorkshopEnvironment, WorkshopView } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../components/design-workspace/content.js";
import { previewOptionDeltas, type Delta } from "../../components/design-workspace/optionDelta.js";
import { formatPowerBoth } from "../../lib/presentation-format/index.js";

/**
 * The Machinery section's outcomes-first view model. Pure: the editable performance targets and propulsion
 * configuration on one side, and the calculated results they produce on the other. Nothing here edits the design,
 * and no value appears both as an input and an output.
 */

export interface PlantOption {
  readonly id: string;
  readonly label: string;
  readonly disabled: boolean;
  /** Why the plant cannot be chosen (introduction date or missing technology); null when it can. */
  readonly reason: string | null;
}

export interface MachineryInputs {
  /** Target speed, milli-knots (a design input). */
  readonly targetSpeedMilliKnots: number;
  /** Cruising speed, milli-knots (a design input). */
  readonly cruiseSpeedMilliKnots: number;
  /** Operational range, nautical miles (a design input). */
  readonly rangeNm: number;
  readonly plantId: string;
  readonly installedKw: number;
  /** Installed power in both units, e.g. "3,300 kW (4,425 hp)". */
  readonly installedPowerText: string;
  readonly fuelCapacityKg: number;
  readonly plantOptions: readonly PlantOption[];
}

export interface MachineryOutput {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface MachineryModel {
  readonly inputs: MachineryInputs;
  readonly outputs: readonly MachineryOutput[];
  /** Things the model does not yet carry, said plainly rather than faked. */
  readonly notes: readonly string[];
}

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();
const kn = (milliKnots: number) => (milliKnots / 1000).toFixed(1);
const tonnes = (kg: number) => (kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * Comparison before commitment for the propulsion plant: per plant, what choosing it would change (the compiled
 * speed, displacement, cost and stability deltas, plus its reliability and the year it requires). Pure; the current
 * plant previews as no change. Computed on demand, so the many compiles this costs are never run per render.
 */
export function plantDeltas(
  draft: DesignDraft,
  env: WorkshopEnvironment,
  view: WorkshopView,
  content: DrawingBoardContent,
): ReadonlyMap<string, readonly Delta[]> {
  const current = content.plants.find((p) => p.id === draft.machinery.plantId);
  const map = new Map<string, readonly Delta[]>();
  for (const p of content.plants) {
    if (p.id === draft.machinery.plantId) {
      map.set(p.id, []);
      continue;
    }
    const base = previewOptionDeltas(draft, env, view, {
      kind: "set_machinery",
      patch: { plantId: p.id },
    });
    if (base === null) continue;
    const deltas = [...base];
    const dReliability = p.reliabilityBp - (current?.reliabilityBp ?? 0);
    if (dReliability !== 0)
      deltas.push({
        id: "reliability",
        label: "Reliability",
        text: `${dReliability > 0 ? "+" : "\u2212"}${Math.abs(dReliability / 100).toFixed(0)}%`,
        direction: dReliability > 0 ? "up" : "down",
      });
    const from = p.introduction?.fromMonth;
    if (from !== undefined && from !== current?.introduction?.fromMonth)
      deltas.push({ id: "year", label: "Required", text: `from ${from}`, direction: "flat" });
    map.set(p.id, deltas);
  }
  return map;
}

/**
 * The propulsion configuration and the calculated results for a draft. `month` and `unlockedTechs` gate the plant
 * choices; `view` supplies every calculated value (never recomputed here).
 */
export function machineryModel(
  draft: DesignDraft,
  view: WorkshopView,
  content: DrawingBoardContent,
  month: string,
  unlockedTechs: ReadonlySet<string>,
): MachineryModel {
  const plantOptions: PlantOption[] = content.plants.map((p) => {
    const tooEarly = p.introduction !== undefined && p.introduction.fromMonth > month;
    const missing = (p.requires ?? []).filter((t) => !unlockedTechs.has(t));
    const reason = tooEarly
      ? `unavailable until ${p.introduction!.fromMonth}`
      : missing.length > 0
        ? `needs ${missing.map(words).join(", ")}`
        : null;
    return {
      id: p.id,
      label: `${words(p.id)} (${words(p.fuelType)})`,
      disabled: reason !== null,
      reason,
    };
  });
  const plant = content.plants.find((p) => p.id === draft.machinery.plantId);
  const machinery = view.compiled.machinery;
  const kwPerShpBp = content.environmentFor(month, draft.nationId).ctx.balance.machinery.kwPerShpBp;
  const fuelCost = view.forecast.costBreakdown.machinery;

  const outputs: MachineryOutput[] = [
    {
      id: "required-power",
      label: "Power required at target speed",
      value: machinery === null ? "n/a" : formatPowerBoth(machinery.requiredKwAtMax, kwPerShpBp),
    },
    {
      id: "max-speed",
      label: "Speed achieved",
      value: machinery === null ? "n/a" : `${kn(machinery.maxSpeedMilliKnots)} kn`,
    },
    {
      id: "machinery-weight",
      label: "Machinery weight",
      value: machinery === null ? "n/a" : `${tonnes(machinery.plantWeightKg)} t`,
    },
    {
      id: "fuel-use",
      label: "Fuel use at cruise",
      value:
        machinery === null ? "n/a" : `${machinery.cruiseKgPerHour.toLocaleString("en-US")} kg/h`,
    },
    {
      id: "range",
      label: "Range at cruise",
      value: machinery === null ? "n/a" : `${machinery.rangeNmAtCruise.toLocaleString("en-US")} nm`,
    },
    {
      id: "reliability",
      label: "Reliability",
      value: plant === undefined ? "n/a" : `${(plant.reliabilityBp / 100).toFixed(0)}%`,
    },
    {
      id: "cost",
      label: "Machinery cost",
      value: `£${Math.round(fuelCost / 1_000_000).toLocaleString("en-US")}`,
    },
  ];

  return {
    inputs: {
      targetSpeedMilliKnots: draft.requirement.requiredSpeedMilliKnots,
      cruiseSpeedMilliKnots: draft.requirement.cruiseSpeedMilliKnots,
      rangeNm: draft.requirement.requiredRangeNm,
      plantId: draft.machinery.plantId,
      installedKw: draft.machinery.installedKw,
      installedPowerText: formatPowerBoth(draft.machinery.installedKw, kwPerShpBp),
      fuelCapacityKg: draft.machinery.fuelCapacityKg,
      plantOptions,
    },
    outputs,
    notes: ["Acceleration is not modelled yet, so no acceleration figure is shown."],
  };
}
