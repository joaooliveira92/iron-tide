# Milestone U-1: Canonical values

## Objective

One canonical unit table and one fixed-precision integer money representation,
declared once in the dependency-free contracts layer and adopted across the
authoritative packages, with rounding and the number/format boundary fixed, UI
language and formatting locale separated, and the authoritative float and
display-leakage audit closed — so that units and currency are presentation-only
over canonical values (ADR-0202) and identical inputs still produce identical
hashes.

## Canonical requirements

- `.ai/SPRINT-PLAN.md` Phase 2 row **U-1** (acceptance): canonical unit table;
  fixed-precision integer monetary representation; rounding and number-formatting
  boundaries; UI language and formatting locale as separate concerns; audit of
  float or display-leaking values; conversion only at the application boundary.
- **BW-PRS-001** (ADR-0202) canonical internal values are unit-agnostic; units and
  currency are presentation-only and never alter authoritative state.
- **BW-DET-001/003** integer or fixed-point authoritative arithmetic; identical
  inputs produce identical hashes across OSes.
- **BW-ARC-001/002**, **BW-STA-001** domain independence; UI state is never
  authoritative; canonical/derived/cached/ledger/ephemeral stay distinct.
- **BW-PRS-004** (ADR-0209) UI language and formatting locale are separate; the
  en-US fallback is complete.
- Supporting ADRs: 0202, 0203, 0206, 0207, 0208, 0209, 0211; DESIGN-22 §2.
- Spec: `.scratch/u-1-canonical-values/spec.md` (map `D1`-`D7`); research:
  `docs/research/u-1-canonical-values.md`.

## Starting state

Verify, do not assume:

- `packages/contracts` owns `SafeInt`/`RoundingMode` and is the lowest
  dependency-free layer; `packages/ship-design/src/units.ts` holds the unit brands
  (`Kg`, `Um`, `UmPerSec`, `Litre`, `Kw`, `Bp`, `BudgetMicro`, `WorkMicro`) and
  `mulBp`/`ceilDiv`/`toSafe`; `packages/campaign/src/designUnits.ts` documents the
  kg/µm/µm/s table and the float conversions.
- Authoritative money is branded `SafeInt` treasury units, but several authoritative
  fields are unbranded `number` (foreign-contract amounts, design-study costs,
  base-resource amounts); the micro→unit bridge is
  `treasuryCostUnits` against `treasuryUnitMicro` (1 treasury unit = GBP 10,000).
- Floats reach hashed outcomes in `packages/combat/src/strength.ts` →
  `resolver.ts` and in the economy construction-capacity ratio.
- Formatting is per-call-site in the renderer with mixed locales, plus one leak in
  `packages/campaign-engine/src/priorities.ts`.
- `packages/ship-design/src/persistence.ts` already rejects floats
  (`FLOAT_IN_STATE`); `golden/hashes.json` does not exist.

## In scope

- The canonical units module (table + branded types + constants + checked
  helpers) in `packages/contracts`, and consolidation of the duplicate
  brands/constants (expand→migrate→contract).
- The single fixed-precision money type; branding every authoritative money/ratio
  field; the one declared-rounding micro→unit bridge.
- The rounding/fixed-point rules and the authoritative-package float gate.
- The conversion/locale boundary definition and removal of the domain-package
  formatting leak.
- The float→fixed conversions that change outcomes (gated), with a reviewed delta
  and re-pin.

## Out of scope

- Preferences domain/schema/persistence/scopes (U-2).
- Central formatters/parsers, currency-mode rendering, Options screen (U-3/U-4).
- Presentation-invariance and round-trip tests across modes (U-5).
- Per-nation National Historical currency configuration content (U-3; needs an
  owner and primary sources).
- Any change to gameplay values, balances, or the 1880 content pack, except the
  determinism-mandated float→fixed conversion.
- Deferred: the home of the presentation conversion module and the
  measurement-preset/number-scale taxonomy.

## Required implementation

- One canonical units module: unit per quantity, branded safe-integer type per
  unit, canonical constants, checked arithmetic helpers that reject
  non-integer/unsafe-integer at construction and throw typed `_tag` errors; run no
  Node/locale/clock/float.
- One money type in treasury units; the micro cost model reaches it only through
  the single bridge, which declares its `RoundingMode` and rounds once.
- One rounding vocabulary; every authoritative formula declares a mode and rounds
  once (exact bigint intermediate); largest-remainder is the registered way to
  split an integer total.
- An authoritative-package float gate (tightened
  `assert-authoritative-determinism` or a dedicated lint rule) proven by a
  fixture; the save-boundary `assertNoFloats` guard stays.
- One presentation conversion boundary; no authoritative package formats or
  converts for display; language and locale are distinct.
- Record the implementation ADRs (canonical table and home; money type, scale and
  bridge rounding; rounding/float gate; conversion/locale boundary; float→fixed
  conversion and re-pin) and regenerate the ADR index.

## Acceptance tests

- Canonical units module: each constructor rejects bad input; brand consolidation
  preserves stored integers.
- Money: treasury-unit arithmetic is exact; the bridge rounds once at its declared
  mode; no double-round across design→campaign; typed errors on bad input.
- Rounding: one rounding point per formula; largest-remainder splits sum exactly;
  helpers throw, never `NaN`/`Infinity`.
- Float audit: combat strength/resolver and construction capacity produce the
  declared integer result; the reviewed old/new delta is recorded.
- Boundary: save/load stores only integers and no formatted text; the domain
  package owns no formatting; one conversion home.
- Determinism: the cross-process child run twice is byte-identical; value-preserving
  tickets leave the reference run unchanged; the float gate self-test fails on the
  float fixture and passes clean.

## Determinism proof

The cross-process child run (`packages/cross-process-test`) compiled and executed
twice yields byte-identical output, and the codemod/equivalence determinism gates
pass. Value-preserving tickets must show the child-run hash unchanged before/after;
outcome-moving tickets must show old/new hashes plus cause under 0005. No
authoritative float remains on any hashed path.

## Compatibility and versions

Any ticket changing a stored value, a scale, a formula's rounding or a hashed
projection string carries a compatibility bump and a stated re-pin cause.
Coordinate the bump with the sprint landing alongside it (S-1's readiness fields
also move the reference run: whichever lands first bumps, the other joins that
release). No production content or ruleset value changes.

## Performance observations

None authoritative. The float→fixed conversions are integer/bigint arithmetic; no
wall-clock data is authoritative. The float gate runs in the standing gates and
must not materially slow them.

## Stop conditions

- **Decision request 0005** (absent `golden/hashes.json`) gates tickets 06–08 and
  any stored-scale, formula-rounding or hashed-projection change. Do not use a
  `Golden-Repin: not-needed` trailer for a change that moves the reference run.
- **Map D5 stop surface:** if the reviewed combat float→fixed delta is materially
  large or not explainable as a rounding of the same formula, stop and raise a
  decision request (two interpretations change gameplay).
- National Historical currency configuration content needs an owner and primary
  sources; route it to U-3, not U-1.

## Required delivery

- code and focused tests for each ticket;
- traceability (SPRINT-PLAN row, `docs/PROGRESS.md`, `.ai/specs/` pointer);
- the implementation ADRs, indexed;
- `.ai/reports/u-1-canonical-values.md` validation report with exact commands and
  observed results;
- changed-file summary;
- Conventional Commits; pull-request description when a remote exists.
