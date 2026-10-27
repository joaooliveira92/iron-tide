import type { ExplanationTree } from "@bluewave/events";
import { topsideLoad, type Finding, type Severity, type WorkshopView } from "@bluewave/ship-design";
import { passesFilter } from "../../components/design-workspace/validation/severity.js";
import { formatExplanation, type PresentationFormat } from "../../lib/presentation-format/index.js";

export type ReadoutTone = "neutral" | "warn" | "bad";

export interface ReadoutRow {
  readonly label: string;
  readonly value: string;
}

export interface ReadoutBreakdown {
  readonly title: string;
  readonly rows: readonly ReadoutRow[];
  readonly footer?: readonly ReadoutRow[];
  readonly causes: readonly string[];
}

export interface ReadoutHint {
  readonly title: string;
  readonly lines: readonly ReadoutRow[];
}

export interface ReadoutExplanation {
  readonly tree: ExplanationTree;
  readonly area: string;
  readonly summaryKey: string;
}

export interface EngineeringReadout {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly tone: ReadoutTone;
  readonly breakdown?: ReadoutBreakdown;
  readonly hint?: ReadoutHint;
  readonly explanations?: readonly ReadoutExplanation[];
}

const t = (format: PresentationFormat, kg: number) =>
  format.measurement(kg, "mass", { maximumFractionDigits: 0 });
const pounds = (format: PresentationFormat, micro: number) => format.moneyFromMicro(micro);
const kn = (format: PresentationFormat, milli: number) =>
  `${format.number(milli / 1000, { maximumFractionDigits: 1 })} kn`;
const metres = (format: PresentationFormat, mm: number) =>
  `${format.number(mm / 1000, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} m`;
const m2 = (format: PresentationFormat, mm2: number) =>
  format.number(mm2 / 1_000_000, { maximumFractionDigits: 1 });

const TONE_RANK: Readonly<Record<ReadoutTone, number>> = { neutral: 0, warn: 1, bad: 2 };
const worst = (tones: readonly ReadoutTone[]): ReadoutTone =>
  tones.reduce((a, b) => (TONE_RANK[b] > TONE_RANK[a] ? b : a), "neutral");

const toneOfSeverity = (severity: Severity): ReadoutTone =>
  passesFilter(severity, "serious") ? "bad" : "warn";

const toneOf = (findings: readonly Finding[], ids: readonly string[]): ReadoutTone =>
  worst(findings.filter((f) => ids.includes(f.id)).map((f) => toneOfSeverity(f.severity)));

