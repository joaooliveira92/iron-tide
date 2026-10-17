# ADR-0215: Canonical units module and its home in the contracts package

## Status

Accepted (2026-10-16). Records the canonical unit table that [ADR-0202](ADR-0202-canonical-internal-values.md) left to the canonical-values sprint (U-1 of `.ai/SPRINT-PLAN.md` Phase 2).

## Context

Canonical units were real engine conventions but were declared piecemeal: each
quantity's brand and constant lived in the package that first needed it
(`packages/ship-design/src/units.ts`, `packages/campaign/src/designUnits.ts`),
with no single table stating the canonical unit per quantity. Duplicate brands
invited drift, and a new quantity required inventing a brand, a constant, and an
interpretation all over again.

## Decision

One dependency-free canonical units module, `packages/contracts/src/units.ts`,
is the single home for the canonical unit table. It declares, per quantity, the
canonical unit and the branded safe-integer type that carries it:

- mass = kilogram (`Kg`); length, calibre, armour, diameter = micrometre (`Um`,
  with `MM_TO_UM`, `UM_PER_INCH`); speed = micrometres per second (`UmPerSec`,
  `KNOTS_TO_UMS`/`UM_PER_KNOT`); volume = litre (`Litre`); power = kilowatt
  (`Kw`); ratio = basis point (`Bp`, `BP_ONE = 10_000`); time = integer
  month/year with no wall clock; money = integer treasury unit (`Money`, see
  [ADR-0216](ADR-0216-money-type-and-treasury-bridge.md)).

The canonical constants (`BP_ONE`, `MM_TO_UM`, `KNOTS_TO_UMS`, `UM_PER_INCH`)
and the checked helpers (`mulBp`, `ceilDiv`, `toSafe`) live here once. Every
constructor rejects a non-integer, an unsafe integer, or a value below the
quantity's minimum with a `_tag`-discriminated `UnitError`, and never returns
`NaN`/`Infinity`. The module is runtime-free: no Node, filesystem, `Intl`,
`Date`, locale, clock, or float arithmetic.

`packages/ship-design/src/units.ts` re-exports the canonical definitions (the
*migrate*/*contract* steps of an expand→migrate→contract sequence) so existing
importers keep working while exactly one definition remains. Authoring units
(millimetres, knots, inches) and display units are **not** canonical: authoring
conversion happens once at the content-compile boundary, display conversion only
at the presentation boundary ([ADR-0218](ADR-0218-conversion-and-locale-boundary.md)).

## Consequences

- Adding a quantity means editing one module, not inventing a brand per package.
- A plain `number` where a canonical branded value is expected fails typecheck.
- The consolidation is value-preserving: stored integers are unchanged and the
  cross-process reference run is byte-identical before and after.
- The contracts package stays free of Node, filesystem, and presentation
  concerns, preserving the directed package graph (BW-ARC-001).
