# ADR-0238: Golden re-pin guard at commit time

## Status

Accepted (2026-10-19).

Extends: ADR-0007 and ADR-0136. The predicate and its exemptions are unchanged.

## Context

`scripts/verify-golden-repin.mjs` fails a commit that edits authoritative source
without updating `golden/hashes.json` or carrying `Golden-Repin: not-needed`.
It runs only in `pnpm check`, after the commit exists. A commit that misses the
trailer is then already in history, and history cannot be rewritten once pushed,
so the only remedy is to advance `scripts/golden-repin.baseline`. That has
happened repeatedly, most recently past 341ce675.

## Decision

- The `commit-msg` hook also runs `scripts/check-golden-repin-staged.mjs`. It
  applies the existing `commitNeedsRepin` predicate to the staged paths and the
  message being written, and refuses the commit with the two remedies.
- It adds no path exemptions and does not change `REFERENCE_RUN_EXEMPTIONS`. An
  exemption still needs its own evidence under ADR-0136.
- Merge, revert, `fixup!` and `squash!` commits are skipped, as in
  `check-commit-msgs.cjs`.
- `pnpm check` keeps the range guard as the backstop for `--no-verify` and for
  commits made outside the hook.

## Consequences

- A missing trailer is caught while the commit is still local and amendable, so
  the baseline stops needing to move for it.
- An amend that changes only the message sees no staged paths and passes; the
  range guard still covers it.
- Moving the baseline stays the documented fallback for commits already in
  shared history.
