# Handoff: #979 design-workspace off effect hooks (PR #989)

Branch `refactor/issue-979-design-workspace-off-effects`, draft PR #989 (`Refs #979`). #985/#988 landed the rest of #979 on dev; this PR migrates `components/design-workspace/**` with `useLifecycle` (now exported from `shell/useExternalSync.ts`). The baseline is now `{}`.

## Done

- All design-workspace effects use `useLifecycle`; baseline emptied (formatted as `{}`).
- Gates passed on the pre-final tree: desktop typecheck, lint, build, design-workspace + shipbuilding tests (931), `assert-module-size`, `assert-no-effect-hooks`.
- `pnpm snap` before/after (zoom, layers, ports, ship design, open-design menu, search; strict): clean, aria identical except map-camera float noise and a frame counter.
- Local backup branch `refactor/issue-979-components-off-effects` (unpushed, superseded).

## Still owed

- Final-commit gates run in the background via `pnpm heavy`: exit codes in `/tmp/979e-g.txt` (`pre`, `ts`, `check`), logs `/tmp/979e-*.log`. Ephemeral.
- `pnpm verify:affected` earlier failed on `packages/combat` lint (`placement.test.ts` TS2353, from dev #986, not this PR); re-run it and confirm.
- Update the PR body gate rows (`GATES_PENDING` placeholder) and run `gh pr ready 989` when green.
