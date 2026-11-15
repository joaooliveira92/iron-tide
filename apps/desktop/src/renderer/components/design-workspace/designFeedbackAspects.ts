import type { ShipTypeRequirementCheck, WorkshopView } from "@bluewave/ship-design";

import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import type { DesignSectionId } from "../../screens/shipbuilding/design-sections.js";
import type { PartKind } from "./panels/hull-plan/anatomy/anatomy-types.js";
import type { AspectChange, FeedbackAspect, FeedbackTone } from "./designFeedbackTypes.js";
import { requirementLine } from "./panels/TypeRequirements.js";

type RequirementField = ShipTypeRequirementCheck["field"];
type MetricTone = WorkshopView["metrics"][number]["tone"];

interface Measured {
  readonly delta: number;
  readonly text: string;
  readonly tone?: FeedbackTone;
}

interface AspectSpec {
  readonly aspect: FeedbackAspect;
  readonly label: string;
  readonly section: DesignSectionId;
  readonly parts: readonly PartKind[];
  readonly better: "up" | "down" | "none";
  readonly metricId?: string;
  readonly requirementFields: readonly RequirementField[];
  readonly measure: (
    before: WorkshopView,
    after: WorkshopView,
    format: PresentationFormat,
  ) => Measured | null;
}

const plus = (value: number): string => (value > 0 ? "+" : "");
const direction = (value: number): AspectChange["direction"] =>
  value > 0 ? "up" : value < 0 ? "down" : "flat";
const toneRank: Readonly<Record<MetricTone, number>> = { neutral: 0, ok: 0, warn: 1, bad: 2 };

const bothMachinery = (before: WorkshopView, after: WorkshopView) => {
  const b = before.compiled.machinery;
  const a = after.compiled.machinery;
  return b !== null && a !== null ? { b, a } : null;
};

const broadsideKg = (view: WorkshopView): number => {
  const weapons = view.compiled.weapons;
  return weapons === null ? 0 : Math.max(weapons.broadsidePortKg, weapons.broadsideStbdKg);
};

const monthsText = (delta: number): string =>
  `${plus(delta)}${delta} ${Math.abs(delta) === 1 ? "month" : "months"}`;

const SPECS: readonly AspectSpec[] = [
  {
    aspect: "speed",
    label: "Speed",
    section: "machinery",
    parts: ["funnel"],
    better: "up",
    metricId: "speed",
    requirementFields: ["speed"],
    measure: (before, after, format) => {
      const m = bothMachinery(before, after);
      if (m === null) return null;
      const delta = m.a.maxSpeedMilliKnots - m.b.maxSpeedMilliKnots;
      return {
        delta,
        text: `${plus(delta)}${format.number(delta / 1000, { maximumFractionDigits: 1 })} kn`,
      };
    },
  },
  {
    aspect: "range",
    label: "Range",
    section: "machinery",
    parts: ["funnel"],
    better: "up",
    metricId: "range",
    requirementFields: [],
    measure: (before, after, format) => {
      const m = bothMachinery(before, after);
      if (m === null) return null;
      const delta = m.a.rangeNmAtCruise - m.b.rangeNmAtCruise;
      return {
        delta,
        text: `${plus(delta)}${format.number(delta, { maximumFractionDigits: 0 })} nm`,
      };
    },
  },
  {
    aspect: "displacement",
    label: "Displacement",
    section: "hull",
    parts: ["hull"],
    better: "none",
    metricId: "displacement",
    requirementFields: ["displacement"],
    measure: (before, after, format) => {
      const delta = after.totalKg - before.totalKg;
      return {
        delta,
        text: `${plus(delta)}${format.measurement(delta, "mass", { maximumFractionDigits: 0 })}`,
      };
    },
  },
  {
    aspect: "buoyancy",
    label: "Reserve buoyancy",
    section: "hull",
    parts: ["hull", "deck"],
    better: "up",
    metricId: "reserve",
    requirementFields: [],
    measure: (before, after, format) => {
      const delta = after.compiled.hull.reserveBuoyancyBp - before.compiled.hull.reserveBuoyancyBp;
      return { delta, text: `${plus(delta)}${format.percent(delta, 1)}` };
    },
  },
  {
    aspect: "stability",
    label: "Stability",
    section: "hull",
    parts: ["hull", "superstructure"],
    better: "none",
    metricId: "stability",
    requirementFields: [],
    measure: (before, after, format) => {
      const b = before.compiled.stability;
      const a = after.compiled.stability;
      if (b === null || a === null) return null;
      const delta = a.gmMm - b.gmMm;
      return {
        delta,
        text: `${plus(delta)}${format.number(delta / 1000, { maximumFractionDigits: 2 })} m GM`,
      };
    },
  },
  {
    aspect: "protection",
    label: "Protection",
    section: "protection",
    parts: ["armour"],
    better: "up",
    requirementFields: ["belt", "qualifyingArmour"],
    measure: (before, after, format) => {
      const b = before.compiled.armour;
      const a = after.compiled.armour;
      const coverage = (a?.coverageBp ?? 0) - (b?.coverageBp ?? 0);
      if (coverage !== 0)
        return {
          delta: coverage,
          text: `${plus(coverage)}${format.percent(coverage, 0)} coverage`,
        };
      const weight = (a?.totalWeightKg ?? 0) - (b?.totalWeightKg ?? 0);
      return {
        delta: weight,
        text: `${plus(weight)}${format.measurement(weight, "mass", { maximumFractionDigits: 0 })} armour`,
      };
    },
  },
  {
    aspect: "firepower",
    label: "Firepower",
    section: "armament",
    parts: ["weapon"],
    better: "up",
    requirementFields: ["mainGun", "turrets", "torpedoes"],
    measure: (before, after, format) => {
      const delta = broadsideKg(after) - broadsideKg(before);
      return {
        delta,
        text: `${plus(delta)}${format.measurement(delta, "mass", { maximumFractionDigits: 1 })} broadside`,
      };
    },
  },
  {
    aspect: "cost",
    label: "Cost",
    section: "overview",
    parts: [],
    better: "down",
    requirementFields: [],
    measure: (before, after, format) => {
      const delta = after.forecast.costMicro - before.forecast.costMicro;
      return { delta, text: `${plus(delta)}${format.moneyFromMicro(delta)}` };
    },
  },
  {
    aspect: "build-time",
    label: "Build time",
    section: "overview",
    parts: ["slipway"],
    better: "down",
    requirementFields: [],
    measure: (before, after) => {
      const b = before.forecast.months;
      const a = after.forecast.months;
      if (b === null && a === null) return null;
      if (b === null) return { delta: 0, text: "schedule available", tone: "better" };
      if (a === null) return { delta: 0, text: "no schedule", tone: "worse" };
      return { delta: a - b, text: monthsText(a - b) };
    },
  },
  {
    aspect: "maintenance",
    label: "Maintenance",
    section: "overview",
    parts: [],
    better: "down",
    requirementFields: [],
    measure: (before, after, format) => {
      const delta =
        after.forecast.monthlyMaintenanceMicro - before.forecast.monthlyMaintenanceMicro;
      return { delta, text: `${plus(delta)}${format.moneyFromMicro(delta)} / month` };
    },
  },
];

