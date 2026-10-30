# ADR-0322: Realism modes gate battle orders in the engine, not in the UI

Applies to: combat

## Status

Superseded by: ADR-0358

Accepted (2026-10-27). Records the resolved rules of the T-2 realism decision
(#326) and unblocks the rank-gated targeting work in #230.

## Context

The manual gives three realism modes (Admiral, Rear Admiral, Captain) and a
permission matrix over battle orders. The T-2 map decided that the mode is a
battle input enforced by the engine, but no ADR or engine function existed, so
#230 could not implement rank-gated targeting and the UI could not agree with
the engine on what is allowed.

## Decision

- `@bluewave/combat/orders` exports `RealismMode` (`ADMIRAL`, `REAR_ADMIRAL`,
  `CAPTAIN`) and one `realismPermissions` function that answers the whole
  matrix. The UI must call the same function to grey out controls.
- Division orders: an admiral orders the lead division of each player force
  only; a rear admiral and a captain order any division of the force.
- Other-division control (manual or AI toggle): admiral none; rear admiral only
  while the division is within the force flagship's own-side visual sight at the
  start of the minute; captain at any time.
- Target orders: admiral none; rear admiral to divisions; captain to divisions
  or single ships.
- Hold fire and abstention from torpedoes: rear admiral and captain. Manual
  torpedoes and smoke floats: captain only. Force orders: all modes.
- The victory-point multiplier is part of the same answer: 10,000 bp for an
  admiral, 9,000 for a rear admiral and 8,000 for a captain. The resolution
  layer applies it as an explanation-tree node, never the minute loop.
- A forbidden order is refused with `ORDER_NOT_PERMITTED_AT_REALISM` and never
  silently downgraded. `assertOrderPermitted` carries the mode, capability,
  lead-division flag, sight flag and target kind in the error context.
- The mode is snapshotted from the player preference at battle start, fixed for
  the battle and included in the battle input hash. The engine never reads
  preferences ambiently. Computer-controlled forces are unaffected.
- This slice provides the pure matrix only. Wiring it into the order compiler,
  the targeting command and the battle screen lands with #230 and the battle UI;
  no player path or authoritative hash changes here.

## Consequences

- #230's first acceptance bullet (a recorded rank-gating decision) is met, and
  the targeting slice can enforce the matrix instead of inventing one.
- The UI and the engine share one permission source, so a control cannot be
  enabled for a mode that would reject it.
- Values are the decided realism multipliers; no new balance value is introduced.
