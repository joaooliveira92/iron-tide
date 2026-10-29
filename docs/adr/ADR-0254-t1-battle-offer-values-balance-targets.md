# ADR-0254: T-1 battle-offer values: labelled balance targets

Applies to: content, phase-engine, cross-process-test

## Status

Superseded by: ADR-0363

Accepted (2026-10-21). Resolves decision requests
[0028](../../.ai/decision-requests/0028-t-1-battle-estimate-model.md),
[0029](../../.ai/decision-requests/0029-t-1-decline-victory-point-cost.md),
[0030](../../.ai/decision-requests/0030-t-1-decline-opponent-credit.md),
[0031](../../.ai/decision-requests/0031-t-1-several-declined-battles-threshold.md),
[0032](../../.ai/decision-requests/0032-t-1-declined-battle-prestige-rule.md),
[0033](../../.ai/decision-requests/0033-t-1-enemy-decline-rule.md) and
[0034](../../.ai/decision-requests/0034-t-1-support-force-presence-and-composition.md)
(Option C), decided by the owner's delegation, which is the explicit owner
authorization R2 of spec #109 requires for any `balance_adjustment` value. Lifts the
owner-value gate on G1-G7 set by `docs/research/t-1-battle-offer-values.md`. Same
pattern as [ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md). Sprints: T-1.

## Context

The T-1 research found the manual states that each battle-offer quantity exists
(a force estimate, a victory-point cost, a prestige cost "after several declined
battles", an enemy that may decline, "sometimes" a support force) but supplies no
number, model or rule for any of G1-G7. The owner delegated the choice; Option C is
adopted: admit each value as an explicitly labelled Bluewave balance decision, the
path ADR-0213, ADR-0223 and ADR-0239 took for magnitudes the manual omits.

## Decision

**Every value below is a Bluewave balance decision.** Each is recorded with
`kind: balance_adjustment` and `sourceStatus: BALANCE_TARGET`, carries the
rationale given here, lives as a named centralized `battleOffers` ruleset constant
(ADR-0253 shape), and is never presented as a sourced fact. The "simulation matches
RTW3" constraint is waived for these values only. All are Class Balance.

| # | Item | Decision | Rationale |
| --- | --- | --- | --- |
| G1 | Estimate (0028) | kind `PERTURBED`; symmetric error bound 2000 bp of true strength; drawn from a recorded domain-separated stream keyed by battle and side; rounding half-up; composition not shown (strength figure only) | An estimate that is neither exact nor useless: about one fifth of error makes declining a real judgement without hiding a lopsided fight. Strength only, so the player cannot read the enemy order of battle. |
| G2 | Decline VP (0029) | fleet battle 5, cruiser battle 2 war-score points; no distance modifier (absent) | Small against the +/-100 war-score scale (surrender 80): a few declines hurt, one does not decide a war. Cruiser actions are smaller than fleet actions. The patch-note distance reduction has no number, so none is invented. |
| G3 | Opponent credit (0030) | `NONE` | The manual says only that the decliner pays; crediting the enemy would double the cost without a source. |
| G4 | "Several" (0031) | threshold 3 declines, scope `WAR`, reset `ON_WAR_END` | Smallest count that reads as "several" rather than "a couple"; a war is the natural unit of a refusal streak. |
| G5 | Prestige (0032) | proportional 300 bp of current prestige, S-2 loss arithmetic (`max(1, ceil(prestige * bp / 10000))`, never below zero, ADR-0239); applied on each decline at or after the threshold (repeat rule: each further decline) | Matches the manual's "proportional in most cases"; 3% equals the unpaid-funds loss, below the 5% battle-lost loss, so refusing is cheaper than losing. |
| G6 | Enemy decline (0033) | predicate: enemy strength < 5000 bp of the player's strength, compared on true strengths; probability 5000 bp drawn only when the predicate holds; no enemy cost | The enemy declines when outmatched two to one or worse, then half the time. No enemy cost keeps the rule one-sided and simple. |
| G7 | Support force (0034) | presence chance 2000 bp; composition the full existing cap (5000 bp share, `ALLIED_MAX_STRENGTH_BP`); source `ALLIED_ONLY` | "Sometimes" read as one battle in five; the existing cap is reused so no new strength rule is invented; own-AI divisions are not added. |

**Keys and ids.** Mission-type keys are the combat vocabulary ids `FLEET_BATTLE` and
`CRUISER_BATTLE` (ADR-0253, ticket #111). The distance `measure` stays unused because
no modifier is authored. VP values are non-negative integers on the war-score scale.

**Mechanics that follow.** The prestige rule is one per-source entry in the S-2
value-set shape, applied to the player nation only through the S-2 seam with a new
declined-battle reason code (ticket #115); T-1 never mutates prestige directly. The
G5 repeat rule (each further decline) is a ruleset field of the threshold event
(ticket #114 allows a repeat "per the ruleset"), so it adds no contradiction; the loss
therefore fires at the threshold crossing and on each later decline, not only once.
G6 compares true strengths; G1's perturbed figure is display only.

**Not decided here.** Offers per month beyond one accepted battle per area, coastal
raid ownership, and whether the decline cost is shown to the player (open
observations of spec #109).

## Consequences

- **#118 is unblocked on values.** Authoring the production `battleOffers` section may
  proceed once #115 and S-2 #89 land; it cites this ADR as the accepted-decision
  reference for each value. This ADR authors no ruleset, content or code.
- **Compatibility and goldens.** Nothing moves now. Authoring in #118 moves
  production behaviour and goldens once, re-pinned per
  `docs/agents/golden-repinning.md`; this ADR approves that one-time movement.
- **Tuning.** Every value is a ruleset constant; retuning is a ruleset version change
  with a re-pin, not a model or code change.
- **Honesty.** The provenance of each value is `BALANCE_TARGET`; no UI or doc presents
  one as the manual's.
- **Reopening.** If a higher-trust source for any item appears, it replaces the
  balance value through a ruleset version change, and this ADR is amended.
