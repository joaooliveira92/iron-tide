import type { BatteryCard } from "../../components/design-workspace/batteryView.js";
import type { DesignDraft, Severity, WorkshopView } from "@bluewave/ship-design";
import { plural } from "../../components/design-workspace/plural.js";
import { formatExplanation, type PresentationFormat } from "../../lib/presentation-format/index.js";

/**
 * The Overview section's summary view model. Pure: every value is derived from the compiled design (never an
 * editable duplicate of another section), and the design warnings are the same counts the Review section shows.
 */

/** The five design priorities the player may record; setting one never changes the design. */
export const PRIORITY_IDS = ["speed", "protection", "firepower", "range", "cost"] as const;
export type PriorityId = (typeof PRIORITY_IDS)[number];

export const PRIORITY_LABEL: { readonly [K in PriorityId]: string } = {
  speed: "Speed",
  protection: "Protection",
  firepower: "Firepower",
  range: "Range",
  cost: "Cost",
};

export interface OverviewValue {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface OverviewWarning {
  readonly severity: Severity;
  readonly count: number;
}

export interface OverviewModel {
  readonly values: readonly OverviewValue[];
  /** The same severity counts the Review section's validation shows. */
  readonly warnings: readonly OverviewWarning[];
}

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

const metric = (view: WorkshopView, id: string): string =>
  formatExplanation(view.metrics.find((m) => m.id === id)?.value ?? "n/a");

/**
 * The design summary. `batteries` supplies the main-armament summary; `month` is the design year.
 */
export function overviewModel(
  draft: DesignDraft,
  view: WorkshopView,
  batteries: readonly BatteryCard[],
  month: string,
  format: PresentationFormat,
): OverviewModel {
  const armour = view.compiled.armour;
  const main = batteries.filter((b) => b.row.role === "MAIN");
  const mainSummary =
    main.length === 0
      ? "No main battery"
      : main.map((b) => `${b.title} (${plural(b.row.barrels, "gun")})`).join(", ");
  const values: OverviewValue[] = [
    {
      id: "type",
      label: "Type and role",
      value: `${words(draft.requirement.category)} · ${view.classCode}`,
    },
    { id: "year", label: "Design year", value: month.slice(0, 4) },
    {
      id: "displacement",
      label: "Displacement",
      value: `${metric(view, "displacement")} of ${format.measurement(view.buoyantKg, "mass", {
        maximumFractionDigits: 0,
      })} capacity`,
    },
    {
      id: "cost",
      label: "Cost",
      value: format.moneyFromMicro(view.forecast.costMicro),
    },
    { id: "speed", label: "Speed", value: metric(view, "speed") },
    { id: "range", label: "Range", value: metric(view, "range") },
    {
      id: "armour",
      label: "Armour",
      value:
        armour === null
          ? "None"
          : `${format.percent(armour.coverageBp, 0)} coverage · ${format.measurement(
              armour.totalWeightKg,
              "mass",
              { maximumFractionDigits: 0 },
            )}`,
    },
    { id: "armament", label: "Main armament", value: mainSummary },
    { id: "crew", label: "Crew", value: metric(view, "crew") },
    {
      id: "accommodation",
      label: "Accommodation",
      value: `${words(draft.requirement.accommodationStandard)} standard`,
    },
    {
      id: "technology",
      label: "Technology",
      value: `${words(draft.requirement.modernizationExpectation)} modernization · threat ${words(
        draft.requirement.designThreatId,
      )}`,
    },
    { id: "role", label: "Role estimate", value: view.naturalClass ?? view.classCode },
  ];
  const warnings: OverviewWarning[] = (
    ["BLOCKING", "CRITICAL", "WARNING", "ADVISORY"] as const
  ).map((severity) => ({ severity, count: view.counts[severity] }));
  return { values, warnings };
}
