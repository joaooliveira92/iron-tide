# D4: Currency display modes, availability, and effective resolution

**Type:** grilling · **Status:** resolved

## Question

How are the three currency-display modes formatted, how is availability
determined, and how is the requested mode resolved to an effective mode?

## Answer

The formatter renders canonical `Money` (treasury units, one unit = GBP 10,000,
ADR-0216) in the effective mode:

- **Naval Credits (NC)** — the default comparison unit over canonical values
  (ADR-0206): labels and formatting only, no exchange-rate table.
- **Budget Points (BP)** — an abstract display unit over the same canonical values
  (ADR-0207): labels and formatting only, no second economy.
- **National Historical** — the active nation's validated historical currency
  (ADR-0211): symbol and position, spacing, decimals, grouping, negatives, scale
  rules, period; a relabel-or-transform configuration with a cited source.

Availability is computed from the **active campaign** and the validated
national-currency configuration (D7); `NationalCurrencyAvailability` and the
`CurrencyFallbackReason` codes (`noActiveNation`, `nationalCurrencyNotConfigured`,
`nationalCurrencyInvalid`, `nationalCurrencyOutsideSupportedPeriod`) already exist
in the U-2 contract. The **effective** mode is the request when available, else
`navalCredits` with the reason code; the stored request is never rewritten
(ADR-0211). Each reason code maps to a localized message, and **Naval Credits is
the render and malformed-content fallback, never silent in the UI**. With no
per-nation configurations shipping (D7), National Historical is unavailable with
`nationalCurrencyNotConfigured` — an honest, stated outcome, not a fabrication.

## Why

ADR-0206/0207/0208/0211 define the three modes, the default, the no-custom-currency
rule, and the requested/effective split; the manual offers no currency display and
no national symbols (`docs/research/u-1-canonical-values.md` §4). Computing
availability from real content and falling back with a reason code keeps the game
truthful and changes no authoritative value.
