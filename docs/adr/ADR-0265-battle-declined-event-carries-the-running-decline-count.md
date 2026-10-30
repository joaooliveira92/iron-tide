# ADR-0265: The BattleDeclined event carries the running decline count

Applies to: events, phase-engine

## Status

Superseded by: ADR-0363

Accepted (2026-10-21). Closes review item R14 of the T-1 battle-offer work (spec
[#109](https://github.com/joaooliveira92/iron-tide/issues/109), R9). Builds on ADR-0256 and ADR-0257.

## Decision

`BattleDeclined` gains a required `declineCount` (positive safe integer): the player's declined-battle tally in the
ruleset's counter scope after this decline, the same value `DeclineThresholdReached` already reports as `count`.
`applyDecline` passes the tally it just computed, so no second count exists. The message projection adds `declineCount` to
the `messages.battle.declined` interpolation, so a presentation layer can show "N declines so far" without reading state.

## Why not the displayed string

The count is available to the string but the catalogue wording is unchanged. `messages.battle.declined.body` lives in the
compiled `ui/en-US.yaml`; editing it moves the content lock and the replay `contentHash` and therefore needs the
owner-approved re-pin. Surfacing the count in the displayed text is deferred to that action; the event and interpolation
are ready for it.

## Compatibility

The event is T-1 only and appears in no production save or golden: the golden hashes and the replay corpus are unchanged.
Event consumers decode with the strict schema, so a `BattleDeclined` ledger written before this change (fixture-class runs
only) is refused rather than defaulted; nothing is inferred.
