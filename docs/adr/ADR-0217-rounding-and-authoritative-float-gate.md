# ADR-0217: Rounding and fixed-point rules and the authoritative-float gate

Applies to: repository

Rule: Use the contracts package's `RoundingMode` only; every authoritative formula declares its mode and rounds once at the end on exact `bigint` intermediates.

## Status

Accepted (2026-10-16). Implements the rounding/fixed-point boundary of [ADR-0202](ADR-0202-canonical-internal-values.md); U-1 of `.ai/SPRINT-PLAN.md` Phase 2.

## Context

Rounding was ad hoc: at least a dozen sites used `Math.floor`/`Math.round`
directly, with no single vocabulary and no declared rounding point per formula.
Floating point reached hashed outcomes in the combat strength/resolver path and
the economy construction-capacity ratio, and nothing failed closed when a new
float appeared in an authoritative package.

## Decision

One rounding vocabulary: the existing `RoundingMode`
(`trunc | floor | ceil | halfUp | halfDown | halfEven`) owned by the contracts
package. A second rounding enum is rejected.

Every authoritative formula declares its mode and follows compose-exactly,
round-once: intermediates are exact `bigint`, and the single declared rounding
happens at the end (the existing `mulBp`/`ceilDiv`/`toSafe` helpers are the
model). Checked helpers throw a typed `UnitError` and never produce `NaN` or
`Infinity`. Largest-remainder apportionment (`splitLargestRemainder`,
`scalePlanToUnits`/`capacityInUnits`) is the registered way to split an integer
total, rather than reinventing a drift-prone split per site.

The authoritative-float gate tightens `scripts/assert-authoritative-determinism.mjs`
with a `FLOAT_ROOTS` scope — the outcome-producing pure packages
(`campaign`, `campaign-engine`, `commands`, `events`, `phase-engine`, `combat`,
`ship-design`). A fractional numeric literal or `parseFloat` in that scope fails
closed. The rule is proven by the gate's embedded `--self-test` fixtures (a
float fixture that must fail, a clean tree that must pass) and is wired into
`pnpm preflight`. The rounding-vocabulary home (`contracts`, `deterministic`)
and presentation (`ship-visual`) are excluded, since they legitimately carry
fractional constants. The save-boundary `assertNoFloats`/`FLOAT_IN_STATE` guard
stays.

## Consequences

- The determinism rule cannot silently decay: a new authoritative float fails
  the standing gate rather than drifting into a hashed outcome.
- Every rounding change is auditable as a deliberate, declared act.
- The gate adds no material runtime cost to the standing checks.
- Value-preserving: adding the helpers and gate changes no authoritative value.
