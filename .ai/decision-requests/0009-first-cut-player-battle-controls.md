# Decision Request: First-cut player battle controls (targeting, realism modes, formation/role editor)

## Status

Blocked pending owner decision.

## Trigger

Issue #221 lists OOB, formations, roles, speed, targeting, force orders and the
three realism modes for the production battle screen, and its Open question asks
which tactical systems are in the first cut. The screen on `dev` covers offer,
accept, division stance and speed, auto-fight, result submission, units and
non-colour cues, and mid-battle save/resume. Targeting, the realism modes and a
formation/role editor are not in the screen.

## Evidence

- `PlayerBattleScreen` and `battleOfferCommands.test.ts` (accept, fight, submit).
- `scripts/data/reachability-ledger.json`: fire and torpedoes are marked automatic;
  the player controls division stance and speed only.
- Realism and targeting need session-engine work and a rule for how ADMIRAL,
  REAR_ADMIRAL and CAPTAIN gate commands. No ADR defines that gating.

## Why agent judgment is insufficient

Each choice changes what the player can order and therefore authoritative battle
outcomes and replay hashes. Command gating by rank is a gameplay rule, not a
local design choice.

## Options

### Option A: Ship the current cut, defer the rest

- Behavior: stance, speed, auto-fight only; fire and torpedoes stay automatic.
- Advantages: no engine change, no hash risk, #221 closes now.
- Risks: the battle is thin for a "fought" battle; the ledger must say targeting is not reachable.
- Compatibility/migration impact: none.
- Scope: nil.

### Option B: Add targeting only

- Behavior: per-division target priority orders, gated by rank.
- Advantages: the largest gain in player agency for the least engine work.
- Risks: needs the rank-gating rule; changes battle outcomes and goldens for fought battles.
- Compatibility/migration impact: new command, replay corpus re-pin.
- Scope: medium.

### Option C: Targeting, three realism modes, formation/role editor

- Behavior: full list from the issue.
- Advantages: matches the issue text and roadmap T-2.
- Risks: large; session-engine work for realism; likely a deferred-subsystem expansion.
- Compatibility/migration impact: new commands and save sidecar fields; golden re-pins.
- Scope: large, split into several issues.

## Recommendation

Option A now, with Option B as a follow-up issue once the rank-gating rule is
decided; Option C split from there. This lets #221 close without guessing gameplay.

## Work safely completed while blocked

Accepted offers lead to a player-fought battle; the result returns through the
`battle_result` path; the order log is saved and replayed on restart; the UI
catalogue loads before the shell renders; units and non-colour cues are honoured.
