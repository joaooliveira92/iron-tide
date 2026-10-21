# Decision Request: S-5 possession transfer — which war outcome drives it

## Status

Blocked pending owner decision.

## Trigger

Issue #165 (follow-up to #76 / ADR-0231) asks for actual possession transfer: command or event, validation, persistence and deterministic replay, with presence areas updating on the next evaluation. It states the work "needs a decision on which war outcome drives it; do not invent values". Two plausible interpretations change gameplay, which is a stop condition in AGENTS.md.

## Evidence

- `WorldState.possessions` holds ownership; nothing in the engine changes it (ADR-0231 defers "possession transfer itself").
- `packages/campaign` has war records and blockade records, but no peace-treaty or war-outcome step that could cede territory (searched `packages/*/src`, ADRs, README, RULES).
- `presence` derives each nation's areas from `possessions` (`packages/campaign/src/presence.ts`), so a transfer is picked up on the next evaluation by construction.

## Why agent judgment is insufficient

Which events cede a possession, who chooses what is ceded, and whether the loser can refuse are game-design choices. Different answers produce different authoritative outcomes and different wire formats (frozen once shipped).

## Options

### Option A: Explicit treaty command at war end

- Behavior: a new war-ending command carries a list of ceded possessions; validation checks the winner/loser and ownership; one `PossessionTransferred` event per item.
- Advantages: player/AI choice is explicit and auditable; no hidden formula.
- Risks: requires a war-termination mechanic that does not exist yet (scope expansion into a deferred subsystem).
- Compatibility impact: new command and event envelopes; no existing golden moves.
- Migration impact: none.
- Scope and effort: large (needs war end, treaty UI/AI).

### Option B: Automatic transfer by war outcome rule

- Behavior: a ruleset-driven rule (for example occupation or blockade held for N months at war end) transfers possessions without a player choice.
- Advantages: no player command needed.
- Risks: needs gated values (N, which possessions) that are unsourced; also needs a war-end event.
- Compatibility impact: new ruleset section; golden hashes unchanged while dormant.
- Migration impact: none.
- Scope and effort: medium plus value research.

### Option C: Defer until a war-termination design exists

- Behavior: keep #165 open and unimplemented; fixtures continue to set ownership.
- Advantages: no speculative design.
- Risks: S-5 presence never reflects territorial change in play.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: none.

## Recommendation

Option C now, then Option A once a war-termination mechanic is designed, because transfer without a defined war end would invent both the trigger and the values. Do not implement before approval.

## Work safely completed while blocked

S-5 #79-#83 and #87 landed with the possession read path; the transfer write path is the only missing piece.
