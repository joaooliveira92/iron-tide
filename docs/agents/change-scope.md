# Change scope

`scripts/change-scope.mjs` prints a versioned, machine-readable report of the
paths a change touches between a base ref and a head ref — committed paths plus
staged, unstaged, and untracked worktree paths. It exists so change-based
filtering (for example a CI job choosing which suites to run) reads one
deterministic source instead of ad-hoc `git diff` parsing.

```sh
pnpm change-scope --base origin/dev          # head defaults to HEAD
pnpm change-scope --base origin/dev --head <ref>
```

The report is JSON with a `formatVersion`, the resolved base/head refs, and the
explicit path lists per scope. Comparing committed scope against worktree scope
lets a gate decide what a change actually affects without inspecting diffs
itself.

It is documented here because it is a script other tooling depends on; see
`scripts/README.md` for the full script catalogue and `AGENTS.md` for when to
reach for it.
