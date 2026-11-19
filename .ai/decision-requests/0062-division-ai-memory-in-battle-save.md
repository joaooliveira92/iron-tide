# Decision Request: division AI memory in the mid-battle save

## Status

Decided by the coordinator ruling on #961 (not a hard stop): implemented as Option A below, without a compat bump. Reversible: the sidecar field is optional and the session field is dormant.

## Trigger

#961 asks that `DivisionAiMemory` (`division_ai_memory_v1`, hash domain `bluewave.division_ai_memory.v1`) be carried in saved battle state, so a mid-battle save keeps support sides, attacking latches and patrol anchors (#329 point 2). It changes the mid-battle save format, so it needs a decision, a compatibility bump and a save-corpus fixture.

## Evidence

- A mid-battle save is the `player-battle.json` sidecar (`apps/desktop/src/main/playerBattleSidecar.ts`): `{ schemaVersion, turnId, battleId, steps }`. Resume rebuilds the session from the projection and replays the steps (`replaySteps` in `commands/playerBattleSession.ts`). There is no state snapshot.
- `decideDivisionOrders` is dormant (`combat-terrain` in `scripts/data/reachability-ledger.json`, `RULES.md#dormant-by-decision`). Nothing in the step pipeline projects tactical state into a `DivisionAiView`, so a replay cannot derive the memory.
- `DivisionAiMemory` already has a strict decoder and a canonical, domain-hashed serialisation (`packages/combat/src/division-ai/memory.ts`).
- Contract: pin AI policy versions; canonical artifact changes need old and new hashes, cause, version impact and a migration assessment (`.ai/ENGINEERING-CONTRACT.md`, BW-PER-001).
- Precedent for the bump: d34eee69 (compat 5.4.0) moved `CURRENT_COMPATIBILITY_VERSION`, `apps/desktop/package.json`, the pinned literals in persistence tests and added `save-corpus/5.4.0/`.

## Why agent judgment is insufficient

The format decides whether a stale or edited memory can silently steer a resumed battle, and whether older saves are refused or defaulted. The coordinator ruled the work is not a hard stop and asked for the cleaner, reversible design.

## Options

### Option A: checkpoint in the sidecar, restored after replay (chosen)

- Behavior: `PlayerBattleSession` gains an optional `divisionAi: { memory }`, absent unless an AI stage supplies it, and folded into `playerBattleSessionHash` only when present. The sidecar moves to `schemaVersion` `1.1.0` with `divisionAi: { minute, memoryHash, memory } | null`. On resume the steps replay first; then the checkpoint is verified (memory decodes strictly, its hash equals `memoryHash`, `minute` equals the replayed session minute) and restored into the session. Any failure takes the existing `resume-failed` path and clears the sidecar.
- Advantages: works today with the AI dormant; pins the memory version and hash; a stale, truncated or edited checkpoint is refused rather than followed; when an AI stage later runs inside the step pipeline, the same checkpoint becomes a verify-after-replay assertion without a format change.
- Risks: two sources of truth until the AI stage is wired (guarded by the minute and hash checks).
- Compatibility impact: none. `CURRENT_COMPATIBILITY_VERSION` stays 5.4.0 (see Dropped compat bump below).
- Migration impact: a `1.0.0` sidecar decodes through the same schema (the `1.0.0` literal admits no `divisionAi` field) to `divisionAi: null`. No existing save can hold non-default memory because the AI never ran in production, so the default is exact, not lossy. An absent checkpoint leaves the session without `divisionAi`, so every existing hash and replay is unchanged.
- Scope and effort: small; combat helpers, one sidecar schema, plumbing in start and step.

### Option B: persist nothing, rely on replay

- Behavior: the memory would be re-derived by replaying steps.
- Advantages: no format change.
- Risks: impossible today (the AI is not in the step pipeline); once wired, any change to AI logic silently diverges old saves, and no AI version is pinned.
- Compatibility impact: none now, hidden later.
- Migration impact: none.
- Scope and effort: none, but does not satisfy #961.

### Option C: replace the replay log with a full state snapshot

- Behavior: save the whole `PlayerBattleSession`, including memory.
- Advantages: no replay cost.
- Risks: a new frozen authoritative format for every battle subsystem, far beyond #961; conflicts with the replay design of the save.
- Compatibility impact: large; every session type becomes a save contract.
- Migration impact: all in-flight battles.
- Scope and effort: a deferred subsystem.

### Option D: memory as a field on every step

- Behavior: each step records the memory after it.
- Advantages: replay-local.
- Risks: size grows with steps, and memory is not an order the player issued, so it blurs the step wire schema shared with the renderer.
- Compatibility impact: step schema change.
- Migration impact: older steps lack memory.
- Scope and effort: medium, worse shape.

## Recommendation

Option A. Wiring `decideDivisionOrders` into the player battle step pipeline is a separate gameplay change and stays out of this work.

## Work safely completed while blocked

Nothing was blocked. Implemented in this change: session field and checkpoint helpers, sidecar `1.1.0`, resume verification, a frozen `1.0.0` sidecar fixture, tests at combat and desktop level.

## Dropped compat bump

The coordinator dropped the 5.4.0 to 5.5.0 campaign compatibility bump. The sidecar is self-versioned (`player-battle.json` 1.0.0 to 1.1.0, old files default to `null`) and the session hash binds memory only when present, so the bump only refused every existing 5.4.0 save and moved 17 golden replays. It was reverted with `git revert` (no history rewrite).

To reinstate: revert the revert commit (the one titled `Revert "feat(persistence): move save compatibility to 5.5.0 ..."`). That restores `CURRENT_COMPATIBILITY_VERSION` 5.5.0, the desktop package version, the pinned test literals and the `save-corpus/5.5.0/` fixture. Then re-record the 17 golden replays as their own commit, mirroring c8f52a06 (`pnpm replay:record`, then `pnpm replay:approve` with class `EXPECTED_GAMEPLAY_CHANGE`), and confirm `pnpm check:replay-corpus` and `pnpm check:replay-approvals` pass.
