# Task brief: compose the overview report views from parts and a provider

```yaml
task:
  id: "#494"
  objective: "screens/overview renders turn and month reports through one provider and a compound Summary, with no component over ~300 lines and no boolean display modes."
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "refactor/composition-overview"
  worktree: ".worktrees/composition-overview"
  machine: "joao-local-arm64"
  thread: "qoder desktop session fe2b1729"
  model: "Qoder Desktop agent"
  risk: "low"
  pull_request: null
  pr_authorized: true
  merge_authorized: false
  validation:
    - "pnpm verify:affected"
    - "pnpm preflight"
    - "pnpm test:scripts"
    - "pnpm check"
```

## Problem

The overview screen's report views are monolithic. `TurnSummaryPanel` interleaves a turn
history switcher, a four-control filter bar, category grouping, message rows and an entity
historical record in one 364-line component, and threads pin, read, open-entity and
availability callbacks through two layers into every row. `NarrativeMonthSummary` mixes
roughly 250 lines of prose generation with the React component in a 335-line file. The three
cards choose their chrome from an `embedded` boolean, and `MonthReportCard` also switches
body content on it.

## Evidence

- Issue #494, rank 4 of 14 in #490.
- `TurnSummaryPanel.tsx` 364 lines, `NarrativeMonthSummary.tsx` 335 lines, both over the ~300 cap.
- `TurnSummaryPanel.tsx:349-350` builds row props with conditional spreads for optional callbacks.
- `MonthReportCard.tsx:38` branches rendered content on `embedded`; `CardShell` has exactly three consumers, all overview cards.
- Precedent: #505 and #506 landed providers with state/actions/meta and variant unions in the same effort.

## Constraints and non-goals

Renderer only, behaviour-preserving. No engine, content, IPC, or schema change. No code
comments. Tests stay green; new tests on `vite-plus/test`. No folders owned by another #490
sub-issue, except the single approved caller edit in `shell/header/secondary-row/PriorityBriefing.tsx`.
Not in scope: the modal guide conversion of the header popovers, the `useOverviewModel`
screen provider, `globe-adapter`, `world-map`, and any resize of the map surface.

## Acceptance criteria

- A per-component audit note in the PR naming the rules applied or skipped, with the reason.
- No new boolean-prop modes; `embedded` replaced by an explicit variant union.
- Turn summary selection, filters and message actions live behind one provider exposing state/actions/meta, read by the parts instead of received as props.
- No component over ~300 lines left in scope without a stated reason.
- A compound `Summary` with `Section`, `Row` and `Delta` parts, with explicit variants for the turn and narrative views rather than mode branching.
- Folder tests pass; `pnpm snap` shows no visual regression on the overview screen and both header report chips.
- `pnpm preflight` and `pnpm check` green on the final commit.

## Approach

`agent decides`. Clear the 300-line cap first with pure moves, then introduce the provider and
compound parts, then swap the boolean modes for variants. Keep every `data-testid`, accessible
name and DOM class so the snap comparison stays byte-level.

## Required tests

No bug regression tests: this is behaviour-preserving. Existing `TurnSummaryPanel`,
`NarrativeMonthSummary`, `MonthReportCard`, `embedded-cards`, `nation-rail-*` and
`PrioritiesCard` tests must pass unchanged in what they assert. New tests: provider state and
actions through the composed parts, and the compound `Summary` variants.

## Expected artifacts

Before and after `pnpm snap` captures in `.dev-data/view/overview-494/`, attached to the PR.

## Delivery authority

- Pull request: may open after local gates pass.
- Merge: not authorized.

## Blockers that need a human

- A snap diff that cannot be explained as a capture-timing artefact.
- A part boundary that would require changing a wire schema or the IPC contract.
- Any engine, content or persistence file appearing in the affected set.

## Downstream work

Audit note and follow-ups: the `#496` shell folder now depends on the card variant union, so
its refactor should reuse it rather than reintroduce a boolean.

## Cleanup

`pnpm worktrees status composition-overview ready-for-review`, then prune once merged.
