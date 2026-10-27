# ADR-0219: Combat and construction-capacity float→fixed conversion and its re-pin

Applies to: combat, contracts, cross-process-test

## Status

Accepted (2026-10-16). Implements the two authoritative float-path conversions of [ADR-0202](ADR-0202-canonical-internal-values.md) under the resolved golden baseline of decision request 0005; U-1 of `.ai/SPRINT-PLAN.md` Phase 2.

## Context

The authoritative float audit (map D5) found two float paths that flow into the
hashed campaign snapshot: combat strength and the legacy battle resolver
computed average armour and damage potential as floats, and the economy
construction-capacity phase funded projects by a float proportion before a
`floor`. This is a determinism-contract compliance fix (BW-DET-001), not a
balance choice; it can change outcomes, so the delta had to be reviewed and the
reference run re-pinned with a stated cause.

## Decision

Convert both paths to fixed-point integer arithmetic in canonical units, with one
rounding point per formula, using the [ADR-0217](ADR-0217-rounding-and-authoritative-float-gate.md)
helpers:

- **Combat.** `StrengthCalculator.damagePotential` is the exact integer
  `floor(firepower * totalArmor / (10 * count))` — average armour is never
  rounded before the product. `survivability` is a canonical ratio
  (`round-half-up(hp * BP_ONE / maxHp)`, capped at `BP_ONE`).
  `StrengthCalculator.strength` is the exact rational
  `floor(firepower * totalArmor * min(hp, maxHp) / (10 * count * maxHp))`, floored
  once, so the resolver composes the two quantities without double-rounding. The
  resolver's factor is exact basis points (`BP_ONE + (draw - 50) * 100`), effective
  strength is `strength * factorBp`, and the damage/sink path uses the exact
  rational `(winnerEff - loserEff) / (2 * winnerEff)`, floored once
  (`damage = max(1, floor(hp * num / den))`, sink `roll * den < num * 100`). The
  RNG protocol is byte-identical (same `combat:resolve:<id>` stream, same
  `drawUniform` ranges and order).
- **Economy.** The construction-capacity proportion (a float
  `remainingWork / totalRemainingWork` then `Math.floor` per project) is replaced
  with integer largest-remainder apportionment (`splitLargestRemainder`); the
  funding split sums exactly to the available funds with one rounding point and
  no float.

**Reviewed delta.** A 4000-matchup sweep plus the seven named fixture battles
show the combat refactor is exactly value-preserving: 4000/4000 identical, zero
winner flips, zero loss flips, zero damage-value diffs. The capacity split
differs from the old floor-per-project only when two or more projects are funded.

**Re-pin.** No re-pin is required. The cross-process reference run
(`packages/cross-process-test/src/run-child.ts`) resolves no battle (its fixture
is at peace) and stubs `resolveStrength`, so neither converted path is exercised:
`pnpm check:golden` reports all 11 hashes match the committed reference and two
child runs are byte-identical. The trailer is `Golden-Repin: not-needed` — a
genuine no-output change for the reference run, not a weakened gate. The D5 stop
surface (a materially large or unexplainable delta) was not triggered.

## Consequences

- No float remains on any battle-outcome or hashed-projection path.
- The outcome change is deliberate, reviewed, and recorded.
- No additional compatibility bump: the change is exactly value-preserving and
  joins S-1 ticket 01's `3.0.0` release window (the plan's "whichever lands
  first bumps, the other joins that release").
