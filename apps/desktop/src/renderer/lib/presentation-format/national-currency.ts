/**
 * The national-historical currency configuration (U-3 map D4, ADR-0211). This is
 * the render shape shared by the formatter (ticket 02) and the strict content
 * schema + production validation (ticket 04). U-3 ships the schema and validation
 * only; no production configuration is authored (a per-nation data decision).
 *
 * Every scale is an exact integer ratio, never a floating-point factor, so a
 * configuration can never introduce drift.
 */

export interface NationalCurrencyScale {
  /** Exact integer numerator of the display-value multiplier. */
  readonly numerator: number;
  /** Exact integer denominator of the display-value multiplier (> 0). */
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
  /** Whether a space separates the symbol from the amount. */
  readonly spacing: boolean;
  readonly decimals: number;
  readonly grouping: boolean;
  readonly negatives: "minus" | "parentheses";
  /** `null` = relabel the canonical value; otherwise an exact integer scale. */
  readonly scale: NationalCurrencyScale | null;
  readonly period: NationalCurrencyPeriod;
  /** A cited primary source; required for production (ticket 04). */
  readonly source: string;
  readonly interpretation: "relabel" | "transform";
}
