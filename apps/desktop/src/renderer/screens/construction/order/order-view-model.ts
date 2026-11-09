import type {
  ConstructionBatchPreviewOutcome,
  ConstructionStudyEntry,
  ForeignConstructionPreviewOutcome,
} from "../../../../shared/construction-contract.js";

export interface OrderBuilderOption {
  readonly id: string | null;
  readonly label: string;
  readonly relation: string | null;
  readonly priceUnits: number | null;
  readonly months: number | null;
  readonly deliveryMonth: string | null;
  readonly refusal: string | null;
}

export interface OrderSummary {
  readonly builderLabel: string;
  readonly totalPrice: number;
  readonly months: number | null;
  readonly instalment: number;
  readonly deliveryMonth: string | null;
  readonly treasuryAfter: number;
}

export interface OrderViewModel {
  readonly status: "loading" | "ready" | "blocked" | "study";
  readonly builders: readonly OrderBuilderOption[];
  readonly summary: OrderSummary | null;
  readonly reason: string | null;
}

export interface OrderViewModelInput {
  readonly study: ConstructionStudyEntry | null;
  readonly home: ConstructionBatchPreviewOutcome | null;
  readonly foreign: ForeignConstructionPreviewOutcome | null;
  readonly builderNationId: string | null;
  readonly freeTreasury: number;
}

const HOME_LABEL = "Home yard";

export function studyReason(study: ConstructionStudyEntry): string {
  return `${study.className} is still in design study: ${study.monthsRemaining} more ${
    study.monthsRemaining === 1 ? "month" : "months"
  } and ${study.costRemaining} to fund. It can be ordered from ${study.readyMonth}.`;
}

function homeOption(home: ConstructionBatchPreviewOutcome | null): OrderBuilderOption {
  if (home === null || !home.ok) {
    return {
      id: null,
      label: HOME_LABEL,
      relation: null,
      priceUnits: null,
      months: null,
      deliveryMonth: null,
      refusal: home === null ? null : home.reason,
    };
  }
  const { quote } = home.preview;
  return {
    id: null,
    label: HOME_LABEL,
    relation: null,
    priceUnits: quote.totalPrice,
    months: quote.buildMonths,
    deliveryMonth: quote.deliveryMonth,
    refusal: null,
  };
}

function foreignOptions(
  foreign: ForeignConstructionPreviewOutcome | null,
): readonly OrderBuilderOption[] {
  if (foreign === null || !foreign.ok) return [];
  return foreign.preview.builders.map((builder) => ({
    id: builder.nationId,
    label: builder.name,
    relation: builder.relation,
    priceUnits: builder.quote.totalPriceUnits,
    months: builder.quote.months,
    deliveryMonth: builder.quote.plannedDeliveryMonth,
    refusal: builder.capabilitySatisfied
      ? null
      : (builder.capabilityFailureCode ?? "This yard cannot build the hull."),
  }));
}

export function orderViewModel(input: OrderViewModelInput): OrderViewModel {
  if (input.study !== null) {
    return { status: "study", builders: [], summary: null, reason: studyReason(input.study) };
  }
  const builders = [homeOption(input.home), ...foreignOptions(input.foreign)];
  const chosen = builders.find((option) => option.id === input.builderNationId);
  if (chosen === undefined || (chosen.id === null && input.home === null)) {
    return { status: "loading", builders, summary: null, reason: null };
  }
  if (chosen.refusal !== null) {
    return { status: "blocked", builders, summary: null, reason: chosen.refusal };
  }
  if (chosen.priceUnits === null) {
    return { status: "loading", builders, summary: null, reason: null };
  }
  const instalment =
    chosen.id === null
      ? input.home !== null && input.home.ok
        ? input.home.preview.quote.monthlyInstalment
        : 0
      : firstInstalment(input.foreign, chosen.id);
  return {
    status: "ready",
    builders,
    reason: null,
    summary: {
      builderLabel: chosen.label,
      totalPrice: chosen.priceUnits,
      months: chosen.months,
      instalment,
      deliveryMonth: chosen.deliveryMonth,
      treasuryAfter: input.freeTreasury - chosen.priceUnits,
    },
  };
}

function firstInstalment(foreign: ForeignConstructionPreviewOutcome | null, id: string): number {
  if (foreign === null || !foreign.ok) return 0;
  return foreign.preview.builders.find((b) => b.nationId === id)?.quote.firstInstalmentUnits ?? 0;
}
