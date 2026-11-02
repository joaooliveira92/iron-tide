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
- Bad arguments exit 2 with a message.

Parsing lives in `snap-args.ts`, problem tracking in `snap-problems.ts`, settling in
`snap-quiet.ts`; each has unit tests beside it.
