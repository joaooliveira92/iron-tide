import type { BatteryCard } from "../../components/design-workspace/batteryView.js";
import type { DesignDraft, Severity, ThreatProfile, WorkshopView } from "@bluewave/ship-design";
import { plural } from "../../components/design-workspace/plural.js";
import { formatExplanation } from "../../../shared/explanation-text.js";
import type { DesignPriceView } from "../../components/design-workspace/design-price-view.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import {
  naturalClassValue,
  shipTypeValue,
  TERMS,
  threatDisplayName,
} from "../../components/design-workspace/design-terms.js";

export interface OverviewValue {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface OverviewWarning {
  readonly severity: Severity;
  readonly count: number;
  readonly gloss: string | null;
}

type Requirement = DesignDraft["requirement"];

const ACCOMMODATION_NAME: Record<Requirement["accommodationStandard"], string> = {
  SPARTAN: "Spartan",
  STANDARD: "Standard",
  GENEROUS: "Generous",
};

const UPGRADE_NAME: Record<Requirement["modernizationExpectation"], string> = {
  NONE: "none",
  MINOR: "minor",
  MAJOR: "major",
};

const SEVERITY_GLOSS: Record<Severity, string> = {
  BLOCKING: "cannot be built",
  CRITICAL: "can be built but will fail in play",
  WARNING: "can be built; worth reviewing before submission",
  ADVISORY: "does not prevent submission",
};

export interface OverviewModel {
  readonly values: readonly OverviewValue[];
  readonly warnings: readonly OverviewWarning[];
}

const metric = (view: WorkshopView, id: string): string =>
  formatExplanation(view.metrics.find((m) => m.id === id)?.value ?? "n/a");

export function overviewModel(
  draft: DesignDraft,
  view: WorkshopView,
  batteries: readonly BatteryCard[],
  month: string,
  format: PresentationFormat,
  price: DesignPriceView,
  threats: readonly ThreatProfile[],
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
      label: TERMS.shipType,
      value: shipTypeValue(draft.requirement.category),
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
      value: [
        price.treasuryText ?? price.unitsText,
        format.moneyFromMicro(view.forecast.costMicro),
        ...(price.overBudgetText === null ? [] : [price.overBudgetText]),
      ].join(" · "),
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
      value: ACCOMMODATION_NAME[draft.requirement.accommodationStandard],
    },
    {
      id: "technology",
      label: TERMS.plannedUpgrades,
      value: `${UPGRADE_NAME[draft.requirement.modernizationExpectation]} · expected enemy gun ${threatDisplayName(
        threats,
        draft.requirement.designThreatId,
      )}`,
    },
    {
      id: "role",
      label: TERMS.naturalClass,
      value: naturalClassValue(view.naturalClass, draft.requirement.category),
    },
  ];
  const warnings: OverviewWarning[] = (
    ["BLOCKING", "CRITICAL", "WARNING", "ADVISORY"] as const
  ).map((severity) => ({
    severity,
    count: view.counts[severity],
    gloss: SEVERITY_GLOSS[severity] ?? null,
  }));
  return { values, warnings };
}
