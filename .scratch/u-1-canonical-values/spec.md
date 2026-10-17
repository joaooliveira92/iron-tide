# Spec: U-1 Canonical values

**Status:** ready-for-agent (sliced into `issues/`) · **Map:** `map.md` ·
**Decisions:** `decisions/D1`-`D7` · **Gating:**
decision request `.ai/decision-requests/0005-officer-rosters-and-divisions-golden-repin.md`
(golden baseline; gates the D5 float→fixed conversions and any stored-scale,
formula-rounding or projection change).

## Problem Statement

Bluewave's core promise is that identical content, inputs, commands and seeds
produce identical authoritative hashes — replays verify, the gate proves it, and a
player on any supported machine sees the same game. That promise is only as strong
as the values the engine computes with, and today those values are real but
undeclared and inconsistent:

- **Canonical units are scattered.** Kilogram, micrometre, micrometres-per-second,
  basis point, litre and kilowatt are real engine conventions, but each is declared
  as its own brand and constant in different packages, with no single table that
  says what the canonical unit for each quantity is.
- **Money has two representations.** The authoritative budget and ledger use
  branded integer treasury units; the ship-design cost model and foreign contracts
  use micro-units and, in several fields, a plain `number`. An authoritative field
  can silently be a float or be double-rounded across the two tiers.
- **Floats reach hashed outcomes.** Combat strength and the legacy battle resolver
  compute average armour and damage potential in floating point, and construction
  capacity funds projects by a float ratio before truncating. Both flow into the
  hashed campaign snapshot.
- **Rounding is ad hoc.** At least a dozen sites use `Math.floor`/`Math.round`
  directly, with no single vocabulary and no declared rounding point per formula.
- **Presentation leaks inward.** A domain package builds human-readable strings
  with `toLocaleString`, and display formatting is scattered across renderer call
  sites with mixed locales and hardcoded symbols.
- **Language and locale are conflated,** and units/currency are not yet separated
  from canonical state.

From the player's side this shows up as brittle determinism — a battle or a funding
split can drift — and as no guarantee that changing units or currency in Options
cannot change the campaign. From the team's side, every later sprint (preferences,
the formatting boundary, the Options screen, presentation invariance) would have to
retrofit a representation that should have been fixed once.

## Solution

Define the canonical values once, in the lowest dependency-free layer, and confine
everything else to the boundary.

One canonical units module — owned by the contracts package, the lowest
dependency-free layer that already holds the safe-integer and rounding types —
declares the canonical unit per quantity, the branded safe-integer type that carries
it, and the single sanctioned authoring→canonical conversion used only by the
content compiler. Money becomes one branded fixed-precision integer type in treasury
units, with the existing micro-unit ship-design cost model reaching it through a
single, declared-rounding bridge, and every authoritative money field branded.
Rounding has one vocabulary and one rounding point per formula, composed exactly in
integer/bigint and rounded once. The two authoritative float paths are converted to
fixed-point with a reviewed delta and a stated re-pin cause.

Canonical values carry no locale. UI language and formatting locale are two
separate concerns, never derived from one another. Conversion between canonical and
display units/money happens only at the presentation boundary, and the domain
package that formats text is cleaned up. Nothing in the 1880 content or balances
changes; only the representation, and the determinism-mandated conversions, do.

## User Stories

1. As a player, I want every budget, income and expense figure computed and stored
   as an exact integer, so that my treasury never drifts by fractional pennies over a
   long campaign.
2. As a player, I want replays and reloads to reproduce the same battles, funding
   splits and ledger exactly, so that I can trust a verified replay.
3. As a player, I want changing units (imperial/metric) or currency display in
   Options never to change what happens in my campaign, so that presentation is not
   gameplay.
4. As a player, I want to read English while formatting numbers and dates in a
   different locale, so that language and number formatting are independent choices.
5. As a player, I want the money I see to come from the same canonical values the
   engine uses, so that the displayed figure and the authoritative figure never
   disagree.
6. As a player, I want a battle that used to resolve on a fraction to resolve on one
   declared rounding instead, and I want that change to be deliberate and recorded,
   so that the game does not shift under me silently.
7. As a content author, I want to keep authoring designs in human units
   (millimetres, knots, inches), so that I do not have to learn engine units and the
   compiler converts once at a declared boundary.
8. As a content author, I want one table that says what each quantity's canonical
   unit is, so that I can predict how my authored value will be stored.
9. As a content author, I want money in content to have one declared scale, so that I
   cannot accidentally author a value in the wrong unit.
10. As an engine developer, I want a single canonical units module, so that I do not
    invent a new brand, constant or conversion when I add a quantity.
