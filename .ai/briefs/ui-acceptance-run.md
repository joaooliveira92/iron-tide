# Task brief: UI-driven acceptance run for every reachable capability

```yaml
task:
  id: "#227"
  objective: "A Playwright run drives every ledger row marked reachable through the UI only, and a report quotes the counts and hash agreement"
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "feat/ui-acceptance-run"
  risk: "low"
  pull_request: null
  pr_authorized: false
  merge_authorized: false
  validation:
    - "pnpm verify:affected"
    - "pnpm test:e2e"
    - "pnpm check:reachability-ledger"
    - "pnpm preflight"
    - "pnpm check"
```

## Problem

The ledger says 35 capabilities are reachable, each with a unit or component test. No single run proves a player gets
to all of them from a fresh campaign. `apps/desktop/e2e` covers part of the set, and the rest is unproven end to end.

## Evidence

- `docs/reachability-report.md`: 35 reachable, 11 dormant-by-decision, 14 internal, 0 unclassified.
- `apps/desktop/e2e` specs: `mvp-loop`, `construction`, `continuance`, `strategic-map`, `ship-types`, `status-strip`.
  Judged from spec titles, not yet from a coverage run. Stage 0 confirms it.
- The only battle e2e is `campaign-battle-drill.debug.spec.ts`, which needs the debug build.

## Constraints and non-goals

- UI only: no bridge calls from the test, no debug flag, no fixture world.
- No new engine mechanics and no change to authoritative hashes.
- Dormant and internal rows are out of scope. Hotkeys have their own tests.

## Acceptance criteria

- Every `reachable` row maps to at least one e2e step, listed in a table in the report.
- A new check fails when a `reachable` row has no e2e mapping.
- The run is green twice, in two processes, and the UI-run hash equals an engine-only run from the same seed.
- `.ai/reports/ui-reachability.md` quotes the final ledger counts and the hash evidence.
- The #220 acceptance bullets are checked off.

## Approach

`agent decides`, in stages. Each stage is its own commit and leaves the lane green.

0. Map: run the existing specs, record which rows each one reaches, write the gap list.
1. Management rows: research priority, budget allocation, special training, fleet exercise, officers.
2. Construction rows: accelerate, dock expansion, revise project, rebuild.
3. Diplomacy rows: declare war, accept peace, alliance, non-aggression pact, blockade.
4. Battle rows: accept or decline an offer, fight with stance and speed orders, battle history. This needs a
   production path to an offer. If none exists without the debug build, stop and raise it.
5. Mapping check and the report, then the two-process hash comparison.

## Required tests

The e2e steps themselves, plus a script test for the mapping check.

## Expected artifacts

`apps/desktop/e2e/*.spec.ts`, the mapping check script, `.ai/reports/ui-reachability.md`.

## Delivery authority

- Pull request: `do not open`.
- Merge: `not authorized`.

## Blockers that need a human

Stage 4 has no production path to a battle offer. A step needs a content or engine change. The e2e lane exceeds the
CI time budget.
