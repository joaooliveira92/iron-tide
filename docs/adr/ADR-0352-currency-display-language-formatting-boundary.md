# ADR-0352: Currency display modes, UI language, and formatting boundary

Consolidates: ADR-0206, ADR-0207, ADR-0208, ADR-0209, ADR-0211, ADR-0218

Applies to: contracts, desktop, messages, campaign-engine

Rule: Currency is displayed as Naval Credits (default), Budget Points, or National Historical (when a validated configuration exists); UI language and formatting locale are independent preferences; all canonical→display conversions happen exclusively at the presentation boundary.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0206
Supersedes: ADR-0207
Supersedes: ADR-0208
Supersedes: ADR-0209
Supersedes: ADR-0211
Supersedes: ADR-0218

## Context

The game needs a single comparison currency not tied to any nation's historical money that carries no exchange-rate assumptions. Players may also want an abstract, nation-neutral framing of budget values distinct from that comparison currency. A user-defined display currency (arbitrary symbol, name, and conversion factor) is tempting but raises unresolved questions about value, conversion, rounding, persistence, and inputs, and risks giving the impression of a supported economy that the game does not model.

Language and locale are separate concerns: a player may read English while preferring a different numeric and date formatting locale. Shipping placeholder languages would present untranslated UI as complete.

Naval Credits is the standardized comparison currency. Some players prefer a nation's historical currency, but that requires a validated per-nation configuration (identifier, names, symbol and position, spacing, decimals, grouping, negatives, scale rules, period, source, gameplay interpretation, and relabel-or-transform semantics).

Before this consolidation, presentation leaked inward. A domain package (`packages/campaign-engine/src/priorities.ts`) built human-readable strings with `toLocaleString`/`toFixed`, and display formatting was scattered across renderer call sites with mixed locales and hardcoded symbols. UI language and formatting locale were also conflated, and units/currency were not yet separated from canonical state.

## Rules

1. **Standardized currency.** The comparison currency is Naval Credits (NC). NC is a display and comparison unit over canonical, fixed-precision values (ADR-0351). It carries labels and formatting only and no exchange-rate tables. It formats canonical values solely at the presentation boundary. NC is the render and malformed-content fallback, never silent in the UI.

2. **Budget Points.** Budget Points (BP) is an abstract display unit over the same canonical values used by Naval Credits. BP changes labels and formatting only; it introduces no second economy and no separate conversion. Switching to BP changes no authoritative hash and no canonical stored value.

3. **Currency display modes.** `currencyDisplayMode` accepts only `navalCredits`, `nationalHistorical`, and `budgetPoints`. There is no `customCurrency` value and no fallback-status value. Custom display currency is excluded from the initial release; returning to it requires a new accepted decision covering value, conversion, rounding, persistence, and inputs.

4. **Default and National Historical.** The default currency display mode is Naval Credits. National Historical is available only when a validated national configuration exists for the active nation and period. It is never silently substituted. When unavailable, Options disables or hides it with a stated reason (no campaign, or nation unsupported) and shows the effective mode truthfully. Fallback is resolved as runtime state; the stored request is preserved and restored across campaigns. A fresh profile defaults to Naval Credits.

5. **Language and locale independence.** UI language (the externalized string catalog; English with a complete en-US fallback) and formatting locale (how numbers, dates, and measurements render) are two separate preferences, never derived from one another. Locale changes never change UI language, and vice versa. The Options language control lists only fully supported languages (English initially); the formatting-locale control lists only locales with automated formatting tests. No placeholder languages appear in Options. Missing translations fall back to en-US with a development warning and no raw keys in production. Presentation invariance (U-5) verifies the separation.

6. **Conversion boundary.** Conversion happens only at the presentation boundary: a single presentation conversion module (renderer side) converts canonical→display units and money. Authoritative packages and persistence perform no display formatting and no display-unit conversion. Canonical values carry no locale in stored or authoritative state. No formatted text is persisted (enforced at the save boundary). Compile-time authoring→canonical conversion in the content compiler is the one other sanctioned conversion. The domain-package formatting leak is removed and kept out by source guard test (map D6). An ad-hoc `Intl`/`toLocaleString`/`toFixed` and unit conversion in authoritative packages is barred; the single presentation conversion module's final home is resolved during implementation.

## Consequences

- No second economy or conversion table is introduced.
- Changing units, currency, or locale cannot change the campaign hash.
- No authoritative package owns presentation text; no formatted text is saved.
- Language and locale can be chosen independently by the player.
- Custom-currency UI is not built for the initial release.
- Release readiness for the nine nations requires validated historical-currency configurations unless a later decision waives it.