# Replay corpus

Replay files in `golden/replays/` are the determinism baseline (ADR-0246). They are not re-pinned:
the `Golden-Repin` trailer and the ratchet baseline do not apply to them
(see [golden repinning](golden-repinning.md)).

## Approvals

`golden/replay-approvals.json` holds entries bound to the exact old and new checkpoint hashes of one
replay and month. After `pnpm replay:record <id>`, run `pnpm replay:approve --cause "<why>" --migration
"<assessment>"` to propose entries from the diff against `origin/dev` (`--base <ref>`).
`pnpm check:replay-approvals` fails an unapproved, mismatched, orphaned, reused or rewritten
entry. CI only verifies; entries are append-only.

## Verifying and extending

`pnpm check:replay-corpus` (in `pnpm check` and on three OSes in `determinism.yml`) verifies replays twice and via save/load, printing divergence.

New scenarios go in `scenarios.ts` with a one-line `purpose`; a new replay file is an addition and needs no approval. `pnpm replay:coverage` lists the subsystems each replay exercises and those none do.

Fuzz cases (`FUZZ_CASES`, pinned in `golden/replay-fuzz.json`) run in the test suite on three OSes. A failure prints its seed; reproduce with `pnpm replay:fuzz run <seed> <months>`. Only `pnpm replay:fuzz record` (local, refused under CI) rewrites the pin. That pin sits outside `golden/replays/`, so approvals do not cover it.

## Retiring a legacy probe

A probe pinned in `golden/hashes.json` may be retired once a corpus mutation test catches the same
class of break. `golden/probe-retirement.json` classifies every pinned probe: it either cites the
mutation test (file and exact title) in `replay-corpus.test.ts`, or states why none exists. Run
`pnpm check:probe-retirement`: it fails on an unclassified probe or a cited test that does not exist,
and lists the retire-eligible probes. It never removes anything; retiring a probe is a separate,
reviewed change that updates the register, the guards that read the probe, and this doc.
The golden file itself stays until every probe is retired.
