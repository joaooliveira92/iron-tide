export interface NationalCurrencyScale {
  readonly numerator: number;
  readonly denominator: number;
}

export interface NationalCurrencyPeriod {
  readonly fromYear: number;
  readonly toYear: number;
}

export interface NationalCurrencyConfiguration {
  readonly id: string;
  readonly nationId: string;
  readonly displayName: string;
  readonly symbol: string;
  readonly symbolPosition: "prefix" | "suffix";
  readonly spacing: boolean;
  readonly decimals: number;
  readonly grouping: boolean;
  readonly negatives: "minus" | "parentheses";
  readonly scale: NationalCurrencyScale | null;
  readonly period: NationalCurrencyPeriod;
  readonly source: string;
  readonly interpretation: "relabel" | "transform";
}
