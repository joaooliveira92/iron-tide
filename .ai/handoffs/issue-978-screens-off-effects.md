# Handoff: #978 screens/ off effect hooks (PR #984)

Branch `refactor/issue-978-screens-off-effects`. Every `screens/` entry is gone from `scripts/effect-hooks.baseline.json`; the PR therefore says `Closes #978`.

## Migrated

- battle, campaign, construction, fleet: first and second sessions (see git log); helpers `lib/value-store.ts`, `lib/timed-flag.ts`, `lib/timed-value.ts`, `lib/use-lifecycle.ts`.
- globe: `useSvgGlobe` is a factory behind `useState`; its container ref callback runs the base setup then `attachGlobeInteractions` (new `globeInteractions.ts`); focus spin is detected in a tick handler. Test: `InteractiveGlobe.test.tsx` (green on the old code first).
- shipbuilding and simulation: mechanical `useLifecycle`; `useInspectorLayout` assigns its latest ref in render. New test: `useSimulationScreen.test.tsx` (green on the old hook first).
- Fixed typing errors in `UnitCommandPanel.test.tsx` and `useOrderDialog.test.tsx` that broke `tsc -b`.

## Gates

- `a11y.audit.test.tsx`: passed (13).
- `pnpm snap` after: new-game, ship design, ports-and-fleets panel clean (`--strict`). Battle (no snap route to a live battle) and simulation (debug-only screen, absent from the shipping bundle) not snappable.
- Final-commit gates (`pnpm heavy`): logs in `/tmp/978-gate-*.log`, summary in `/tmp/978-gates.txt` (ephemeral).

## Done since

- `pnpm snap` before/after: new-game and ship design aria identical; fleet differs only by save nondeterminism. Base worktree removed.
- `pnpm preflight` and `pnpm test:scripts` passed on the final code; `pnpm check` first failed on two lint findings (fixed in the last commit) and was rerun (log `/tmp/978-gate-check2.log`, exit in `/tmp/978-chk.txt`).
- PR #984 body rewritten (`Closes #978`, `Refs #930`).

## Still owed

- Confirm `pnpm check` exit 0; if green, set the check row in the PR body to `passed` and `gh pr ready 984`. If it failed, fix the named failures only, rerun.
