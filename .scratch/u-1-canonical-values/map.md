# Map: U-1 Canonical values

**Label:** wayfinder:map · **Status:** charted; route decisions resolved; the
snapshot-changing tickets are gated by the missing golden baseline.

## Destination

A spec and a ticket set for sprint U-1 (`.ai/SPRINT-PLAN.md` Phase 2): one
canonical unit table and one fixed-precision integer money representation,
defined once and adopted across the authoritative packages; rounding and the
number/format boundary fixed; UI language and formatting locale separated; the
authoritative float and display-leakage audit closed; conversion confined to the
application boundary. The way to implementation must be unambiguous; no
implementation happens in this effort.

## Notes

- Authority order per ADR-0210. ADR-0202 governs the mechanic (canonical values
  are unit-agnostic and fixed-precision; units and currency are display-only).
  ADR-0203/0206/0207/0208/0209/0211 govern preferences, currency modes and the
  language/locale split. The manual is authority 3 and grounds only the display
  default (imperial preset, p.18); see
  [`docs/research/u-1-canonical-values.md`](../../docs/research/u-1-canonical-values.md).
- Resolved by the orchestrator without a live human (user directive: run
  autonomously). Each decision derives from a higher authority, not a gameplay
  preference; the manual's silence on storage, rounding and locale is already
  covered by accepted ADRs, so no decision request is raised by this effort.
- Existing surfaces U-1 builds on: `packages/contracts` (`SafeInt`,
  `RoundingMode`); `packages/ship-design/src/units.ts` (unit brands,
  `BudgetMicro`/`WorkMicro`, `mulBp`/`ceilDiv`/`toSafe`) and its
  `assertNoFloats` persistence guard; `packages/campaign/src/designUnits.ts`
  (kg/µm/µm/s table + knot/mm conversions); `packages/phase-engine/src/designVersion.ts`
  (`treasuryCostUnits` micro→unit bridge); `packages/combat/src/strength.ts` →
  `resolver.ts` (float strength path); `packages/campaign-engine/src/priorities.ts`
  (a formatting leak into a domain package).
- Skills: `to-spec`, `to-tickets`, `tdd` for implementation later.

## Decisions so far

- [D1 Scope boundary](decisions/D1-scope-boundary.md): U-1 owns the unit table,
  the money representation, rounding/fixed-point rules, the conversion boundary
  definition and the authoritative float/leakage audit; formatters, the Options
  UI and preferences are named seams for U-2/U-3/U-4.
- [D2 Canonical unit table](decisions/D2-canonical-unit-table.md): one
  dependency-free canonical units module that declares the unit per quantity and
  the branded types, consolidating the scattered brands/constants; authoring and
  display units stay non-canonical.
- [D3 Money representation](decisions/D3-money-representation.md): one branded
  fixed-precision integer money type at a declared scale, branded on every
  authoritative money field, with a single micro→unit rounding bridge.
- [D4 Rounding and fixed-point](decisions/D4-rounding-and-fixed-point.md): one
  checked rounding vocabulary, a declared mode per formula, and no implicit
  float in authoritative packages.
- [D5 Authoritative float audit](decisions/D5-authoritative-float-audit.md): the
  float paths that reach hashed outcomes (combat strength/resolver, capacity
  ratio) are converted to fixed-point at a single rounding point; behaviour delta
  reviewed and re-pinned.
- [D6 Boundary and locale separation](decisions/D6-boundary-and-locale-separation.md):
  canonical values carry no locale; language and formatting locale are separate;
  conversion happens only at the presentation boundary; the domain-package
  formatting leak is removed.
- [D7 Gating](decisions/D7-gating.md): documentation-only and
  value-preserving-branding tickets can start now; snapshot-changing tickets are
  gated by decision request 0005.

## Not yet specified

- Whether the presentation conversion module lives in a new shared package or in
  the renderer, and how preload exposes it: deferred to U-2/U-3.
- The measurement-preset and `numberScale` taxonomy (which presets exist, how a
  preset maps to formatters): U-2/U-3.
- National Historical currency configuration content (per-nation symbol,
  position, decimals, grouping, scale, period, source): needs an owner and
  primary historical sources; U-3 content work, not U-1.
- The lint/gate that enforces "no float in authoritative packages" (extend
  `assert-authoritative-determinism` vs a new rule): shape settled at
  implementation.

## Out of scope

- The preferences domain, schema, persistence and scopes (U-2).
- Central formatters/parsers, currency modes rendering and the Options screen
  (U-3/U-4).
- Presentation-invariance and round-trip tests across modes (U-5).
- Any change to gameplay values, balances or the 1880 content pack; U-1 changes
  representation, not outcomes (except where the determinism contract requires a
  float→fixed conversion, handled under D5/D7).
- Moving imperial/metric display toggles into canonical state: display is
  presentation-only by construction (ADR-0202).
