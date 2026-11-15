# Task brief: retire golden/hashes.json and the repin ceremony (#742)

```yaml
task:
  id: "#742"
  objective: "golden/hashes.json, its probes and the Golden-Repin ceremony are gone; the replay corpus and approvals are the only golden gate"
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "refactor/issue-742-retire-golden-probes"
  worktree: ".worktrees/retire-golden-probes"
  risk: "high"
  pr_authorized: true
  merge_authorized: false
  validation:
    - "pnpm verify:affected"
    - "pnpm preflight"
    - "pnpm test:scripts"
    - "pnpm check"
```

## Problem

`golden/hashes.json` pins ten fixture-run hashes. Slice 1 (#740) gave every probe a corpus mutation test. The probe-retirement register marks all ten retire-eligible.

## Evidence

Mutations M7, M9 and M10 on current dev are caught by the corpus and no longer only by `hashes.json` (comment on #742). Discussion #724 covers the rest.

## Constraints and non-goals

- No hash moves. `golden/replays/`, `replay-approvals.json`, `replay-fuzz.json`, the replay approvals gate and the cross-process two-run equality test stay.
- The `AGENTS.md` golden stop condition stays and points at the replay corpus.
- Not in scope: re-recording replays, new scenarios, `dev` to `main` promotion gate.

## Acceptance criteria

- `golden/hashes.json`, `golden/probe-retirement.json`, `regenerate-golden-hashes.cjs`, `verify-golden-hashes.cjs`, `verify-probe-retirement.mjs`, `verify-golden-repin.mjs`, `check-golden-repin-staged.mjs`, `golden-repin.baseline` and their tests are removed.
- No script, hook, workflow, package script or doc references a removed file or the `Golden-Repin` trailer.
- `pnpm check:determinism`, `pnpm check:replay-corpus`, `pnpm test:scripts`, `pnpm check:parity` stay green.

## Approach

`agent decides`. Three narrow commits: consumers of the pin, then the repin ceremony, then docs.

## Required tests

Existing script tests updated; no new behaviour.

## Rollback

Revert the PR; the removed files return unchanged.
