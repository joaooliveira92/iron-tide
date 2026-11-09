import type { ExplanationTree } from "@bluewave/events";
import type { AccelerationPreview, HaltPreview } from "@bluewave/phase-engine";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { translate } from "../../lib/strings.js";

const PREFIX = "construction.steering";
const SINGULAR_COUNT = 1;

export interface SteeringRowView {
  readonly label: string;
  readonly value: string;
  readonly explanation?: {
    readonly tree: ExplanationTree;
    readonly summaryKey: string;
  };
}

export interface SteeringConfirmView {
  readonly tip: string;
  readonly title: string;
  readonly description: string;
  readonly rows: readonly SteeringRowView[];
  readonly notes: readonly string[];
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

function monthsText(format: PresentationFormat, months: number): string {
  const key = months === SINGULAR_COUNT ? "months.one" : "months.other";
  return translate(`${PREFIX}.${key}`, { count: format.count(months) });
}

function riskText(format: PresentationFormat, preview: AccelerationPreview): string {
  return preview.delayRisk === "NONE"
    ? translate(`${PREFIX}.accelerate.riskNone`)
    : translate(`${PREFIX}.accelerate.riskPossible`, {
        chance: format.percent(preview.delayChanceBp, 1),
      });
}

export function accelerateView(
  shipName: string,
  preview: AccelerationPreview,
  format: PresentationFormat,
): SteeringConfirmView {
  const risk = riskText(format, preview);
  const saves = preview.monthsSaved > 0;
  const saved = saves
    ? monthsText(format, preview.monthsSaved)
    : translate(`${PREFIX}.accelerate.savedNone`);
  const premium = format.money(preview.premiumUnits);
  const notes = [
    ...(saves ? [] : [translate(`${PREFIX}.accelerate.noSavingNote`)]),
    ...(preview.fundsLimited ? [translate(`${PREFIX}.accelerate.fundsLimited`)] : []),
  ];
  const lead = saves
    ? translate(`${PREFIX}.accelerate.tip`, { saved, premium, risk })
    : translate(`${PREFIX}.accelerate.tipNoSaving`, {
        months: monthsText(format, preview.monthsAccelerated),
        now: monthsText(format, preview.monthsNow),
        premium,
        risk,
      });
  return {
    tip: lead + (preview.fundsLimited ? translate(`${PREFIX}.accelerate.tipFundsLimited`) : ""),
    title: translate(`${PREFIX}.accelerate.title`, { ship: shipName }),
    description: translate(`${PREFIX}.accelerate.description`),
    rows: [
      {
        label: translate(`${PREFIX}.accelerate.rowNow`),
        value: monthsText(format, preview.monthsNow),
      },
      {
        label: translate(`${PREFIX}.accelerate.rowAccelerated`),
        value: monthsText(format, preview.monthsAccelerated),
      },
      {
        label: translate(`${PREFIX}.accelerate.rowSaved`),
        value: saved,
        explanation: {
          tree: preview.monthsExplanation,
          summaryKey: "construction.construction_acceleration_months.summary",
        },
      },
      {
        label: translate(`${PREFIX}.accelerate.rowPremium`),
        value: premium,
        explanation: {
          tree: preview.premiumExplanation,
          summaryKey: "construction.construction_acceleration_premium.summary",
        },
      },
      {
        label: translate(`${PREFIX}.accelerate.rowRisk`),
        value: risk,
        explanation: {
          tree: preview.delayExplanation,
          summaryKey: "construction.construction_acceleration_delay.summary",
        },
      },
    ],
    notes,
    confirmLabel: translate(`${PREFIX}.accelerate.confirm`),
    cancelLabel: translate(`${PREFIX}.cancel`),
  };
}

export function haltView(
  shipName: string,
  preview: HaltPreview,
  format: PresentationFormat,
): SteeringConfirmView {
  const cost = format.money(preview.carryingCostUnits);
  const resume = translate(
    preview.resumeStatus === "ACTIVE"
      ? `${PREFIX}.halt.resumeActive`
      : `${PREFIX}.halt.resumeAwaiting`,
  );
  return {
    tip: translate(`${PREFIX}.halt.tip`, { cost, resume }),
    title: translate(`${PREFIX}.halt.title`, { ship: shipName }),
    description: translate(`${PREFIX}.halt.description`),
    rows: [
      {
        label: translate(`${PREFIX}.halt.rowCarrying`),
        value: translate(`${PREFIX}.halt.rowCarryingValue`, { cost }),
        explanation: {
          tree: preview.carryingExplanation,
          summaryKey: "construction.construction_halt_carrying.summary",
        },
      },
      { label: translate(`${PREFIX}.halt.rowResume`), value: resume },
    ],
    notes: preview.losesAcceleration ? [translate(`${PREFIX}.halt.losesAcceleration`)] : [],
    confirmLabel: translate(`${PREFIX}.halt.confirm`),
    cancelLabel: translate(`${PREFIX}.cancel`),
  };
}
