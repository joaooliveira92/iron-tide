# D1: Scope boundary

**Type:** grilling · **Status:** resolved

## Question

What does U-3 own, and where does it hand off to U-2 (done), U-4 (Options screen)
and U-5 (presentation invariance)?

## Answer

U-3 owns the presentation formatting boundary:

- the **central formatters and parsers** for measurements, canonical money in
  all three currency modes, campaign dates, percentages, and localized numbers;
- the **single presentation conversion module** that ADR-0218 fixes in principle
  and leaves its home to U-3 (D2);
- **currency availability and requested→effective resolution** with the
  `CurrencyFallbackReason` codes already defined by the U-2 contract, mapped to
  localized messages (D4);
- the **national-currency configuration schema and its production validation**
  (identifier, names, symbol and position, spacing, decimals, grouping,
  negatives, scale rules, period, source, gameplay interpretation,
  relabel-or-transform), with fixtures — **but no production per-nation
  configurations** (D7);
- the **single parse-once input path** and the **component-scoped gate** barring
  ad-hoc `Intl`/`toLocaleString`/`toFixed` and unit conversion, plus removal of
  the remaining domain-package formatting sweep ADR-0218 deferred to U-3 (D6);
- boundary, round-trip and malformed-content tests.

U-3 explicitly does **not** build:

- preferences storage, schema, scopes, capability or selectors — **U-2 (done)**;
- the Options screen sections, live preview, reset controls or the externalized
  string catalogue — **U-4**;
- presentation-invariance and round-trip-across-modes tests as a standing suite —
  **U-5** (U-3 supplies the boundary/round-trip tests it needs);
- **per-nation historical currency data** — needs an owner and primary historical
  sources; a content decision, not a U-3 deliverable (D7);
- tactical report-detail/map-display/auto-pause preferences — **T-2**.

## Why

ADR-0203 names U-3 the formatting boundary and U-4 the Options screen;
ADR-0218 fixes the conversion/locale boundary and **explicitly defers** the
component gate, the display-formatting sweep, and the conversion module's home to
U-3; ADR-0211 requires a validated per-nation configuration before National
Historical is selectable. Drawing the line at the boundary (formatters, the
conversion module, availability resolution, the gate) keeps U-3 free of UI
chrome and of fabricated historical data, and leaves U-4/U-5 to consume it.
