# R-20: Determinism & re-execution parity audit

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

Does re-executing the month from the authoritative pre-turn snapshot reproduce a
bit-identical result across **all 17 phases** — including battle
generation/resolution, AI planning, research, weather, and diplomacy — when the
same committed orders and recorded external inputs are supplied? Are there any
ambient nondeterminism sources (wall clock, `Math.random`, `process.env`,
filesystem order, mutable globals) in the phase bodies, or any phase whose
outcome would change if it were recomputed after an earlier interruption?

Specifically verify:

- `MonthExecutor.execute` (`packages/phase-engine/src/month.ts`) and every phase
  module's use of `phaseGuard.rng(...)`, `randomSeed`, and `nextSeq`.
- The desktop's player-slot promotion/restore (`commitMonth.ts`) and whether a
  suspended-then-resumed run reproduces it.
- `random`'s `RandomStream` is reset per re-execution (stateless vs stateful) and
  the `RandomLedger` is deterministic.
- Battle auto-resolution determinism (`@bluewave/combat`) and how an imported
  external `BattleResult` would need to bypass re-rolling (feeds D-05/D-12).

## Answer

**Resolved — D-05's re-execution assumption holds (same host, same content, same
seed/commands): bit-identical across all 17 phases.**

- Every authoritative draw is keyed: `RandomEngine`/`RandomStream` are constructed
  **fresh inside each `execute`** (`phase-guard.ts:217-220`, `month.ts:169/185`,
  `research.ts:161`, `weather`/`battle` paths); `nextSeq` restarts at 0 per call
  (`month.ts:60,84-88`); `randomSeed` is read-only (`month.ts:49,74`); phases are
  pure functions of `(snapshot, commands, seed)`. `RandomStreamImpl` is stateful
  but its counter resets per run because the engine is rebuilt (`engine.ts:13-26`).
- No `Math.random`, `Date.now`, `process.env`, `performance.now`, `crypto.*`, or
  fs reads in `phase-engine`/`combat` authoritative paths.
- Player-slot promotion is a pure function of `(slots, playerSlotId)`; the queue is
  cleared only after success, so a suspended/retried run recomputes identically
  (`commitMonth.ts:119-123,172-176`; `pendingCommands.ts:182-188`).
- **External battle result:** confirmed there is **no injection seam today** —
  `generateBattles` always regenerates from scratch for active wars
  (`pipeline.ts:155-162`; `battlePhases.ts:34-37,98-124`). This is exactly what the
  M2 additive seam must add; it does **not** contradict D-05.

**Flagged risk (pre-existing, cross-host only — not a locked-decision
contradiction):** several `@bluewave/combat` orderings call
`String.prototype.localeCompare` (host/ICU collation), e.g.
`generation/opportunity.ts:114-117`, `generation/eligibility.ts:83-92`,
`generation/optional.ts:41`, `generation/manifest.ts:82`,
`damage/ordering.ts:26-30`, `aircraft/inventory-allocation.ts:44`,
`submarines/submarineRecords.ts:37-77`. This violates the repo rule in
`deterministic/src/index.ts:12-20` ("never `localeCompare`") and could diverge
across OS/ICU builds. It does **not** break same-host resume. **Recommendation:**
file a separate, out-of-effort remediation ticket to replace these with
`compareCodePoints`; do not reopen this charter.
