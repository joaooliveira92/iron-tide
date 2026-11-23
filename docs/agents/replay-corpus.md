# Replay corpus

Replay files in `golden/replays/` are the determinism baseline. A change that moves an authoritative
outcome re-records the affected replays and is approved below. A hash that moves without an understood
authoritative cause is a stop condition (see `AGENTS.md`).

## Approvals

`golden/replay-approvals/` holds one file per change; `legacy.json` (pre-split entries) is never edited. Entries are bound to the exact old and new checkpoint
hashes of one replay and month, with a cause and a migration assessment. After `pnpm replay:record <id>`, run `pnpm replay:approve --cause "<why>"
--migration "<assessment>" --class <class>` to write a new file from the diff against `origin/dev`
(`--base <ref>`); the class is `EXPECTED_GAMEPLAY_CHANGE`, `SERIALIZATION_ONLY` or
`RULESET_VERSION_CHANGE`. `pnpm check:replay-approvals` fails an unapproved, mismatched, orphaned,
reused, rewritten or misclassed entry. Entries are append-only relative to the gate base. A `dev` to `main` PR runs `check-chain --main <ref> --head <ref>`: per first-parent hop.

## Rebasing

Never hand-resolve `golden/`: run `pnpm replay:rebase` ([guide](replay-rebase.md), with the catalogue-hash limit #993).

## File format

Replay files are format version 3: one top-level key per line and one month per line. A v3 file records no content hash: a content edit fails at the first month it moves. Content integrity is `pnpm content:verify`. Versions 1 and 2 still decode. `battleOffers: true` on a player scenario records each month's delegated offers as optional `offerAnswers`; not with `engineDigests`.

## Verifying and extending

`pnpm check:replay-corpus` (in `pnpm check`; three OSes in `determinism.yml`) verifies replays twice and via save/load.

New scenarios go in `scenarios.ts` with a one-line `purpose`; a new replay needs no approval. `pnpm replay:coverage` lists uncovered subsystems.

Fuzz cases (`FUZZ_CASES`, pinned in `golden/replay-fuzz.json`) run on three OSes; reproduce a failure with `pnpm replay:fuzz run <seed> <months>`. Only `pnpm replay:fuzz record` (local, refused under CI) rewrites the pin; approvals do not cover it. Generated plans: ADR-0280.