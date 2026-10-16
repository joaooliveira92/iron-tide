# Decision Request: Combat resolver float→fixed conversion materially changes battle outcomes

## Status

Blocked pending owner decision.

## Trigger

U-1 ticket 07 requires replacing the float arithmetic in combat strength and the
"legacy resolver" with fixed-point integer maths "with one rounding point, so no
float reaches a battle outcome". Ticket 07 carries a stop surface (spec D5): _"if the
reviewed difference between the old float-based and new fixed-point battle outcomes is
materially large or not explainable as a rounding of the same formula, stop and raise a
decision request rather than land it."_ The resolver is **live** and its float usage is
**structural** (randomised factors, a ratio-derived damage probability), not a single
formula's rounding — so the stop surface is met on inspection.

## Evidence

- `packages/combat/src/resolver.ts` — the float pipeline that decides battle outcomes:
  `attackerFactor/defenderFactor = 1 + (rand − 50) / 100` (:73–74);
  `strengthRatio = loserEff / winnerEff`, `damageRatio = (1 − strengthRatio) / 2` (:96–97);
  the strength path `dp = damagePotential(fleet)`, `surv = survivability(fleet)`,
  `SafeInt(Math.floor(raw))` (:158–161); damage `Math.max(1, Math.floor(hp * damageRatio))`
  (:182) and a **probabilistic** sink keyed on `damageRatio` (:190–191).
- `packages/combat/src/strength.ts` — `damagePotential` (:32) returns a float
  (`firepower * (avgArmor / 10)`, float average armour); `survivability` (:41) returns
  `hp / maxHp`. `averageArmor` is already integer (`SafeInt.div(..., "halfUp")`), so the
  float leaks are `damagePotential`/`survivability` and the resolver ratios.
- `packages/phase-engine/src/battlePhases.ts:5,115,129–132` — **the resolver is the live
  path** for a battle without a manifest ("A battle WITHOUT a manifest keeps the M1
  `BattleResolver` strength path"). It is not dead code.
- Tests pin the current float behaviour: `packages/combat/test/combat.test.ts:442,450–452`
  ("averageArmor returns halfUp 13, but damagePotential uses float 12.5" → `25`),
  `:455–459`.
- `golden/hashes.json` now exists (commit `0117adc`), but the cross-process fixture
  declares no designs/battles, so a resolver change would **not** move the golden — the
  re-pin guard cannot capture this outcome change. The movement shows up only in the
  production campaign's battle results.
- U-1 spec D5 stop surface; U-1 ticket 07; AGENTS stop condition "a migration changes
  authoritative outcomes unapproved".

## Why agent judgment is insufficient

Converting this pipeline changes WHICH SIDE WINS and how many ships sink in the live
(manifest-less) battle path. It is not a rounding of one formula: the resolver combines
a rounded ratio, a probability, and a per-ship sink into a decision, so fixed-point
quantisation produces a different distribution of outcomes, not the same result rounded
once. Choosing the quantisation (how many basis points express the factors/ratio, whether
the sink threshold shifts) is a gameplay/design call with compatibility consequences on
every save that contains battle results.

## Options

### Option A: Land ticket 07 as written

- Behavior: convert strength + resolver to fixed-point, review the per-battle delta, re-pin.
- Advantages: completes the "no float reaches an outcome" rule.
- Risks: the delta is material (winner/loss changes), and the golden gate cannot witness
  it; landing silently shifts live battles.
- Compatibility impact: production battle outcomes and any saved battles move.
- Migration impact: none.
- Scope and effort: M, plus a hard-to-review delta.

### Option B: Define the fixed-point battle model first (owner-approved)

- Behavior: approve a concrete fixed-point resolver design (e.g., factors and
  `damageRatio` as basis points with a declared rounding, the sink threshold defined),
  with a worked old/new distribution, then implement it under that approval.
- Advantages: the change is a reviewed, deliberate gameplay-affecting act; the delta is
  auditable.
- Risks: delays ticket 07; needs an owner decision on the model.
- Compatibility impact: declared.
- Migration impact: none.
- Scope and effort: S to spec, M to implement.

### Option C: Scope 07 to the strength path only; document the resolver as a seeded exception

- Behavior: make `damagePotential`/`survivability` integer (`SafeInt`), leaving the
  resolver's randomised factor/ratio/probability maths as a documented, float-gate
  baseline entry; the spec's "legacy resolver" clause is deferred to Option B.
- Advantages: removes the audited strength floats now without moving battle outcomes
  materially (the strength path's contribution changes only by a rounding); no gameplay call.
- Risks: does not fully meet ticket 07's "no float reaches a battle outcome"; the resolver
  still uses float internally (seeded in the ticket-04 baseline).
- Compatibility impact: minimal (a rounded strength contribution).
- Migration impact: none.
- Scope and effort: S.

## Recommendation

**Option C now, Option B later.** Convert the strength helpers (a genuine rounding of the
same formula) and leave the resolver's factor/ratio/probability pipeline as a documented
float-gate baseline entry pending an owner-approved fixed-point model (Option B). Do not
land Option A: it changes live battle outcomes under a "fixed-point" ticket without a gate
that can witness the delta.

## Work safely completed while blocked

- U-1 tickets 01–06 landed (canonical units module; brand consolidation; money branding
  and the declared-rounding bridge; the authoritative-float gate; the priorities locale
  leak; fixed-point construction-capacity apportionment).
- The ticket-04 authoritative-float gate now baselines the 12 combat float literals, so
  they cannot silently grow while this request is open.
- No engine or content change was made for ticket 07.
