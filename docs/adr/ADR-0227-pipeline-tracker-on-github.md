# ADR-0227: Pipeline issues live on GitHub, not local markdown

Applies to: repository

Rule: Pipeline artifacts (map, spec, tickets) are GitHub issues; there is no local markdown tracker.

## Status

Accepted (2026-10-17). Supersedes the tracking model recorded in
`.ai/reports/reconciliation-2026-10-17.md`.

## Context

The engineering pipeline (wayfinder maps and decision tickets, the `to-spec` spec,
and the `to-tickets` implementation tickets) stored its artifacts as tracked
markdown under `.scratch/<slug>/`, with `.ai/specs/` as a per-effort pointer index.
GitHub Issues was reserved for externally reported issues; the 2026-10-17
reconciliation recorded that completed internal artifacts are **not** mirrored into
GitHub Issues.

The owner directs that issues and features be tracked on GitHub, not local
markdown, so the pipeline and the external tracker share one store.

## Decision

GitHub Issues (`joaooliveira92/iron-tide`) is the single tracker for both external
reports and pipeline artifacts:

- The **map** is one issue labelled `wayfinder:map`; its **decision tickets** are
  child issues labelled `wayfinder:<type>`.
- The **spec** is one issue labelled `ready-for-agent`; its body is the spec.
- **Implementation tickets** are sub-issues of the spec issue, carrying the
  `ready-for-agent` label and native GitHub blocking dependencies.

`docs/agents/issue-tracker.md` is the operational authority. `.ai/specs/` is
retired and its pointers removed. `.scratch/` is **frozen**: existing efforts stay
tracked as historical provenance, no new effort writes there, and nothing is
mirrored into GitHub. Worktree `Scope` metadata names the effort slug, not a
`.scratch/<slug>` directory.

## Consequences

- The frontier is a GitHub query (open, unblocked, unassigned issues), not a
  directory scan. This needs `gh` 2.94+ for sub-issues and native dependencies
  (the repo has 2.101).
- `.opencode/agents/*` and `.opencode/command/{boot,work,worktrees}.md` read and
  publish through `gh`; the pipeline no longer depends on `.scratch/`.
- The "not mirrored" tracking model of `.ai/reports/reconciliation-2026-10-17.md`
  is superseded; `.ai/AUTHORITY-INDEX.md` records the current model.
- No change to authoritative gameplay, determinism, saves, or wire formats.