11. As an engine developer, I want one money type and one micro→unit bridge, so that
    I cannot double-round or mix scales.
12. As an engine developer, I want one checked rounding vocabulary and checked
    helpers, so that every formula rounds the same way and overflow rejects at
    construction.
13. As an engine developer, I want one rounding point per multi-step formula (exact
    bigint intermediate, round once at the end), so that I cannot accumulate rounding
    error.
14. As an engine developer, I want largest-remainder apportionment to be the
    registered way to split an integer total, so that I do not reinvent drift-prone
    splitting.
15. As an engine developer, I want the authoritative float paths converted to
    fixed-point in canonical units, so that no float reaches a hashed outcome.
16. As an engine developer, I want every authoritative money/ratio field branded, so
    that the compiler rejects a plain `number` where money is expected.
17. As an engine developer, I want a single presentation conversion module at the
    boundary, so that canonical↔display conversion has one home and the renderer
    stays runtime-free.
18. As an engine developer, I want the domain package that formats text cleaned up,
    so that no authoritative package owns presentation strings.
19. As an auditor, I want the canonical unit table to be the single declared source,
    so that I can review the representation without reading every call site.
20. As an auditor, I want a gate that fails on float arithmetic in authoritative
    packages, so that the determinism rule cannot silently decay.
21. As an auditor, I want the save boundary to keep rejecting non-integers, so that
    no float and no formatted string is ever persisted.
22. As an auditor, I want every authoritative formula to declare its rounding mode,
    so that I can audit a rounding change as a deliberate act.
23. As an auditor, I want the float→fixed conversion delta reviewed with old and new
    hashes and a stated cause, so that an outcome change is never hidden.
24. As an auditor, I want the conversion boundary enforced by a lint/gate, so that
    ad-hoc unit or locale conversion in components cannot reappear.
25. As a release engineer, I want the representation change carried under a
    compatibility bump wherever a stored value or projection changes, so that saves
    pin the right version.
26. As a release engineer, I want value-preserving branding to land without moving
    the reference run, so that the structural work can ship now without waiting on
    the golden baseline.
27. As a release engineer, I want the snapshot-changing conversions gated by decision
    request 0005, so that a re-pin happens with the baseline, not by weakening the
    gate.
28. As a release engineer, I want the full validation gate green on the exact commit,
    so that acceptance is evidence, not a build.
29. As an ARB owner, I want the canonical representation recorded as decisions that
    constrain architecture, determinism and compatibility, so that later sprints
    consume rather than redefine it.
30. As an ARB owner, I want any gameplay-value question the representation touches
    routed to a decision request rather than resolved in U-1, so that U-1 changes
    representation, not balance.
31. As an ARB owner, I want the imperial display default grounded only in the
    manual's measurements passage and never treated as a storage spec, so that the
    manual is not over-read.

## Implementation Decisions

Decisions live in the map (`decisions/D1`-`D7`); summarised here with the
module/interface names U-1 fixes.

- **Scope boundary (D1).** U-1 owns, in the authoritative packages: the canonical
  unit table and its branded types; the fixed-precision money type and the fields it
  brands; the rounding/fixed-point rules and their helpers; the conversion/locale
  boundary definition; and the authoritative float/display-leakage audit and its
  remediation. It does not build the preferences domain (U-2), the central
  formatters/parsers, currency rendering or Options screen (U-3/U-4),
  presentation-invariance tests (U-5), or per-nation National Historical currency
  content (U-3).
- **Canonical unit table (D2).** One dependency-free canonical units module in the
  contracts package declares the canonical unit per quantity and the branded
  safe-integer type that carries it. Canonical units: mass = kilogram; length,
  calibre, armour and diameter = micrometre (`UM_PER_INCH`, `MM_TO_UM`); speed =
  micrometres per second (`KNOTS_TO_UMS`); volume = litre; power = kilowatt; ratio =
  basis point (`BP_ONE`, `mulBp`); time = integer month/year with no wall clock;
  money = integer treasury unit (D3). The existing ship-design and campaign brands
  and constants (`Kg`, `Um`, `UmPerSec`, `Litre`, `Kw`, `Bp`, `BudgetMicro`,
  `WorkMicro`) are consolidated here by an expand→migrate→contract sequence so no
  call site breaks. Authoring units (mm, knots, inches) and display units remain
  non-canonical: authoring conversion happens once at the content-compile boundary.
