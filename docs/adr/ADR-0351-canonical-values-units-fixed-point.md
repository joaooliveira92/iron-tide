# ADR-0351: Canonical internal values, units and fixed-point arithmetic

Consolidates: ADR-0202, ADR-0215, ADR-0216, ADR-0217, ADR-0219

Applies to: repository

Rule: All authoritative values are stored as canonical fixed-precision types using a single rounding vocabulary; units, currency, and locale convert only at the presentation boundary.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0202
Supersedes: ADR-0215
Supersedes: ADR-0216
Supersedes: ADR-0217
Supersedes: ADR-0219

## Context

The engine must produce identical authoritative hashes regardless of how values are displayed. Presentation concerns (units, currency labels, locale, theme) must never alter simulation state. The determinism contract (BW-DET-001) requires integer/fixed-point authoritative arithmetic and a canonical serializer.

Before this consolidation, canonical units were declared piecemeal: each quantity's brand and constant lived in the package that first needed it (`packages/ship-design/src/units.ts`, `packages/campaign/src/designUnits.ts`), with no single table stating the canonical unit per quantity. Duplicate brands invited drift, and a new quantity required inventing a brand, a constant, and an interpretation from scratch.

Authoritative money had two representations. The budget and ledger stored branded integer treasury units, but the ship-design cost model and foreign contracts used micro-units, and several authoritative fields were declared as a plain `number`. An authoritative field could silently be a float, or be double-rounded when it crossed between the two tiers.

Rounding was ad hoc: at least a dozen sites used `Math.floor`/`Math.round` directly, with no single vocabulary and no declared rounding point per formula. Floating point reached hashed outcomes in the combat strength/resolver path and the economy construction-capacity ratio, and nothing failed closed when a new float appeared in an authoritative package. The authoritative float audit (map D5) found two float paths that flowed into the hashed campaign snapshot: combat strength (average armour and damage potential as floats) and the construction-capacity funding split (float proportion before a `floor`).

## Rules

1. **Foundation.** Stored and authoritative values are canonical and unit-agnostic. Units and currency convert only at the presentation boundary and are never persisted as formatted text. Presentation preferences are excluded from authoritative state by construction.

2. **Canonical units module.** One dependency-free module, `packages/contracts/src/units.ts`, is the single home for the canonical unit table. It declares, per quantity, the canonical unit and the branded safe-integer type that carries it:
   - mass = kilogram (`Kg`)
   - length, calibre, armour, diameter = micrometre (`Um`, with `MM_TO_UM`, `UM_PER_INCH`)
   - speed = micrometres per second (`UmPerSec`, `KNOTS_TO_UMS`/`UM_PER_KNOT`)
   - volume = litre (`Litre`)
   - power = kilowatt (`Kw`)
   - ratio = basis point (`Bp`, `BP_ONE = 10_000`)
   - time = integer month/year with no wall clock
   - money = integer treasury unit (`Money`, see rule 3)

   The canonical constants (`BP_ONE`, `MM_TO_UM`, `KNOTS_TO_UMS`, `UM_PER_INCH`) and checked helpers (`mulBp`, `ceilDiv`, `toSafe`) live here once. Every constructor rejects a non-integer, an unsafe integer, or a value below the quantity's minimum with a `_tag`-discriminated `UnitError`, and never returns `NaN`/`Infinity`. The module is runtime-free: no Node, filesystem, `Intl`, `Date`, locale, clock, or float arithmetic. Authoring units (millimetres, knots, inches) and display units are not canonical: authoring conversion happens once at the content-compile boundary, display conversion only at the presentation boundary.

