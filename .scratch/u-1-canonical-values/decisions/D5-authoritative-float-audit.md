# D5: Authoritative float audit

**Type:** grilling · **Status:** resolved

## Question

Which floats reach authoritative, hashed outcomes, and what is the remediation?

## Answer

The audit (recon, "Float audit") found these authoritative leaks:

1. **Combat strength / legacy resolver.** `packages/combat/src/strength.ts`
   (`damagePotential`, `survivability`; `avgArmor = armorTotal / active.length`,
   `firepower * (avgArmor/10)`) feeds `packages/combat/src/resolver.ts`
   (`BattleResolver`), reached from `packages/phase-engine/src/battles.ts`
   (`resolveLegacyBattle`) and `battlePhases.ts`; its result flows through
   `applyBattleResult` into hashed campaign state.
2. **Economy capacity ratio.** `packages/phase-engine/src/economyPhases.ts`
   construction capacity uses a float `proportion = remainingWork /
   totalRemainingWork` before `Math.floor`.
3. **Minor integer-in/float-out sites** (`Math.round`/`ceil`/`floor` on bp and
   counts in `combat` and `campaign-engine`) — integer results today, but not
   declared as fixed-point.

**Remediation:** replace 1 and 2 with fixed-point integer arithmetic in canonical
units, using the D2/D4 helpers, with exactly **one rounding point** per formula
and largest-remainder for any total split. Convert the minor sites to the declared
vocabulary so the new gate (D4) passes.

This is a **determinism-contract compliance fix** (BW-DET-001 requires integer or
fixed-point authoritative arithmetic), not a balance choice. It **can change
outcomes** (a battle that resolved on a fraction may now resolve on the rounded
integer), so the delta is reviewed and the golden reference run re-pinned with a
stated cause.

## Why

Floats in hashed outcomes are the largest correctness risk the recon found: the
contract forbids them, and while IEEE doubles are deterministic for identical
operations they are not the contract's required representation, and they invite
the very `Math.*` drift the gate exists to catch. Fixing them is in scope for
U-1's "audit of float or display-leaking values".

## Gating and stop surface

Every ticket here changes authoritative outcomes and is **gated by decision
request 0005** (golden baseline) — the re-pin cannot be performed while
`golden/hashes.json` is absent (D7). If the reviewed delta between old and new
battle outcomes is materially large or ambiguous (not explainable as a rounding
of the same formula), stop and raise a decision request rather than land it.
