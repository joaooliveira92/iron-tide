# ADR-0218: Conversion and locale boundary — canonical↔display only at presentation, language distinct from locale

Applies to: contracts, campaign-engine, desktop

## Status

Superseded by: ADR-0352

Accepted (2026-10-16). Implements the conversion/locale boundary of [ADR-0202](ADR-0202-canonical-internal-values.md) and [ADR-0209](ADR-0209-ui-language-and-formatting-locale.md); U-1 of `.ai/SPRINT-PLAN.md` Phase 2.

## Context

Presentation leaked inward. A domain package (`packages/campaign-engine/src/priorities.ts`)
built human-readable strings with `toLocaleString`/`toFixed`, and display
formatting was scattered across renderer call sites with mixed locales and
hardcoded symbols. UI language and formatting locale were also conflated, and
units/currency were not yet separated from canonical state.

## Decision

Canonical values carry no locale. Stored and authoritative state is locale-free
by construction, and no formatted text is persisted (already enforced at the
save boundary).

UI **language** (the externalized string catalog; English with a complete en-US
fallback) and formatting **locale** (how numbers, dates, and measurements
render) are two separate preferences, never derived from one another. U-1 fixes
the split; U-2 stores it; U-3 implements it.

Conversion happens only at the presentation boundary: a single presentation
conversion module (renderer side) converts canonical→display units and money.
Authoritative packages and persistence perform no display formatting and no
display-unit conversion. Compile-time authoring→canonical conversion in the
content compiler is the one other sanctioned conversion.

The domain-package formatting leak is removed: `priorities.ts` builds no
locale-formatted strings, and a source guard test (map D6) keeps it that way.
The remaining display-formatting sweep across ship-design/phase-engine and a
component-scoped gate barring ad-hoc `Intl`/`toLocaleString`/`toFixed` and unit
conversion are deferred to U-3, as is the single presentation conversion
module's final home — the ticket permits the deferral; the boundary itself is
fixed here.

## Consequences

- Changing units, currency, or locale cannot change the campaign.
- No authoritative package owns presentation text; no formatted text is saved.
- The conversion boundary has exactly one intended home even though that home is
  finalized in U-2/U-3.
- Language and locale can be chosen independently by the player.
