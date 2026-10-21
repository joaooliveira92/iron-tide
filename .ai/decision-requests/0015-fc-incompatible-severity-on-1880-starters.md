# Decision Request: FC_INCOMPATIBLE severity on 1880 designs that cannot fit a director

## Status

Resolved (2026-10-21) by owner delegation: **Option B**, recorded as
[ADR-0266](../../docs/adr/ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md).

## Trigger

Every 1880 reference design with guns carries a `FC_INCOMPATIBLE` WARNING ("N gun(s) have no
compatible fire-control director"), including all six starter types a new player is offered. The rule
is working as written, but no 1880 director exists to fit, so the player cannot clear the warning.
Raising or lowering this severity, or gating the rule on director availability, changes what the
Drawing Board tells every player about every opening design, so it is a gameplay interpretation, not a
renderer choice.

## Evidence

- Rule: `packages/ship-design/src/systems.ts` (`FC_INCOMPATIBLE`, `severity: "WARNING"`; uncontrolled guns
  fire at `-localControlPenaltyBp`).
- Observed in the plan via `planModel(...).findings` for all reference designs under
  `content/production/1880/ship-building/reference-designs/`: `havock_like` (3 guns), `majestic_like` (11),
  `starter_*` (2 to 4), `alexandra_1877` (3), `torpedo_cruiser_1880` (2).
- Other findings on the same designs are not in question: `ARC_OBSTRUCTED`, `MAGAZINE_UNPROTECTED`,
  `STABILITY_STIFF`, `HULL_BUOYANCY_MISMATCH` read as real design feedback.
- The plan markers (warning triangles on mounts) are a faithful rendering of these findings; the clutter is
  the findings, not the drawing.

## Why agent judgment is insufficient

- If the warning is meant to teach "you have no director", it is correct and the 1880 starters are
  simply under-equipped; the plan should keep showing it.
- If directors do not exist until a later technology, a permanent unfixable WARNING is noise that trains
  players to ignore the severity channel, and it changes what counts as "a clean design" in acceptance runs.
- Either outcome changes authoritative validation output and possibly golden hashes.

## Options

### Option A: Keep WARNING

- Behavior: unchanged.
- Advantages: no engine, content or golden change.
- Risks: every opening design opens with an unfixable warning; the plan stays cluttered.
- Compatibility impact: none. Migration impact: none. Effort: none.

### Option B: Downgrade to ADVISORY until a director is available to the nation and month

- Behavior: severity is ADVISORY while no compatible director is introduced by the design month, WARNING after.
- Advantages: the 1880 starters validate clean of unfixable warnings; the warning returns when it is actionable.
- Risks: needs an availability query in the rule's inputs; golden findings for 1880 designs re-pin.
- Compatibility impact: finding severity only, ids and subjects unchanged. Migration impact: none to saves.
- Effort: small engine change plus a parity test and a deliberate golden re-pin.

### Option C: Do not emit the finding when no director exists in the catalogue for that month

- Behavior: the rule is silent pre-director; local-control accuracy penalty still applies.
- Advantages: cleanest 1880 output. Risks: hides a real accuracy penalty from the player.
- Compatibility impact: removes findings; Effort: as B.

## Recommendation

Option B: the player is still told about the accuracy cost, but the severity channel stays meaningful
when the player has no remedy. Do not implement before approval.

## Work safely completed while blocked

Plan-rendering polish that does not depend on this decision (wing-mount barrel direction, calibre-scaled
mount sizes).
