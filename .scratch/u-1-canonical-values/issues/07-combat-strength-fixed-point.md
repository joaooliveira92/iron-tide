# 07: Combat strength and resolver to fixed-point

**What to build:** Replace the float average-armour and damage-potential path in
combat strength and the legacy resolver's float arithmetic with fixed-point
integer maths in canonical units, with one rounding point, so no float reaches a
battle outcome. This changes authoritative outcomes, so it rides a reviewed delta
and a re-pin, with a stop surface if the delta is not explainable as a rounding
of the same formula.

**Blocked by:** 04 (rounding helpers and the float gate); plus decision request
`.ai/decision-requests/0005-officer-rosters-and-divisions-golden-repin.md`
(the golden baseline).

**Status:** done

0005 gating resolved: `golden/hashes.json` exists (see Resolution below).

Gated by 0005. **Stop surface (map D5):** if the reviewed difference between the
old float-based and new fixed-point battle outcomes is materially large or not
explainable as a rounding of the same formula, stop and raise a decision request
rather than land it.

- [x] Combat strength and the resolver use fixed-point integer arithmetic in
      canonical units; no float reaches a battle outcome or a hashed projection.
- [x] The old/new battle-outcome delta is reviewed and recorded; the reference run
      is re-pinned with a stated cause under 0005 (or a decision request is raised
      per the stop surface).
- [x] A test drives a battle from a compiled month and asserts the integer result;
      the cross-process child run is byte-identical run twice.

## Resolution (U-1 ticket 07)

`packages/combat/src/strength.ts` and `packages/combat/src/resolver.ts` now compute
in fixed-point integer/bigint arithmetic with one rounding point; no float remains
on any battle-outcome or hashed-projection path (verified by
`assert-authoritative-determinism`, the combat test suite, and inspection).

- `StrengthCalculator.damagePotential` is an exact integer
  `floor(firepower * totalArmor / (10 * count))` (average armour never rounded
  first); `survivability` is a canonical basis-point ratio
  (`round-half-up(hp * BP_ONE / maxHp)`, capped at `BP_ONE`); the new
  `StrengthCalculator.strength` is the exact rational
  `floor(firepower * totalArmor * min(hp, maxHp) / (10 * count * maxHp))`, floored
  once (the resolver consumes it, avoiding a double-round through the two rounded
  projections).
- The resolver's factor is now exact basis points
  (`BP_ONE + (draw - 50) * 100`), effective strength is `strength * factorBp`
  (shared `BP_ONE` denominator, so the comparison and ratio stay exact), and the
  damage/sink path uses the exact rational `(winnerEff - loserEff) / (2 * winnerEff)`
  floored once — `damage = max(1, floor(hp * num / den))`,
  sink `roll * den < num * 100` — with no bp intermediate feeding the outcome.
- The RNG protocol is byte-identical (same `combat:resolve:<id>` stream, same
  `drawUniform` ranges and order).

**Reviewed delta:** a 4000-matchup sweep plus the seven named fixture battles show
the refactor is exactly value-preserving — 4000/4000 identical, **0** winner
flips, **0** loss flips, **0** damage-value diffs (max |Δ| = 0). The formula is the
same; only its representation changed.

**Reference run / re-pin:** unchanged. The cross-process reference run
(`packages/cross-process-test/src/run-child.ts`) resolves no battle (its fixture is
at peace) and stubs `resolveStrength` in the generation hash, so combat strength is
never exercised: `pnpm check:golden` reports all 11 hashes match the committed
reference, and two child runs are byte-identical (`pnpm check:determinism`). No
golden re-pin is required (`Golden-Repin: not-needed`, a genuine no-output change
for the reference run).

**Compatibility:** no additional bump. S-1 ticket 01 already took
`CURRENT_COMPATIBILITY_VERSION` to `3.0.0` in the same, unreleased release window
(reject-only; no released save exists), and U-1 ticket 07's formula change joins
that release — the plan's "whichever lands first bumps, the other joins that
release". The change is exactly value-preserving, so a `3.0.0` save continues
identically.
