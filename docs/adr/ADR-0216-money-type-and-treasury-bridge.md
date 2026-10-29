# ADR-0216: Fixed-precision money type, treasury-unit scale, and the micro→unit bridge

Applies to: contracts, campaign, ship-design

## Status

Superseded by: ADR-0351

Accepted (2026-10-16). Records the fixed-precision monetary representation that [ADR-0202](ADR-0202-canonical-internal-values.md) left to the canonical-values sprint (U-1 of `.ai/SPRINT-PLAN.md` Phase 2).

## Context

Authoritative money had two representations. The budget and ledger stored
branded integer treasury units, but the ship-design cost model and foreign
contracts used micro-units, and several authoritative fields (foreign-contract
price, amount and per-unit work; design-study costs and discount basis points;
base-resource amounts) were declared as a plain `number`. An authoritative field
could silently be a float, or be double-rounded when it crossed between the two
tiers.

## Decision

One canonical money type: `Money`, a branded safe integer at a declared scale in
**treasury units**, where one unit = GBP 10,000 (the existing authoritative
honour-at-display convention). There is no second money representation.

Sub-unit money for the ship-design cost model stays the existing integer-only,
bounded micro brands (`BudgetMicro`, `WorkMicro`). It reaches campaign state only
through the single bridge `treasuryCostUnits(costMicro, unitMicro)`
(`packages/ship-design/src/cost.ts`), which:

- declares its rounding mode once as `TREASURY_UNITS_ROUNDING: RoundingMode =
  "ceil"` — a ship is never priced below its cost, and never priced at zero;
- computes with an exact `bigint` intermediate and rounds once, so no
  double-round can occur across the design→campaign boundary;
- rejects a negative, fractional, or unsafe `costMicro` and a non-positive or
  non-integer `unitMicro` at construction with a typed `UnitError`.

Every authoritative money and ratio field is branded (`Money`/`Bp`); the
previously unbranded `number` fields listed above are promoted. Because treasury
units are stored as integers today, branding alone is value-preserving and no
scale change is introduced.

## Consequences

- A plain `number` where money is expected fails typecheck.
- The micro→unit rounding point is singular and declared, not implicit per call
  site.
- The ship-design save guard (`assertNoFloats`/`FLOAT_IN_STATE`) still rejects
  any float reaching persisted state.
- Stored integers are unchanged, so the change is golden-neutral.
