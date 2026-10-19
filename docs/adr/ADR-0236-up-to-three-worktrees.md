# ADR-0236: Up to three concurrent worktrees

## Status

Accepted (2026-10-19).

Amends: ADR-0234. Amended by: ADR-0237 (cap raised to five). The single-checkout rule is relaxed to a small, capped number
of worktrees; ADR-0234's local-merge delivery is unchanged.

## Context

ADR-0234 banned worktrees after they multiplied to seventeen. A hard ban is
stricter than the problem needs: the failure was an unbounded count, not the
existence of a second checkout. Two or three parallel efforts are manageable
and avoid stash-and-switch churn.

## Decision

- At most three worktrees may exist at once, counting the main checkout. That
  is the main checkout plus up to two extra worktrees under `.worktrees/<slug>`.
- Create them with `pnpm worktrees new <slug>`, which refuses to exceed the cap.
  `pnpm worktrees` and `.ai/WORKTREES.md` are back in the workflow.
- Each worktree is on its own short-lived branch cut from `dev`; two sessions
  never share one checkout.
- Delivery is unchanged: merge the branch into `dev` locally after
  `pnpm preflight`, `pnpm test:scripts` and `pnpm check` are green.
- Remove a worktree (`pnpm worktrees:prune`) once its branch is merged.

## Consequences

- Up to three efforts can run in parallel; the running app must still be
  started from the checkout that holds the merged code (`dev`).
- The cap bounds the stale-subtree problem that motivated ADR-0234.