const metricTone = (view: WorkshopView, id: string): MetricTone | null =>
  view.metrics.find((m) => m.id === id)?.tone ?? null;

interface RequirementFlip {
  readonly tone: FeedbackTone;
  readonly broken: readonly ShipTypeRequirementCheck[];
}

const requirementFlip = (
  before: WorkshopView,
  after: WorkshopView,
  fields: readonly RequirementField[],
): RequirementFlip => {
  if (before.requirements.status !== "CLASSIFIED" || after.requirements.status !== "CLASSIFIED")
    return { tone: "neutral", broken: [] };
  const broken: ShipTypeRequirementCheck[] = [];
  let better = false;
  for (const check of after.requirements.checks) {
    if (!fields.includes(check.field)) continue;
    const prior = before.requirements.checks.find((c) => c.field === check.field);
    if (prior === undefined || prior.met === check.met) continue;
    if (check.met) better = true;
    else broken.push(check);
  }
  const tone: FeedbackTone = broken.length > 0 ? "worse" : better ? "better" : "neutral";
  return { tone, broken };
};

const withBrokenRequirements = (
  text: string,
  flip: RequirementFlip,
  format: PresentationFormat,
): string =>
  flip.broken.length === 0
    ? text
    : `${text}, breaks ${flip.broken.map((c) => requirementLine(c, format)).join(" and ")}`;

const byDirection = (rule: AspectSpec["better"], delta: number): FeedbackTone => {
  if (rule === "none" || delta === 0) return "neutral";
  return delta > 0 === (rule === "up") ? "better" : "worse";
};

const toneOf = (
  spec: AspectSpec,
  measured: Measured,
  flip: RequirementFlip,
  before: WorkshopView,
  after: WorkshopView,
): FeedbackTone => {
  if (measured.tone !== undefined) return measured.tone;
  if (flip.tone !== "neutral") return flip.tone;
  if (spec.metricId !== undefined) {
    const b = metricTone(before, spec.metricId);
    const a = metricTone(after, spec.metricId);
    if (b !== null && a !== null && toneRank[b] !== toneRank[a])
      return toneRank[a] > toneRank[b] ? "worse" : "better";
  }
  return byDirection(spec.better, measured.delta);
};

export function diffAspects(
  before: WorkshopView,
  after: WorkshopView,
  format: PresentationFormat,
): readonly AspectChange[] {
  const out: AspectChange[] = [];
  for (const spec of SPECS) {
    const measured = spec.measure(before, after, format);
    if (measured === null) continue;
    if (measured.delta === 0 && measured.tone === undefined) continue;
    const flip = requirementFlip(before, after, spec.requirementFields);
    const change: AspectChange = {
      aspect: spec.aspect,
      label: spec.label,
      text: withBrokenRequirements(measured.text, flip, format),
      direction: direction(measured.delta),
      tone: toneOf(spec, measured, flip, before, after),
      parts: spec.parts,
      section: spec.section,
      ...(spec.metricId === undefined ? {} : { metricId: spec.metricId }),
    };
    out.push(change);
  }
  return out;
}