3. **Money type.** One canonical money type: `Money`, a branded safe integer at a declared scale in treasury units, where one unit = GBP 10,000 (the existing authoritative honour-at-display convention). There is no second money representation. Sub-unit money for the ship-design cost model stays integer-only, bounded micro brands (`BudgetMicro`, `WorkMicro`). It reaches campaign state only through the single bridge `treasuryCostUnits(costMicro, unitMicro)` in `packages/ship-design/src/cost.ts`, which:
   - declares its rounding mode once as `TREASURY_UNITS_ROUNDING: RoundingMode = "ceil"` — a ship is never priced below its cost, and never priced at zero;
   - computes with an exact `bigint` intermediate and rounds once, so no double-round can occur across the design→campaign boundary;
   - rejects a negative, fractional, or unsafe `costMicro` and a non-positive or non-integer `unitMicro` with a typed `UnitError`.

   Every authoritative money and ratio field is branded (`Money`/`Bp`); the previously unbranded `number` fields are promoted. Because treasury units are stored as integers today, branding alone is value-preserving and no scale change is introduced.

4. **Rounding vocabulary.** One rounding vocabulary: the existing `RoundingMode` (`trunc | floor | ceil | halfUp | halfDown | halfEven`) owned by the contracts package. A second rounding enum is rejected. Every authoritative formula declares its mode and follows compose-exactly, round-once: intermediates are exact `bigint`, and the single declared rounding happens at the end (the existing `mulBp`/`ceilDiv`/`toSafe` helpers are the model). Checked helpers throw a typed `UnitError` and never produce `NaN` or `Infinity`. Largest-remainder apportionment (`splitLargestRemainder`, `scalePlanToUnits`/`capacityInUnits`) is the registered way to split an integer total, rather than reinventing a drift-prone split per site.

5. **Float→fixed conversion.** Two authoritative float paths are converted to fixed-point integer arithmetic in canonical units:
   - **Combat.** `StrengthCalculator.damagePotential` is exact integer `floor(firepower * totalArmor / (10 * count))` — average armour is never rounded before the product. `survivability` is a canonical ratio (`round-half-up(hp * BP_ONE / maxHp)`, capped at `BP_ONE`). `StrengthCalculator.strength` is `floor(firepower * totalArmor * min(hp, maxHp) / (10 * count * maxHp))`, floored once. The resolver's factor is exact basis points, effective strength is `strength * factorBp`, and the damage/sink path uses the exact rational, floored once. The RNG protocol is byte-identical.
   - **Economy.** The construction-capacity proportion is replaced with integer largest-remainder apportionment (`splitLargestRemainder`); the funding split sums exactly to available funds with one rounding point and no float.

   The combat refactor is value-preserving (confirmed by 4000/4000 identical matchups). The capacity split differs from the old floor-per-project when two or more projects are funded. The cross-process reference run requires no re-pin because it exercises neither converted path.

6. **Authoritative-float gate.** The determinism check `scripts/assert-authoritative-determinism.mjs` tightens with a `FLOAT_ROOTS` scope — the outcome-producing pure packages (`campaign`, `campaign-engine`, `commands`, `events`, `phase-engine`, `combat`, `ship-design`). A fractional numeric literal or `parseFloat` in that scope fails closed. The rule is proven by the gate's embedded `--self-test` fixtures (a float fixture that must fail, a clean tree that must pass) and is wired into `pnpm preflight`. The rounding-vocabulary home (`contracts`, `deterministic`) and presentation (`ship-visual`) are excluded, since they legitimately carry fractional constants. The save-boundary `assertNoFloats`/`FLOAT_IN_STATE` guard stays.

## Consequences

- A plain `number` where a canonical branded value is expected fails typecheck.
- The determinism rule cannot silently decay: a new authoritative float fails the standing gate rather than drifting into a hashed outcome.
- Every rounding change is auditable as a deliberate, declared act.
- The micro→unit rounding point is singular and declared, not implicit per call site.
- Adding a quantity means editing one module, not inventing a brand per package.
- The consolidation is value-preserving: stored integers are unchanged and the cross-process reference run is byte-identical before and after.
- The contracts package stays free of Node, filesystem, and presentation concerns, preserving the directed package graph (BW-ARC-001).