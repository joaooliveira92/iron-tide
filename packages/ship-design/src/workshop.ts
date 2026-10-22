import {
  compileDesign,
  type CompiledDesign,
  type DesignDraft,
  type ShipContext,
} from "./compile.js";
import {
  buildTimeIsProvisional,
  planConstruction,
  type ConstructionBalance,
  type LineId,
} from "./construction.js";
import { groupedInteger } from "./numberText.js";
import { quantity, type ExplanationText } from "./explanation.js";
import { classCode } from "./classification.js";
import { computeCost, type CostBalance, type CostBreakdown, type CostContext } from "./cost.js";
import { computeCve, CVE_LABEL, type CveBalance } from "./cve.js";
import type { Finding, Severity } from "./findings.js";
import { LEDGER_CATEGORIES, type LedgerCategory } from "./ledger.js";
import { chooseYard, yardDemandOf } from "./yardChoice.js";
import { yardMisfits, type Yard, type YardLimit } from "./yards.js";

export interface WorkshopEnvironment {
  readonly ctx: ShipContext;
  readonly costBalance: CostBalance;
  readonly costCtx: CostContext;
  readonly constructionBalance: ConstructionBalance;
  readonly cveBalance: CveBalance;
  readonly yards: readonly Yard[];
  readonly industryBp?: number;
}

export interface LedgerRow {
  readonly category: LedgerCategory;
  readonly kg: number;
  readonly shareBp: number;
}

export interface Metric {
  readonly id: string;
  readonly label: string;
  readonly value: ExplanationText;
  readonly tone: "ok" | "warn" | "bad" | "neutral";
}

export interface YardOption {
  readonly yardId: string;
  readonly maxLengthMm: number;
  readonly maxBeamMm: number;
  readonly maxDisplacementKg: number;
  readonly craneLiftKg: number;
  readonly exceeds: readonly YardLimit[];
  readonly months: number | null;
  readonly chosen: boolean;
}

export interface WorkshopView {
  readonly valid: boolean;
  readonly naturalClass: string | null;
  readonly classCode: string;
  readonly totalKg: number;
  readonly buoyantKg: number;
  readonly ledger: readonly LedgerRow[];
  readonly metrics: readonly Metric[];
  readonly findingsBySeverity: Readonly<Record<Severity, readonly Finding[]>>;
  readonly counts: Readonly<Record<Severity, number>>;
  readonly forecast: {
    readonly costMicro: number;
    readonly monthlyMaintenanceMicro: number;
    readonly months: number | null;
    readonly historicalMonths: number | null;
    readonly historicalProvisional: boolean;
    readonly bottleneck: LineId | null;
    readonly yardId: string | null;
    readonly yards: readonly YardOption[];
    readonly note: string | null;
    readonly costBreakdown: CostBreakdown;
  };
  readonly cve: { readonly label: string; readonly cveBp: number };
  readonly compiled: CompiledDesign;
}

const t = (kg: number) => groupedInteger(Math.round(kg / 1000));

