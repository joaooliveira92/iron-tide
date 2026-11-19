# Replay rebase

Replay files are derived, so never resolve a conflict in `golden/` by hand. Rebase or merge `dev` and, when `golden/` conflicts, run `pnpm replay:rebase [--base origin/dev]`. It:

1. takes the base side of every conflicted file under `golden/`;
2. re-records each replay that differs from the base, or conflicted, on the merged tree (`pnpm replay:record <id>`);
3. deletes the approval files this branch added and regenerates one with `pnpm replay:approve` against the base;
4. stages `golden/`, builds, and runs `pnpm check:replay-approvals`, returning its status.

The cause, migration and class come from the removed approval files. Pass `--cause`, `--migration` and `--class` when the branch had none or they differ; with several different causes the helper stops and asks for the flags. It never edits `legacy.json` or a base approval file, so append-only holds. Afterwards run `pnpm check:replay-corpus`, then `git rebase --continue`.

## Known limit: static catalogue in hashes

`world.technologies` is static content, yet every snapshot hash covers it: replay checkpoints, the command lifecycle staleness check and the command ledger outcomes. Adding a technology therefore moves every checkpoint of every replay, and a checkpoint-only change would still move the five replays that record commands (evidence and design in #993). Until that lands, a technology-only change re-records the replays and approves the moved hashes, which is what `replay:rebase` automates.

## Format migrations

The 17 replays were re-recorded from v2 to v3 with every checkpoint unchanged (only `formatVersion` and the removed `contentHash` differ), so that bump needed no approval. A later version bump is re-recorded the same way, and the commit states the parsed-content diff against the previous files.
