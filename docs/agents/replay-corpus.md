# Replay corpus

Replay files in `golden/replays/` are the determinism baseline, the only committed golden. A change
that moves an authoritative outcome re-records the affected replays and is approved below, stating the
old value, the new value, the cause and a migration assessment. A hash that moves without an understood
authoritative cause is a stop condition (see `AGENTS.md`).

## Approvals

`golden/replay-approvals.json` holds entries bound to the exact old and new checkpoint hashes of one
replay and month. After `pnpm replay:record <id>`, run `pnpm replay:approve --cause "<why>" --migration
"<assessment>" --class <class>` to propose entries from the diff against `origin/dev` (`--base <ref>`);
the class is `EXPECTED_GAMEPLAY_CHANGE`, `SERIALIZATION_ONLY` or `RULESET_VERSION_CHANGE`.
`pnpm check:replay-approvals` fails an unapproved, mismatched, orphaned, reused, rewritten or misclassed
entry. CI only verifies; entries are append-only relative to the gate base. A `dev` to `main` PR runs
`check-chain --main <ref> --head <ref>`: per first-parent hop.

## Verifying and extending

`pnpm check:replay-corpus` (in `pnpm check`; three OSes in `determinism.yml`) verifies replays twice and via save/load.

New scenarios go in `scenarios.ts` with a one-line `purpose`; a new replay file needs no approval. `pnpm replay:coverage` lists the subsystems each replay exercises, and those none do.

Fuzz cases (`FUZZ_CASES`, pinned in `golden/replay-fuzz.json`) run on three OSes; reproduce a failure with `pnpm replay:fuzz run <seed> <months>`. Only `pnpm replay:fuzz record` (local, refused under CI) rewrites the pin; approvals do not cover it. Generated plans: ADR-0280.