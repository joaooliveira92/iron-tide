# 05: Turn transaction commands and pending-turn sidecar

**What to build:** The application layer that turns the pause/resume seam into a player-usable transaction. On the existing single campaign command surface, add commands to resolve or resume a turn, answer a decision, submit a battle result, and abandon a pending turn; all are schema-validated and return validated DTOs. A suspended turn is persisted to a non-authoritative `pending-turn.json` beside the save. On load, the pending turn is validated against the already-verified save (starting revision, campaign id, ruleset/content versions, recomputed turn id); a mismatch is reconstructed deterministically or reported as resumption-unavailable, never trusted or migrated, and never mutates authoritative state. The existing commit path is retained and delegates to the no-interruption fast path.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] Resolving a turn returns either a completed summary or a suspended interruption request.
- [ ] A decision and a battle can each pause the turn, be persisted, survive a reload, and resume exactly once.
- [ ] Answering a decision or submitting a battle result validates at the command boundary and never reaches the renderer as engine state.
- [ ] A stale or incompatible pending turn is never applied and leaves the authoritative save byte-identical.
- [ ] Abandoning a pending turn clears only the sidecar; no authoritative save, pointer, envelope, or compatibility version changes.
- [ ] A save without a pending-turn sidecar loads normally.
- [ ] `commitMonth` is retained and delegates to the no-interruption path.
