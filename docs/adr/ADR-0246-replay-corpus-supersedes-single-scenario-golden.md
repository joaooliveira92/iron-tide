# ADR-0246: A replay corpus supersedes the single-scenario golden as the determinism baseline

Applies to: cross-process-test

## Status

Accepted (2026-10-20). Delivers ticket [#208](https://github.com/joaooliveira92/iron-tide/issues/208)
of spec [#207](https://github.com/joaooliveira92/iron-tide/issues/207). Builds on ADR-0007 and
ADR-0136 and does not amend them: the golden stays as a smoke test (decision 7).

## Context

`golden/hashes.json` pins ten hashes from one synthetic month. It tells a maintainer that something moved,
not where. Much of the authoritative surface is exempted from the re-pin guard because the reference run
never exercises it, and the re-pin report (old value, new value, cause, migration assessment) is enforced
by convention. Spec #207 replaces it with recorded replays that localise a divergence and an approval
path that is checked against the actual diff.

Two feasibility questions gated that design. Both were answered against `dev` at `cc3a0c6`.

### Finding A: phase boundaries are explicit, so per-phase checkpoints are cheap but not free

`MonthExecutor.execute` runs a fixed, ordered list of phases (opening validation, weather, revenue,
command collection, AI planning and procurement, appropriation, maintenance, obligation, construction,
diplomacy, research, aircraft, carrier operations, an interruption checkpoint, battle generation, battle
resolution, closing validation). Each is gated by one choke point (`assertPhase`) and mutates
`ctx.currentSnapshot`. All four ledgers (command, event, random, financial) expose `all` and `hash()`.
Nothing observes a phase boundary today, so a per-phase checkpoint needs a small additive, optional
observer in the executor. Month granularity needs no engine change, and ledger entries are already
individually addressable through `all`.

A month can also end `suspended` (an interruption), and `engineOptions` (ship-building content, phase
overrides, climate profiles, interruptions) change the result. `ReplayVerifier` already states that replay
must use the same `engineOptions`. A replay file therefore has to record them.

### Finding B: the production pack compiles deterministically, with file reads only at the compile boundary

`production-pack.ts` already compiles the committed 1880 pack through `buildFullSurfaceInput`,
`buildContentBundleArtifact` and `CampaignCompiler`, in the cross-process tests. The compile reads files
from disk, but that is the content compiler's permitted IO boundary, and its output carries a body hash.
Nothing about it needs ambient time, randomness or environment. The run-child's 12 and 120 month
production runs show how to advance production state with the per-month seed the desktop derives
(`<seed>:month:<turnNumber>`).

### Finding C: the existing snapshot hash is a subset

`snapshotToHashable` (phase-engine, mirrored by a second copy in the cross-process child) omits
`designs`, `designFamilies`, `prestigeRules` and `playerNationId`. Those fields are authoritative. A change
to them moves a hash only if it leaks into a hashed field. A corpus that reused this hash would inherit the
blind spot, and the duplicate copy is a drift risk.

## Decision

1. **The determinism baseline becomes a replay corpus**: versioned replay files recorded from the
   production pack, each verified by re-executing through the real engine. This is the single new seam;
   the record and verify interface is described in spec #207.
2. **Granularity.** v1 checkpoints per month, each carrying for the command, event, random and financial
   ledgers the entry count and a hash per entry, so a divergence names month, ledger and entry. Per-phase
   checkpoints are deferred to a follow-up that adds an optional executor observer; they are not needed to
   localise below the month.
3. **The replay file is self-describing.** It records a format version, the ruleset and compatibility
   versions, the seed, the content bundle hash (not the bundle), the initial snapshot or the recipe that
   derives it from the production pack, the ordered command envelopes, the `engineOptions` used, any
   recorded interruption inputs, and the per-month checkpoints. It is canonically serialised and decoded
   with a strict schema that rejects unknown format versions and excess properties.
4. **Checkpoints use a full-state hash, not the subset.** The corpus hashes the canonically serialised
   whole snapshot, including `designs`, `designFamilies`, `prestigeRules` and `playerNationId`. The
   existing subset hash is unchanged, so the golden does not move. Adopting the full hash for the golden
   is out of scope. The duplicate hashable copy in the cross-process child is noted for consolidation.
5. **Intentional change is an approval, not a re-pin.** An approval entry is bound to the exact old and new
   checkpoint hashes of one replay and month, and states cause and migration assessment. A local tool
   proposes it from the real diff; a guard in CI rejects an unmatched delta and any stale, orphaned or
   reused approval. CI never writes approvals. The existing ship-part approved-diffs gate is the prior art
   to reuse.
6. **Cross-OS and repeatability.** The corpus is verified on Linux, Windows and macOS, and a two-process
   repeatability check runs alongside it, so flakiness is separated from a behaviour change.
7. **The golden is retained as a smoke test.** A legacy probe is retired only after a mutation check shows
   the corpus catches the same class of break. That retirement is a later ticket.
8. **Compatibility.** Replay files carry the compatibility version. A version bump that changes
   authoritative output is an approval event for every affected replay, recorded in the approval entry.
   Replays that stay valid against retired rulesets are deferred.

9. **Retirement is a checkable criterion (ticket #217).** `golden/probe-retirement.json` classifies every
   probe pinned in `golden/hashes.json`: it cites the corpus mutation test (file and exact title) that
   catches the same class of break, or states why none does. `pnpm check:probe-retirement` fails on an
   unclassified probe or a cited test that does not exist, and reports retire-eligible probes. No probe is
   removed by this decision; each retirement is its own reviewed change. Corpus replays never use the
   `Golden-Repin` trailer or the ratchet baseline; approvals are the only path (decision 5). Fuzz digests in
   `golden/replay-fuzz.json` sit outside `golden/replays/` and are not covered by approvals (follow-up).

## Consequences

- A determinism failure points at a month, ledger and entry instead of an opaque hash.
- The `Golden-Repin` trailer and the ratchet baseline stop being the control for corpus replays; the
  approval guard replaces them, and the golden-repinning doc is updated in the cutover ticket.
- Checkpoint hashing of the whole snapshot is larger and slower than the subset hash; corpus size is kept
  bounded by scenario count and month count.
- The corpus is only as strong as its scenarios; a coverage report (ticket #215) makes gaps visible.

## Alternatives considered

- **Keep the single golden and add more hashes.** Rejected: more opaque hashes do not localise a failure or
  enforce the re-pin report.
- **Per-phase checkpoints in v1.** Deferred: it needs an executor change and ledger entry hashes already
  localise below the month.
- **Embed the compiled bundle in each replay.** Rejected: it duplicates content and bloats the repository;
  the bundle hash plus the committed pack identifies it.
- **Reuse the subset snapshot hash.** Rejected for the corpus (Finding C).

## Amendment: format version 2 records command envelopes (ticket #248)

Version 1 wrote an empty `commands` array and executed no commands, so the corpus covered unattended months
only and its files could not be handed to `ReplayVerifier`. Decision 3 is now met by format version 2.

- Each month carries the ordered command envelopes executed in it, refused ones included, and verification
  re-executes the recorded envelopes through the real command lifecycle. A dropped or altered envelope
  diverges in the command ledger or at the snapshot of its month.
- Envelopes are decoded with the same strict rules as the rest of the file: excess properties are rejected and
  the body is a closed union (`SetBudgetAllocation`, `SetResearchPriority`, `OrderConstruction`,
  `SetShipReadiness`, `AssignForeignStation`, `ClearForeignStation`). A new command kind is added to the union
  deliberately; an unknown body is a decode failure, not a skipped command.
- A scenario carries a deterministic `commands` plan (month plus body). The recorder builds each envelope
  against that month's starting snapshot, so a replay is self-contained. Live capture from a desktop session
  stays out of scope.
- The decoder reads versions 1 and 2; a version 1 file with commands is refused. The recorder writes version 2.
  Re-recording a version 1 replay moves only `formatVersion`, so every checkpoint hash is unchanged and no
  approval is needed. Fuzz digests are unchanged because fuzz checkpoints still hash an empty `commands` array.
- A recorded month can be fed to `ReplayVerifier` by replaying the earlier months' envelopes to rebuild the
  month's starting snapshot, then passing that snapshot, the month's envelopes and the month seed.
- `production-1880-6m-fleet-commands` is the first replay that issues commands. It covers
  `command_collection` and the readiness and station commands, including two refusals.