- **Money representation (D3).** One canonical money type — a branded safe integer
  at a declared scale in **treasury units**, the existing authoritative convention
  honoured at display as one unit = GBP 10,000. Sub-unit money for the ship-design
  cost model stays the existing integer-only, bounded micro brands and reaches
  campaign state only through the single bridge the phase engine already applies
  (`treasuryCostUnits` against `pricing.treasuryUnitMicro`), which declares its
  rounding mode and is the one micro→unit rounding point. Every authoritative money
  field is branded: the currently unbranded money/ratio `number` fields — foreign
  contract price, amount and per-unit work; design-study costs and discount basis
  points; base-resource amounts — are promoted to the money/ratio brands. Because
  treasury units are stored as integers today, branding alone is value-preserving;
  no scale change is proposed.
- **Rounding and fixed-point (D4).** One rounding vocabulary — the existing
  `RoundingMode` (`trunc | floor | ceil | halfUp | halfDown | halfEven`) already used
  by the safe-integer division and `roundToInt`; a second rounding enum is rejected.
  Every authoritative formula declares its mode and follows compose-exactly,
  round-once (bigint intermediate), modelled on the existing basis-point helpers
  (`scaleByBp`, `mulBp`). Checked helpers (add/sub/mul/div, `ceilDiv`, `toSafe`, and a
  reject-non-integer/unsafe-integer-at-construction boundary) are exposed from the
  canonical units module and throw a typed unit error (`UnitError` `_tag`), never
  `NaN` or `Infinity`. No implicit float in authoritative packages: the existing
  save guard (`assertNoFloats`, `FLOAT_IN_STATE`) stays, and U-1 adds an
  authoritative-package float gate — a tightened `assert-authoritative-determinism`
  or a dedicated lint rule — that fails on float arithmetic (`.0` literals, `Math.*`,
  non-exact `/`) in authoritative scopes; the exact mechanism is settled at
  implementation. Largest-remainder apportionment (`splitLargestRemainder`,
  `scalePlanToUnits`/`capacityInUnits`) is the sanctioned way to split an integer
  total, registered rather than reinvented per site.
- **Authoritative float audit (D5).** The audit found three classes of leak: (1)
  combat strength and the legacy resolver, where average armour and damage potential
  are computed as floats and flow through the resolver into hashed campaign state;
  (2) the economy construction-capacity ratio, a float proportion before a floor;
  (3) minor integer-in/float-out sites that round basis points or counts with
  `Math.round`/`ceil`/`floor` without declaring a mode. Remediation: replace (1) and
  (2) with fixed-point integer arithmetic in canonical units using the D2/D4 helpers,
  with exactly one rounding point per formula and largest-remainder for any split;
  convert (3) to the declared vocabulary. This is a determinism-contract compliance
  fix (BW-DET-001), not a balance choice; it can change outcomes, so the delta is
  reviewed and the golden reference run is re-pinned with a stated cause.
- **Boundary and locale separation (D6).** Canonical values carry no locale: stored
  and authoritative state is locale-free by construction, and no formatted text is
  persisted (already enforced at the save boundary). UI language (the externalized
  string catalog; English with a complete en-US fallback) and formatting locale (how
  numbers, dates and measurements render) are two separate preferences, never derived
  from one another; U-1 fixes the split, U-2 stores it, U-3 implements it. Conversion
  happens only at the presentation boundary: a single presentation conversion module
  (renderer side; exact home deferred to U-2/U-3) converts canonical→display units
  and money; authoritative packages and persistence do no display formatting and no
  display-unit conversion. Compile-time authoring→canonical conversion in the content
  compiler is the one other sanctioned conversion. The domain-package formatting leak
  (locale-string building in the campaign-engine priorities module) is removed or
  relocated so no authoritative package owns presentation text. No ad-hoc conversion:
  the display knot/millimetre helpers and any display conversion move behind the
  single module, and a lint/gate bars ad-hoc unit or locale conversion and ad-hoc
  `Intl`/`toLocaleString`/`toFixed` in components.
- **Gating (D7).** The root blocker is the absent golden baseline, escalated in
  decision request 0005. Value-preserving tickets (same integers stored) can start
  now: declaring the canonical table and brands and consolidating duplicates; branding
  the unbranded authoritative money/ratio fields; adding the checked rounding helpers
  and the float gate; removing the domain-package formatting leak and defining the
  conversion boundary where it does not alter a hashed value. Gated by 0005 (they move
  a hashed outcome): the combat/economy float→fixed conversions, and any ticket that
  changes a stored scale, a formula's rounding, or a hashed projection string.
  National Historical currency configuration content is U-3 and does not block U-1. No
  new decision request is raised by U-1.

## Testing Decisions

