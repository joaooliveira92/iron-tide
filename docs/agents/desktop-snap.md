# Desktop snap (agent eyes and hands)

`pnpm snap` launches the built desktop app through the hermetic E2E harness, optionally
drives it, then captures the screen. It is a diagnostic, not a test: it asserts nothing
unless `--strict` is given. Source: `apps/desktop/scripts/view.ts`.

Build first (`pnpm --filter @bluewave/desktop build`; a fresh worktree also needs the
package builds). Output lands in `.dev-data/view` (git-ignored, `--out DIR` to change):
`screenshot.png`, `aria.txt` (best for finding controls), `text.txt`, `console.log`.

## Actions

Actions run in command-line order, in either `--flag value` or `--flag=value` form.

| Flag | Does |
| --- | --- |
| `--click TEXT` / `--hover TEXT` | Accessible role/name match; `"TEXT @last"` / `"TEXT @N"` picks a match |
| `--fill LABEL=VALUE`, `--press KEY` | Fill a labelled field; press a key |
| `--advance N` | Advance N months |
| `--click-at X,Y` | Click at window coordinates in CSS pixels (screenshots are 2x) |
| `--scroll DX,DY[@X,Y]` | Wheel scroll, after moving the pointer to X,Y; zooms the world map |
| `--shot NAME` | Save `NAME.png` mid-flow |

Setup: `--save DIR`, `--make-save DIR`, `--size WxH`, `--theme`, `--background`, `--tour`.

## Image budget

Read `aria.txt` first. The default window is 1280x800 and screenshots are written in CSS pixels, so retina displays do not double the image. Take one screenshot per changed screen and drop it afterwards. `--full-res` keeps the native window and device pixels for a final pixel-level check; `--size WxH` overrides the window.

## Reliability

- After each action it waits `--wait` ms (default 300), then for the DOM to be
  structurally quiet, up to `--wait-max` ms (default 5000). Continuous animation is ignored.
- `--freeze` gives steadier captures: reduced motion, CSS animations disabled, static
  backdrop. WebGL and canvas content keeps moving.
- `--strict` exits 1 on page or console errors, a click that fell back or failed, a
  missing Overview, or an idle render loop. A failed action never loses the capture.
- Bad arguments exit 2 with a message, including `--save` together with `--make-save`.
- Every action warning or failure is prefixed `step N (action): ...` with the one-based step.

## Evidence runs

- Without `--strict`, `snap` exits 0 even when it recorded problems, so a run is not
  evidence. Use `--strict` for any run whose output backs a claim.
- `snap` captures diagnostics; it does not compare images or manage baselines. A base/branch
  comparison is two explicit executions into two `--out` directories, one per checkout, and
  you compare the results yourself.
- A tour (`End inspection`) is dismissed on launch and after every action unless `--tour`.
- Every action, `--shot` included, is followed by the `--wait` and quiet settle, so the next
  action starts on a settled screen.

## Recipe: Open design menu and dialog

```
pnpm snap --make-save DIR --out OUT --freeze --strict --advance 24 \
  --click "Ship design" --click "More design actions" --click "Open design"
```

`aria.txt` lists the completed ship in "Open a design"; `--advance 12` shows "Under construction".

## Output directory and `steps.json`

Before running, `snap` deletes only files it owns: `screenshot.png`, `aria.txt`, `text.txt`,
`console.log`, `steps.json`, this run's `--shot` names, and the artifacts listed in a previous
`steps.json`. Anything else in `--out` is left alone, so a failed run never passes off an
earlier run's capture as its own.

`steps.json` (schema version 1) holds the effective options, the ordered actions, per-step
outcome (`ok`/`warning`/`failed`), selector fallbacks (`text-match`, `dispatch-click`), recorded
problems, produced artifact names, and `result.classification`
(`clean`/`problems`/`strict-failure`/`aborted`) with the exit code. It omits `--fill` values,
`--eval` source, and `--out`/`--save`/`--make-save` paths.

Parsing lives in `snap-args.ts`, problem tracking in `snap-problems.ts`, settling in
`snap-quiet.ts`, the manifest in `snap-manifest.ts`, stale-output cleanup in `snap-output.ts`;
each has unit tests beside it.

## Recipe: Last change strip

Run for light and dark, at the default size and `--size=1100x700` (the `=` form), wrapped in
`xvfb-run -a` on headless Linux. Keep the edit small: a large one opens the "breaks the design" dialog.

```
pnpm snap --strict --make-save /tmp/save --out /tmp/lc --theme dark --click "Ship design" \
  --click "Machinery" --fill "Installed power=3300" --press Tab
```

`aria.txt` shows a "Last change" status with one button per moved aspect ("Speed +1.3 kn, better.
Open Machinery") and New/Resolved finding items. Check arrow plus word (not colour alone) and a visible plan.
