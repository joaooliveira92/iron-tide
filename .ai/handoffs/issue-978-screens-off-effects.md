# Handoff: #978 screens/ off effect hooks (PR #984)

Branch `refactor/issue-978-screens-off-effects`, head `b590cc13`, pushed. origin/dev was already an ancestor (no merge conflict); PRs #981/#983 still open, so `shell/useExternalSync.ts` is not on dev and is not used.

## Done this session (each area has its composition test, written first and green on the old code)

- battle: `use-stable-callback` (latest ref assigned in render, no insertion effect), `useTacticalPacer` (timer armed in a store subscription whose identity changes with the fired count, same cadence), `use-battle-clock` (previous-`ended` tracking in render), `use-battle-camera` (render-time fit and focus tracking), `UnitCommandPanel` (ref callback publishes the course preview), `TacticalMapRoot` (ref callback with ResizeObserver cleanup). New tests: use-battle-clock, use-stable-callback, UnitCommandPanel, TacticalMapRoot.
- campaign: `useCampaignFiles` (recents value store with subscribe lifecycle, new `lib/timed-value.ts` for the 15 s result), `useDisplayPreferences` (load keyed on session and bridge, via useSyncExternalStore). New tests: CampaignFileScreen.result, timed-value.
- construction and fleet: `useOrderDialog` (preview store lifecycle), `useFleetHotkeys`, `FleetMap`, `useFleetWorkspace` via new `lib/use-lifecycle.ts` (useSyncExternalStore with a memoised subscribe keyed on deps). New tests: useOrderDialog, FleetMap.
- `@bluewave/ship-visual` is now built in this worktree (`pnpm --filter @bluewave/ship-visual build`).

## Remaining baseline entries (8 under screens/)

new-game/nation-selection/InteractiveGlobe.tsx, useSvgGlobe.ts (plan: one stable ref callback on the GlobeShell container running base setup then d3 setup, focus spin detected in the tick loop; test first against the unmodified files); shipbuilding/ShipDesignScreen.tsx, useInspectorLayout.ts, workspace/LastChangeSlot.tsx, useWorkspaceNavigation.ts, useWorkspaceSession.ts; simulation/hooks/useSimulationScreen.ts. Use `useLifecycle` where a ref callback cannot express it (no DOM node, parent callbacks). If an area is too risky, leave its baseline entries, explain in the PR, open a follow-up issue.

## Gotchas learned

- Baseline update: `node scripts/assert-no-effect-hooks.mjs --write` after each migration (it only shrinks).
- `scripts/presentation-formatting.baseline.json` is keyed by line number: do not shift lines above a `localStorage` call in useDisplayPreferences.ts (keep new top-level constants below `takeLegacy`).
- No `as unknown` casts (preflight gate); write tests with `as Partial<T> as T` or typed stubs. Use the Edit tool, not python/sed, for file changes. Run `pnpm format:fix` before committing (pre-commit checks formatting). Tests: `pnpm test <path>` from apps/desktop (not `pnpm exec vp test`).
- Pre-commit runs `pnpm preflight` (~1 min).

## Still owed

- PR #984 body update: `Refs #930`; `Closes #978` only when no screens/ baseline entry remains, else `Refs #978`; Decisions (render-time ref assignment in useStableCallback; useLifecycle as the single commit-time reaction helper, to consolidate with #977's useExternalSync once it lands; behaviour deltas: camera fit/focus now adjust during render instead of one commit later; clock stops on the render the battle ends); gate table; observed vs assumed; trailer `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Gates: `src/renderer/a11y.audit.test.tsx` (ship-visual now built); `pnpm snap` before (origin/dev) and after for new-game, battle, fleet, shipbuilding, simulation (mark unsnappable screens `not run (reason)`); on the final commit `pnpm heavy pnpm preflight`, `pnpm heavy pnpm test:scripts`, `pnpm heavy pnpm check` (background, log, report pass/fail only). Mark ready only when green.