export function buildWorkshopView(draft: DesignDraft, env: WorkshopEnvironment): WorkshopView {
  const c = compileDesign(draft, env.ctx);
  const plant = env.ctx.plants.find((p) => p.id === draft.machinery.plantId);
  const counts: Record<Severity, number> = { BLOCKING: 0, CRITICAL: 0, WARNING: 0, ADVISORY: 0 };
  const grouped: Record<Severity, Finding[]> = {
    BLOCKING: [],
    CRITICAL: [],
    WARNING: [],
    ADVISORY: [],
  };
  for (const f of c.findings) {
    counts[f.severity]++;
    grouped[f.severity].push(f);
  }
  const ledger: LedgerRow[] = LEDGER_CATEGORIES.map((cat) => ({
    category: cat,
    kg: c.ledger[cat],
    shareBp: c.totalKg === 0 ? 0 : Math.floor((c.ledger[cat] * 10_000) / c.totalKg),
  }));

  const cost = computeCost(c, draft, env.costBalance, env.costCtx);
  const req = draft.requirement;
  const vmax = c.machinery?.maxSpeedMilliKnots ?? 0;
  const range = c.machinery?.rangeNmAtCruise ?? 0;
  const metrics: Metric[] = [
    {
      id: "displacement",
      label: "Displacement",
      value: `${t(c.totalKg)} t`,
      tone: c.hull.findings.some((f) => f.severity === "BLOCKING") ? "bad" : "neutral",
    },
    {
      id: "speed",
      label: "Top speed",
      value: [
        quantity(vmax, 1000, 1, "knots"),
        " (need ",
        quantity(req.requiredSpeedMilliKnots, 1000, 1),
        ")",
      ],
      tone: vmax >= req.requiredSpeedMilliKnots ? "ok" : "warn",
    },
    {
      id: "range",
      label: "Range",
      value: [
        `${groupedInteger(range)} nm at `,
        quantity(req.cruiseSpeedMilliKnots, 1000, 1, "knots"),
        ` (need ${groupedInteger(req.requiredRangeNm)})`,
      ],
      tone: range >= req.requiredRangeNm ? "ok" : "warn",
    },
    {
      id: "stability",
      label: "Metacentric height",
      value: c.stability ? [quantity(c.stability.gmMm, 1000, 2, "metres")] : "n/a",
      tone: c.stability
        ? c.findings.some((f) => f.id.startsWith("STABILITY_") && f.severity !== "ADVISORY")
          ? "bad"
          : "ok"
        : "neutral",
    },
    {
      id: "trim",
      label: "Trim",
      value: c.stability ? [quantity(c.stability.trimBp, 100, 1, "trimPercent")] : "n/a",
      tone: c.findings.some((f) => f.id.startsWith("TRIM_")) ? "warn" : "ok",
    },
    {
      id: "stress",
      label: "Hull girder stress",
      value: c.stability ? [quantity(c.stability.stressBp, 100, 0, "percentOfLimit")] : "n/a",
      tone:
        c.stability && c.stability.stressBp > 10_000
          ? "bad"
          : c.stability && c.stability.stressBp > 8_000
            ? "warn"
            : "ok",
    },
    {
      id: "crew",
      label: "Crew / berths",
      value: c.systems ? `${c.systems.crewRequired} / ${c.systems.crewCapacity}` : "n/a",
      tone: c.systems && c.systems.crewRequired > c.systems.crewCapacity ? "bad" : "ok",
    },
    {
      id: "reserve",
      label: "Reserve buoyancy",
      value: [quantity(c.hull.reserveBuoyancyBp, 100, 0, "percentSpaced")],
      tone: c.findings.some((f) => f.id === "LOW_RESERVE_BUOYANCY") ? "warn" : "ok",
    },
  ];

  let months: number | null = null;
  let historicalMonths: number | null = null;
  let historicalProvisional = false;
  let bottleneck: LineId | null = null;
  let note: string | null = null;
  let yardId: string | null = null;
  let yardOptions: YardOption[] = [];
  if (c.valid) {
    try {
      const plan = planConstruction(c, draft, cost, env.constructionBalance, true);
      const demand = yardDemandOf(c, draft);
      const choice = chooseYard(plan, demand, env.yards, env.constructionBalance, c.totalKg, {
        month: env.ctx.month,
        industryBp: env.industryBp,
        accelerated: env.costCtx.accelerated,
      });
      const { fitting, best, monthsByYard } = choice;
      const hist = choice.historicalMonths;
      if (best === null) {
        note =
          fitting.length === 0
            ? "No shipyard can build this hull."
            : `No shipyard that can hold this hull finishes it within ${env.constructionBalance.maxMonths} months (largest: ${fitting[fitting.length - 1]!.facility.id}).`;
      } else {
        historicalMonths = hist;
        historicalProvisional = buildTimeIsProvisional(
          c.totalKg,
          env.constructionBalance,
          env.ctx.month,
        );
        months = best.months;
        bottleneck = best.schedule.bottleneck;
        yardId = best.yard.facility.id;
      }
      yardOptions = env.yards.map((y) => ({
        yardId: y.facility.id,
        maxLengthMm: y.facility.maxLengthMm,
        maxBeamMm: y.facility.maxBeamMm,
        maxDisplacementKg: y.facility.maxDisplacementKg,
        craneLiftKg: y.facility.craneLiftKg,
        exceeds: yardMisfits(y.facility, demand),
        months: monthsByYard.get(y.facility.id) ?? null,
        chosen: y.facility.id === yardId,
      }));
    } catch (e) {
      note = e instanceof Error ? e.message : String(e);
    }
  } else {
    note = "Resolve blocking findings to get a schedule.";
  }
  const cve = computeCve(
    c,
    draft,
    c.machinery?.reliabilityBp ?? plant?.reliabilityBp ?? 0,
    env.cveBalance,
  );
  return {
    valid: c.valid,
    naturalClass: c.naturalClass,
    classCode: classCode(draft.requirement.category, c.components),
    totalKg: c.totalKg,
    buoyantKg: c.hull.buoyantKg,
    ledger,
    metrics,
    findingsBySeverity: grouped,
    counts,
    forecast: {
      costMicro: cost.total,
      monthlyMaintenanceMicro: cost.monthlyMaintenance,
      months,
      historicalMonths,
      historicalProvisional,
      bottleneck,
      yardId,
      yards: yardOptions,
      note,
      costBreakdown: cost,
    },
    cve: { label: CVE_LABEL, cveBp: cve.cveBp },
    compiled: c,
  };
}
