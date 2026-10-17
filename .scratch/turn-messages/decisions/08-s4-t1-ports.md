# D-08: Generic S-4 / T-1 ports only

**Type:** grilling
**Status:** resolved
**Blocked by:** None

## Question

Does this effort author starter decision content and battle-offer policy, or only
the generic protocols?

## Answer

**Only the generic ports.** This effort owns:

- `DecisionRequest` and `DecisionAnswer`;
- `BattleRequest` and `BattleResult`;
- suspension, persistence, replay, validation, and resumption behaviour.

**S-4 retains:** crisis content, eligibility rules, authored choices, effects, AI
weights, narrative catalogues.
**T-1 retains:** battle-offer policy, accept/decline rules, costs, force
composition, support-force rules, mission selection.

The seams are documented as explicit contracts in the map.

(Locked round 2, option a.)

## Consequence

S-4 and T-1 are blocked downstream of the interruption-seam delivery stage (M2),
never absorbed. Grounded by R-25.
