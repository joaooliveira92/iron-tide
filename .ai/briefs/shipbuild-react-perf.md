# Task brief: shipbuilding workspace stops re-running model builders on every keystroke

```yaml
task:
  id: "#463"
  objective: "Typing in the ship class-name field re-runs zero model builders; barrel imports no longer drag the whole design-workspace graph into the workspace chunk; snap idle-mutations/s does not regress."
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "feat/shipbuild-react-perf"
  worktree: ".worktrees/shipbuild-perf"
  machine: "joao local (darwin, Qoder Desktop)"
  thread: "Qoder Desktop session, 2026-11-01"
  model: "Qoder agent, frontend-design + vercel-react-best-practices calibration"
  risk: "low"
  pull_request: null
  pr_authorized: false
  merge_authorized: false
  validation:
    - "pnpm verify:affected"
    - "pnpm preflight"
    - "pnpm test:scripts"
    - "pnpm check"
```

## Problem

`apps/desktop/src/renderer/screens/shipbuilding/ShipbuildingWorkspace.tsx` recomputes
seven view models (`aluminiumModel`, `antiAircraftModel`, `overviewModel`,
`machineryModel`, `protectionModel`, `armamentEntries`, `systemsModel`) on every
render, so a single keystroke in the class-name input re-runs all seven builders.
Around 50 symbols arrive through the `design-workspace/index.js` and
`components/index.js` barrels, blocking code-splitting; the selection-store
subscription is re-created on every `draft`/`content` change and mirrored into
`useState`; `ArmamentEditor` filters the whole gun catalogue each render and
computes `nextId` with an O(n²) scan.

## Evidence

- Issue #463 (rank 5, 291 file-touches over 4 months), audited against
  `vercel-react-best-practices`.
- Locations: `ShipbuildingWorkspace.tsx:289-291,395,428,445,466,487,490` (builders),
  `:7-49,50-91` + `components/CommandBar.tsx:24` (barrels), `:306-322` (store sync),
  `components/ArmamentEditor.tsx:162-165,80`.
- Baseline `pnpm snap` idle-mutations/s line captured before the change.

## Constraints and non-goals

- Renderer stays presentational: no `effect` runtime, no parsing (desktop AGENTS.md).
- No behavior, layout, or gameplay change — pure render/perf refactor.
- Do not touch `components/design-workspace/` beyond what de-barreling requires;
  the rank-1 design-workspace slice is a separate task.
- No comments in code; names and tests carry intent.

## Acceptance criteria

- A regression test counts builder invocations: typing in the class-name field
  does not re-run the seven builders (fails before, passes after).
- No imports from `design-workspace/index.js` or `shipbuilding/components/index.js`
  remain in the two touched files; `pnpm check` and the renderer bundle gate pass.
- Selection sync uses `useSyncExternalStore` (or refs) with no resubscribe churn.
- `pnpm snap` on the ship-design screen renders identically; idle mutations/s
  reported before/after.

## Approach

`agent decides` — memoize with `useMemo` keyed on real inputs, direct module
imports, `useSyncExternalStore` for the selection store, memoized candidates and
index-based `nextId` in `ArmamentEditor`.

## Required tests

- Builder-invocation regression test (red first).
- Existing shipbuilding suites stay green (design session, view transformers, a11y audit).

## Expected artifacts

- `.ai/reports/` note with before/after snap idle-mutations lines and screenshots.

## Delivery authority

- Pull request: `do not open`.
- Merge: `not authorized` — set `ready-for-review`; human merges.

## Blockers that need a human

Permanent stop conditions in AGENTS.md; plus: if memoizing a builder changes
rendered output (implies hidden input dependence), stop and report rather than
papering over with a wider key.

## Downstream work

Rank-1 design-workspace slice pairs with this task (same feature area, other folders).

## Cleanup

`pnpm worktrees status shipbuild-perf merged` after the human merges; prune the worktree.
