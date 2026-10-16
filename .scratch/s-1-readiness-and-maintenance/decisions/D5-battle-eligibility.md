# D5: Battle eligibility

**Type:** grilling · **Status:** resolved

## Question

How does readiness exclude ships from battle, and where?

## Answer

The campaign's `battle_generation` phase supplies each ship's authoritative
readiness and crew quality to the combat seams that already exist, replacing the
hard-coded placeholders: `resolveReadiness` (today `() => 80` in
`packages/phase-engine/src/battlePhases.ts`) and the crew-quality input (today
neutral). In `packages/combat/src/generation/eligibility.ts`, the existing
`SHIP_WORKING_UP_BATTLE_INELIGIBLE` predicate is keyed off the real `WORKING_UP`
state rather than `isUnderConstruction`, and `RESERVE`/`MOTHBALLED` ships are
excluded from ordinary battles. Readiness below a ruleset floor continues to use the
existing `FUEL_BATTLE_INELIGIBLE` path.

The manual's surprise-attack exception — reserve and mothballed ships may be caught
"to make them vulnerable" (p.69) — registers as a named seam on the surprise-attack
path; it is not modelled in S-1.

## Why

Combat generation is the single place a ship is admitted to a battle, and it already
declares the readiness input, the crew-quality input and the working-up exclusion
reason code — the campaign side simply passed constants. Keying the exclusion off
real readiness replaces the `isUnderConstruction` proxy, which happens to coincide
today only because new ships are the only non-operational ones.