- **One seam.** Compile a fixture campaign, run months through the existing month
  executor, issue real commands, and observe the authoritative snapshot, domain
  events, the financial ledger, and the presentation projection. This is the highest
  existing seam; no new test seam is introduced.
- A good test sets up through production composition (compile content, run months),
  replaces only true external boundaries, and asserts observable authoritative
  outcomes by `_tag`/reason code, not internals. A source counts only when a test
  drives it from a compiled month.
- **Cover:** the canonical units module (each constructor rejects non-integer and
  unsafe-integer input; the brand consolidation preserves stored integers); the money
  type and its single bridge (treasury-unit arithmetic is exact; the micro→unit bridge
  rounds once at its declared mode; no double-round across the design→campaign
  boundary); rounding (one rounding point per formula; largest-remainder splits sum
  exactly to the total; checked helpers throw typed errors and never `NaN`/`Infinity`
  on overflow or division by zero); the float→fixed conversions (combat strength and
  resolver, and the construction-capacity ratio, produce the declared integer result;
  the reviewed old/new delta is recorded); the boundary (the save/load round-trip
  stores only integers and contains no formatted text; the domain package owns no
  formatting; the presentation projection is the only consumer of the conversion
  module); and cross-process identity (the child run is byte-identical run twice, and
  the reference run is unchanged for value-preserving tickets).
