# Map: U-3 Formatting boundary

**Label:** wayfinder:map · **Status:** charted; the route is clear — no ticket
remains to decide before implementation. U-3 is golden-neutral and ungated; the
one content decision (national-currency configurations) is carved out.

## Destination

A spec and a ticket set for sprint U-3 (`.ai/SPRINT-PLAN.md` Phase 2): one
presentation formatting/conversion module that renders canonical values —
measurements, money in Naval Credits / Budget Points / National Historical,
campaign dates, percentages and localized numbers — at the presentation
boundary; currency availability and requested→effective resolution with reason
codes and a stated NC fallback; a single parse-once input path; the component
gate barring ad-hoc formatting; and the domain-formatting-leak removal ADR-0218
deferred. No implementation happens in this effort.

## Notes

- Authority order per ADR-0210. ADR-0202 (presentation-only), ADR-0209
  (language vs locale), ADR-0206/0207/0208/0211 (currency modes/default/
  requested-effective), ADR-0215/0216/0217/0218 (canonical table, money/treasury
  bridge, rounding/float gate, conversion/locale boundary). The manual grounds
  only the imperial measurement default (p.18) and is silent on formatting,
  rounding, locale and currency —
  [`rtw3-manual-baseline.md`](../../docs/research/rtw3-manual-baseline.md),
  [`u-1-canonical-values.md`](../../docs/research/u-1-canonical-values.md) §5.
  Simulation matches RTW3; only UI/UX may deviate.
- Resolved by the orchestrator without a live human (user directive: run
  autonomously). Each decision derives from a higher authority; the manual's
  silence is already covered by accepted ADRs, so the boundary work raises no
  decision request and hits no stop condition. The one open item —
  per-nation historical currency data — is an owner decision (D7), not invented.
- Existing surfaces U-3 builds on: U-2's effect-free
  `apps/desktop/src/shared/preferences-contract.ts` (formats/locales/presets/
  modes, `CurrencyFallbackReason`, `NationalCurrencyAvailability`,
  `resolveEffectiveCurrencyDisplayMode`) and its preload capability/selectors;
  U-1's `packages/contracts/src/units.ts` (canonical table, `Money`,
  `BP_ONE`, constants); the renderer's scattered formatting call sites
  (~26 `en-US`, 5 `en-GB`, dozens bare-locale, hard-coded `£`); the renderer
  `lib/campaign-month.ts`; the domain leak ADR-0218 deferred
  (`packages/ship-design/src/*`, `packages/phase-engine/src/reviseProject.ts`);
  the content compiler stages and `packages/content-schema`.
- U-3 is a presentation concern: it stores nothing authoritative and moves no
  golden hash (D7).
- Skills: `to-spec`, `to-tickets`, `tdd` for implementation later.

## Decisions so far

- [D1 Scope boundary](decisions/D1-scope-boundary.md): U-3 owns the central
  formatters/parsers, the single conversion module, currency availability/
  resolution, the national-currency schema+validation, the parse-once path and
  the component gate, and the domain-leak removal; U-4/U-5 and the
  national-currency **content** are seams.
- [D2 Module home and shape](decisions/D2-module-home-and-shape.md): one
  effect-free renderer-side presentation module under `renderer/lib/` importing
  only `@bluewave/contracts` and the shared preferences contract — the home
  ADR-0218 deferred; no new package.
- [D3 Measurement presets](decisions/D3-measurement-presets.md): the module owns
  the canonical→display conversions and the display-unit taxonomy; imperial
  default (p.18), metric alternative, per-category selections validated against
  the canonical table.
- [D4 Currency modes and resolution](decisions/D4-currency-modes-and-resolution.md):
  render NC/BP/national-historical over canonical `Money`; availability from the
  active campaign + validated config; effective = request-or-NC with a reason
  code; NC is the render/malformed fallback, never silent.
- [D5 Dates, numbers, locale](decisions/D5-dates-numbers-locale.md): campaign
  integer month/year dates and locale-driven numbers/percentages with
  `numberScale`; language and locale separate; tested-locale allowlist; no wall
  clock.
- [D6 Parse-once and gate](decisions/D6-parse-once-and-gate.md): a single
  parse-once input path; a standing component gate barring ad-hoc
  `Intl`/`toLocaleString`/`toFixed` and unit conversion; remove the
  ship-design/phase-engine formatting leak.
- [D7 Gating and authority](decisions/D7-gating-and-authority.md): authority
  ADR-0202/0209/0206-0208/0211/0215-0218; depends on U-2 (on `dev`) and U-1;
  golden-neutral and ungated; national-currency **data** is an owner decision
  needing primary sources — ship the schema, invent nothing; stop if a formatter
  would move an authoritative value or require invented history.

## Not yet specified

- The full display-unit taxonomy per category (which imperial/metric units each
  category offers) and the exact `measurementSelections` key set — fixed at
  implementation against the canonical table (D3); U-3 stores/validates, U-4
  exposes.
- The `numberScale` presentation details (when each locale abbreviates and at what
  magnitude) — settled at implementation with explicit-locale tests.
- The precise parser grammar for display-unit input (free text vs pickers) — a U-4
  UI concern over the U-3 parser.
- The gate's exact form (an extended `assert-*` script vs a dedicated lint rule)
  and its file-scope allowlist — settled at implementation, proven by a self-test
  fixture (D6).

## Out of scope

- Preferences storage/schema/scope/capability/selectors — U-2 (done).
- The Options screen sections, live preview, reset controls and the externalized
  string catalogue — U-4.
- Presentation-invariance as a standing suite across modes/presets — U-5.
- **Per-nation National Historical currency configurations** — an owner decision
  needing primary historical sources; a decision request, not U-3 content (D7).
- Tactical report-detail/map-display/auto-pause preferences — T-2.
- Changing the canonical representation, the save format, the wire format, or any
  authoritative value — never U-3's (D7).
