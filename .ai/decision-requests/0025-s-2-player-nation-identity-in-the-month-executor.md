# Decision Request: Which nation is "the player" inside the month executor

## Status

Resolved (2026-10-20) by the owner: **Option A**, recorded as
[ADR-0245](../../docs/adr/ADR-0245-player-nation-id-in-campaign-state.md). The player nation id is
stored in authoritative campaign state; it must name exactly one playable nation in the snapshot; no
legacy save is migrated because none identifies its player unambiguously.

## Trigger

S-2 ticket 04 ([#89](https://github.com/joaooliveira92/iron-tide/issues/89), spec #74 R4, R5, R7) applies prestige changes "to the player's nation only" and leaves AI-nation prestige unchanged. The month executor has no notion of which nation is the player. Implementing the ticket needs one, and every way of supplying it either changes authoritative state or changes how a month is replayed.

## Evidence

- `CampaignSnapshot` / `NationState` (`packages/campaign/src/state.ts`) carry `isPlayable` (a roster flag, true for ten nations) and `isAI`, but no "controlled by the player" marker.
- `MonthContext` and `MonthExecutorEngineOptions` (`packages/phase-engine/src/monthContext.ts`) hold no player identity. `runObligationPhase` iterates every nation where `isPlayable || isAI`.
- Player identity exists only at the call-site edge: `playerNationId` / `playerSlotId` are arguments to projection builders (`campaign-engine/src/priorities.ts`, `opening-briefing.ts`, `diplomacy.ts`, `battle-history.ts`).
- Spec #74 R7 and R9 also need it: the sacking draw is keyed by nation and month, the career result names the nation, and a terminal career refuses further commands.

## Why agent judgment is insufficient

The options differ in authoritative-hash, save-compatibility and replay outcomes, and ticket 04 states "no change to state beyond prestige". Choosing silently would either move goldens a second time or let two replays of the same save diverge depending on caller input.

## Options

### Option A: Player nation id in authoritative campaign state

- Behavior: `CampaignSnapshot` gains a required `playerNationId`, set when a campaign starts and preserved through saves. Phases read it.
- Advantages: a save alone replays identically; the hash covers it; no caller can misconfigure it. Fits R11 and R9 (career result survives save and load).
- Risks: touches state, compile and the new-campaign flow.
- Compatibility impact: another compatibility bump and golden re-pin, unless folded into the pending S-2 re-pin. Prestige state already bumped to 4.0.0.
- Migration impact: older saves refused (existing policy).
- Scope and effort: medium; adds a prerequisite ticket before #89.

### Option B: Player nation id as a month-executor input

- Behavior: `MonthExecutorEngineOptions` gains `playerNationId`; phases read it from the context. Not part of the snapshot hash.
- Advantages: no state or compatibility change; small.
- Risks: replay from a save needs the caller to supply the same id, so determinism depends on the caller. The career result and terminal state still need a durable record of who was sacked.
- Compatibility impact: none for the id; the career record in state still changes state.
- Migration impact: none.
- Scope and effort: small, but only defers Option A's state question to R8 and R9.

### Option C: Apply prestige to every playable nation

- Behavior: no identity needed; each `isPlayable` nation is evaluated.
- Advantages: no new input.
- Risks: contradicts spec #74 ("player only", "AI-nation prestige is not changed") and ADR-0239. Needs the owner to change the spec.
- Compatibility impact: none. Migration impact: none. Scope and effort: small, but a gameplay change.

## Recommendation

Option A, as a small prerequisite ticket sharing the re-pin with the prestige movement. R8 and R9 require a durable "who is sacked" in authoritative state anyway, so Option B only postpones the same state change.

## Work safely completed while blocked

None for ticket 04. Verified that ticket 02 (rule layer, `packages/campaign/src/prestige.ts`) and ticket 03 (state and seeding, compatibility 4.0.0) are already on `dev`, and that ADR-0239 authorizes the UNPAID_FUNDS rule (300 bp proportional loss). The corresponding GitHub issues (#86, #88) are still open.