- **Prior art:** `packages/phase-engine/test/economy.test.ts` (maintenance, budget,
  ledger), `packages/phase-engine/test/month.test.ts` and
  `packages/phase-engine/test/construction-capacity.test.ts` (the capacity ratio),
  `packages/phase-engine/test/battle-resolution-phase.test.ts` and
  `packages/phase-engine/test/battle-consequences.test.ts` (a battle result reaching
  state), the cross-process child run in `packages/cross-process-test`,
  `packages/ship-design/test/persistence.test.ts` (save round-trip and the
  `FLOAT_IN_STATE` guard), `packages/ship-design/test/units.test.ts` and
  `packages/ship-design/test/treasury-units.test.ts` (brands, `mulBp`, the treasury
  bridge), and `packages/campaign-engine/test/priorities.test.ts` (the formatting
  leak's home).
- **The authoritative-float gate is a lint/gate, proven by a fixture.** The existing
  `scripts/assert-authoritative-determinism.mjs` already carries an embedded
  `--self-test` fixture set for its detection rules and a reviewed allowlist pattern;
  the float rule is proven the same way — a fixture that must fail, plus a clean-tree
  pass — whether it lands as a tightened gate or a dedicated lint rule.

### Acceptance criteria traceability

Each `.ai/SPRINT-PLAN.md` U-1 acceptance criterion maps to stable requirement IDs
(see [`.ai/REQUIREMENTS.md`](../../.ai/REQUIREMENTS.md)) and to the tests/gates that
prove it.

| # | Acceptance criterion (U-1) | Requirement IDs | Proving test / gate |
| --- | --- | --- | --- |
| 1 | Canonical unit table | BW-PRS-001, BW-DET-001; DESIGN-22 §2; ADR-0202 | canonical-units module tests; `units.test.ts`; cross-process byte identity; `pnpm check` |
| 2 | Fixed-precision integer monetary representation | BW-PRS-001, BW-DET-001, BW-STA-001; ADR-0202/0206/0207/0211 | `treasury-units.test.ts`; `economy.test.ts` ledger; save round-trip + `FLOAT_IN_STATE`; cross-process |
| 3 | Rounding and number-formatting boundaries | BW-DET-001, BW-DET-003, BW-RUL-001; ADR-0202/0209 | rounding-vocabulary tests; one-rounding-point formula tests; `assert-authoritative-determinism` float fixture; `economy.test.ts` |
| 4 | UI language and formatting locale separate | BW-PRS-004; ADR-0209 | boundary split asserted at the type/selector seam; `priorities.test.ts` proves no domain formatting (U-3 implements, U-5 proves invariance) |
| 5 | Audit of float or display-leaking values | BW-DET-001, BW-ARC-001, BW-ARC-002, BW-STA-001 | `battle-resolution-phase.test.ts`/`battle-consequences.test.ts`; `construction-capacity.test.ts`; authoritative-float gate fixture |
| 6 | Conversion only at the application boundary | BW-PRS-001, BW-ARC-001; ADR-0202 | boundary conversion test; save contains no formatted text (`persistence.test.ts`); lint/gate bars ad-hoc conversion |

### Definition of done (reviewer checklist)

- [ ] The canonical unit table and brands exist once in the contracts package;
      duplicates in ship-design and campaign are consolidated (expand→migrate→
      contract) with no stored-value change.
- [ ] One branded fixed-precision money type; every authoritative money/ratio field
      branded; the single micro→unit bridge declares its rounding mode; no second
      money representation.
- [ ] One rounding vocabulary; every authoritative formula declares a mode and rounds
      once; checked helpers throw typed errors and never produce `NaN`/`Infinity`.
- [ ] The combat and construction-capacity float paths are fixed-point with the
      reviewed old/new delta recorded; the golden reference run is re-pinned with a
      stated cause (gated by 0005).
- [ ] The authoritative-package float gate fails on float arithmetic and passes on the
      clean tree; the `assertNoFloats`/`FLOAT_IN_STATE` save guard still holds.
- [ ] The domain-package formatting leak is removed; canonical↔display conversion has
      exactly one home at the presentation boundary; no authoritative package formats
      or converts for display.
- [ ] UI language and formatting locale are distinct; neither is derived from the
      other.
- [ ] All six acceptance criteria are traceable to the named tests/gates above.
- [ ] Focused and full gates are green on the exact commit (see Further Notes); clean
      tree; Conventional Commit subjects.

## Out of Scope

- The preferences domain, its schema, persistence and scopes (U-2).
- Central formatters and parsers, currency-mode rendering and the Options screen
  (U-3/U-4).
- Presentation-invariance and round-trip tests across modes (U-5).
- Per-nation National Historical currency configuration content (U-3); it needs an
  owner and primary historical sources.
- Any change to gameplay values, balances or the 1880 content pack; U-1 changes
  representation, not outcomes, except the determinism-mandated float→fixed
  conversion (D5/D7).
- Moving imperial/metric display toggles into canonical state; display is
  presentation-only by construction (ADR-0202).
- The measurement-preset and number-scale taxonomy, and where the presentation
  conversion module lives (deferred to U-2/U-3).
- The exact mechanism of the authoritative-float gate (settled at implementation).

## Further Notes

- **Gating.** D7 splits the work: value-preserving tickets can start now; the
  combat/economy float→fixed conversions and any stored-scale or rounding change ride
  decision request 0005. The root blocker is the absent `golden/hashes.json` (same
  blocker as N-1 ticket 07 and S-1 ticket 01). **Stop surface (D5):** if the reviewed
  delta between old and new battle outcomes is materially large or not explainable as
  a rounding of the same formula, stop and raise a decision request rather than land
  it.
- **Compatibility.** Any ticket that changes a stored value, a scale or a hashed
  projection string carries a compatibility bump and a stated re-pin cause.
  Coordinate the bump with the sprint(s) landing alongside it (S-1's declaration also
  moves the reference run: whichever lands first bumps, the other joins that release).
- **ADRs U-1 must record at implementation:** the canonical unit table and its home
  in the contracts package; the fixed-precision money type, its treasury-unit scale
  and the single micro→unit bridge with its rounding mode; the rounding/fixed-point
  rules and the authoritative-float gate; the conversion/locale boundary (canonical↔
  display only at the presentation boundary; language and locale separate); and the
  combat/economy float→fixed conversion and its re-pin. ADR-0202/0203/0206-0209/0211
  already accept the underlying decisions; these implementation ADRs record the
  concrete interfaces and the gate. Regenerate the index with `pnpm adr:index`.
- **Manual grounding.** Only the measurements passage (p.18) grounds the imperial
  display default; the manual is silent on storage, rounding and locale, so those rest
  on the accepted ADRs (see [`docs/research/u-1-canonical-values.md`](../../docs/research/u-1-canonical-values.md)).
  The manual's 1900 "historical budgets" option is not a currency mode.
- **Requirement traceability.** The role's `docs/requirements/REQUIREMENT-MAP.md` is
  absent in this checkout (unavailable under ADR-0210); mapping uses the stable IDs in
  `.ai/REQUIREMENTS.md`.
- **Validation commands.** Focused: `pnpm preflight` plus
  `node scripts/assert-authoritative-determinism.mjs --self-test` for the float-gate
  fixture. Full orchestrator gate: clean uncached build (`vp run -r build --no-cache`),
  `tsc -b`, `pnpm lint`, `pnpm format`, full test suite, the cross-process child run
  twice (byte-identical), `node scripts/verify-golden-hashes.cjs`, then
  `pnpm preflight`, `pnpm test:scripts` and `pnpm check`.
- **Risk.** U-1 is not accepted until the value-preserving structural tickets are
  green and the outcome-moving conversions have a resolved 0005 and a reviewed,
  re-pinned delta.