const STABILITY_CAUSE = /^STABILITY_/;

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function splitTonnes(
  parts: readonly { readonly label: string; readonly kg: number }[],
  totalTonnes: number,
  format: PresentationFormat,
): ReadoutRow[] {
  const floors = parts.map((p) => Math.floor(p.kg / 1000));
  const remaining = totalTonnes - floors.reduce((a, b) => a + b, 0);
  const order = parts
    .map((p, i) => ({ i, frac: p.kg / 1000 - Math.floor(p.kg / 1000) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const extra = parts.map(() => 0);
  for (let k = 0; k < remaining && k < order.length; k++) {
    const target = order[k]!.i;
    extra[target] = (extra[target] ?? 0) + 1;
  }
  return parts.map((p, i) => ({
    label: p.label,
    value: format.measurement((floors[i]! + extra[i]!) * 1000, "mass", {
      maximumFractionDigits: 0,
    }),
  }));
}

export function engineeringStatus(
  view: WorkshopView,
  format: PresentationFormat,
): readonly EngineeringReadout[] {
  const findings = view.compiled.findings;
  const marginKg = view.ledger.find((r) => r.category === "margin")?.kg ?? 0;
  const reserveKg = view.ledger.find((r) => r.category === "reserve")?.kg ?? 0;
  const remainingKg = view.buoyantKg - view.totalKg;

  const weightTone = worst([
    view.totalKg > view.buoyantKg ? "bad" : "neutral",
    toneOf(findings, ["OVERWEIGHT_LIMIT", "OVERWEIGHT_UNRECOVERABLE", "HULL_BUOYANCY_MISMATCH"]),
  ]);

  const cb = view.forecast.costBreakdown;
  const stabilityFindings = findings.filter((f) => STABILITY_CAUSE.test(f.id));
  const stability = view.compiled.stability;
  const load = topsideLoad(view.compiled.arrangement);
  const warnings = view.counts.CRITICAL + view.counts.WARNING;

  return [
    {
      id: "displacement",
      label: "Displacement",
      value: `${t(format, view.totalKg)} / ${t(format, view.buoyantKg)}`,
      tone: weightTone,
      breakdown: {
        title: "Weight breakdown",
        rows: splitTonnes(
          view.ledger.map((r) => ({ label: title(r.category), kg: r.kg })),
          Math.round(view.totalKg / 1000),
          format,
        ),
        footer: [
          { label: "Current", value: t(format, view.totalKg) },
          { label: "Capacity", value: t(format, view.buoyantKg) },
          { label: "Remaining", value: t(format, remainingKg) },
        ],
        causes: [],
      },
    },
    {
      id: "cost",
      label: "Cost",
      value: pounds(format, cb.total),
      tone: "neutral",
      breakdown: {
        title: "Cost breakdown",
        rows: [
          { label: "Hull", value: pounds(format, cb.hull) },
          { label: "Machinery", value: pounds(format, cb.machinery) },
          { label: "Armour", value: pounds(format, cb.armour) },
          { label: "Fittings", value: pounds(format, cb.components) },
          { label: "Subtotal", value: pounds(format, cb.subtotal) },
          { label: "Overheads", value: pounds(format, cb.overheads) },
          ...(cb.firstOfClassPremium > 0
            ? [{ label: "First of class", value: pounds(format, cb.firstOfClassPremium) }]
            : []),
          ...(cb.accelerationPremium > 0
            ? [{ label: "Acceleration", value: pounds(format, cb.accelerationPremium) }]
            : []),
        ],
        footer: [{ label: "Total", value: pounds(format, cb.total) }],
        causes: [],
      },
    },
    {
      id: "speed",
      label: "Speed",
      value: kn(format, view.compiled.machinery?.maxSpeedMilliKnots ?? 0),
      tone: toneOf(findings, ["PLANT_INSUFFICIENT", "SPEED_OUT_OF_RANGE"]),
    },
    {
      id: "range",
      label: "Range",
      value: `${format.number(view.compiled.machinery?.rangeNmAtCruise ?? 0)} nm`,
      tone: toneOf(findings, ["RANGE_BELOW_REQUIREMENT"]),
    },
    {
      id: "stability",
      label: "Stability",
      value: stability ? metres(format, stability.gmMm) : "n/a",
      tone: worst(stabilityFindings.map((f) => toneOfSeverity(f.severity))),
      breakdown: {
        title: "Stability causes",
        rows: stability
          ? [
              { label: "GM", value: metres(format, stability.gmMm) },
              { label: "KB", value: metres(format, stability.kbMm) },
              { label: "BM", value: metres(format, stability.bmMm) },
              { label: "KG", value: metres(format, stability.kgMm) },
            ]
          : [],
        causes: !stability
          ? ["Not calculated: resolve the blocking findings first."]
          : stabilityFindings.length > 0
            ? stabilityFindings.map(
                (f) => `${formatExplanation(f.what)} ${formatExplanation(f.why)}`,
              )
            : ["Within safe limits."],
      },
    },
    {
      id: "topside",
      label: "Topside load",
      value: `${m2(format, load.usedMm2)} / ${m2(format, load.capacityMm2)} m²`,
      tone: load.status === "exceeded" ? "bad" : load.status === "warning" ? "warn" : "neutral",
    },
    {
      id: "remaining",
      label: "Remaining",
      value: t(format, remainingKg),
      tone: remainingKg < 0 ? "bad" : weightTone,
      hint: {
        title: "Available weight",
        lines: [
          { label: "Committed", value: t(format, view.totalKg - marginKg - reserveKg) },
          { label: "Reserved", value: t(format, marginKg + reserveKg) },
          { label: "Free", value: t(format, remainingKg) },
        ],
      },
    },
    {
      id: "warnings",
      label: "Warnings",
      value: format.count(warnings),
      tone: warnings > 0 ? "warn" : "neutral",
    },
  ];
}
