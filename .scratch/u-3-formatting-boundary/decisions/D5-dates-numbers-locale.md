# D5: Campaign dates, localized numbers, and the language/locale split

**Type:** grilling · **Status:** resolved

## Question

How are dates and ordinary numbers formatted, and how is UI language kept
separate from formatting locale?

## Answer

- **Dates** are campaign months only: a canonical integer `(year, month)`
  (`packages/campaign/src/timeline.ts`; no wall clock, ADR-0215) is formatted by
  the module into a localized month-year string. The existing renderer month
  names (`campaign-month.ts`) become a locale-driven implementation behind the
  module, not a second source. No `Date`/wall-clock value is ever formatted.
- **Numbers** are rendered by the module through the chosen `formattingLocale`,
  honoring `numberScale` (`full` | `abbreviated`, e.g. `123k`), with grouping and
  decimals from the locale. Percentages render from `Bp`.
- **Language vs locale** stay separate (ADR-0209): `language` selects the
  externalized string catalogue (English with a complete `en-US` fallback);
  `formattingLocale` selects number/date/measurement rendering. Neither derives
  from the other. The locale allowlist contains only locales with automated
  formatting tests (`FORMATTING_LOCALES`, initially `en-US`); an unsupported
  locale never becomes selectable.
- Tests pass an **explicit** locale and assert exact output, so no test depends on
  the host locale.

## Why

ADR-0209 requires the split and the tested-locale allowlist, and ADR-0218 fixes
the boundary; the manual is English-only and silent on locale
(`docs/research/rtw3-manual-baseline.md`, `u-1-canonical-values.md` §5). Campaign
time is canonical integer month/year with no wall clock (BW-DET-*, ADR-0215), so
date formatting is pure and deterministic in its input.
