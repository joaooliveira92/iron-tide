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

## Still owed if this session ends

- `pnpm snap` before (origin/dev worktree `../978-base`, built) for new-game, ship design, fleet; compare with `/tmp/snap-after/*`.
- Rewrite PR #984 body (see task: Closes #978, Refs #930, areas, decisions and deltas, gate table, observed vs assumed, trailer).
- Remove the `978-base` worktree (`git worktree remove`), mark ready when gates are green.
