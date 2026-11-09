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
  readonly formatMoney: (units: number) => string;
}

export const ORDER_QUANTITY_MIN = 1;
export const ORDER_QUANTITY_MAX = 12;

const HOME_LABEL = "Home yard";

const REFUSAL_WORDING: Readonly<Record<string, string>> = {
  SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT: "This hull is larger than your dock can build.",
  DOCK_TOO_SMALL: "The dock is too small.",
  FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT: "This yard lacks the capability to build this hull.",
  FOREIGN_BUILDER_CAPACITY_UNAVAILABLE: "This yard has no free capacity for this hull.",
  FOREIGN_BUILDER_NATION_INVALID: "This nation cannot be used as a builder.",
};

export function refusalWording(code: string): string {
  const known = REFUSAL_WORDING[code];
  if (known !== undefined) return known;
  const words = code.toLowerCase().replaceAll("_", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

export function studyReason(
  study: ConstructionStudyEntry,
  formatMoney: (units: number) => string,
): string {
  return `${study.className} is still in design study: ${study.monthsRemaining} more ${
    study.monthsRemaining === 1 ? "month" : "months"
  } and ${formatMoney(study.costRemaining)} to fund. It can be ordered from ${study.readyMonth}.`;
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
      refusal: home === null ? null : refusalWording(home.reason),
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
      : builder.capabilityFailureCode === null
        ? "This yard cannot build the hull."
        : refusalWording(builder.capabilityFailureCode),
  }));
}

export function orderViewModel(input: OrderViewModelInput): OrderViewModel {
  if (input.study !== null) {
    return {
      status: "study",
      builders: [],
      summary: null,
      reason: studyReason(input.study, input.formatMoney),
    };
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
