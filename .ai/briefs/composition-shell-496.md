# Task brief: compose the shell status strip from parts, cards and one workspace

```yaml
task:
  id: "#496"
  objective: "shell renders the status strip through one state/actions/meta workspace and a compound Strip/Panel/Card/Glyph/Trend API with one module per card, no component over ~300 lines, and no new boolean display modes."
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "refactor/composition-shell"
  worktree: "main checkout"
  machine: "joao-local-arm64"
  thread: "opencode session"
  model: "DeepSeek V4.1 Flash Free"
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

`StatusStrip.tsx` (946 lines) and `StatusStripCards.tsx` (703) are the second- and fifth-largest
components in the renderer. One file owns the strip shell, three panels, the deferred-readout
popover, five chips, the pinnable-card surface and the row tile; another owns seven detail cards
and two trend charts. The strip's expansion lives in `StatusStripView` and is passed to the
controls as a rendered node; the budget bar and its legend share the active-segment state by
threading `active`/`onActive`/`noteFor` through `BudgetPanel`, `AllocationBar` and every legend
row. `PinnableCard` carries a `labelled` boolean that switches the trigger between a native
button and an emulated one, and `TrendSpark` carries a `zeroLine` display boolean.

## Evidence

- Issue #496, rank 6 of 14 in #490.
- `StatusStrip.tsx` 946 lines; `StatusStripCards.tsx` 703; largest single component `StatusStripView`.
- `StatusStrip.tsx:111-160` `PinnableCard` with `labelled`; `:171-209` `Instrument`; `:373-543`
  `AllocationBar` + `BudgetPanel` threading `active`/`onActive`/`noteFor`.
- `StatusStrip.tsx:846-910` `StatusStripView` owns `chosen`/`expanded` and builds the controls node.
- `StatusStripCards.tsx:94-221` `TrendSpark` with `zeroLine`.
- Existing shell contexts: `DensityContext`, `ThemeContext`, `FontContext`, `BackgroundContext`,
  `WindowContext`, `CampaignShellContext`, `ScreenHeaderContext`.
- Precedent: #494/#495 landed state/actions/meta workspaces and explicit variant unions; the
  overview `CardShell` variant is reused rather than reintroduced.

## Constraints and non-goals

Renderer only, behaviour-preserving. No engine, content, IPC or schema change. No code comments.
Tests stay green in what they assert; new tests on `vite-plus/test`. Only `shell` (plus the
`shell/` imports its facade already publishes) may change. Not in scope: the modal guide conversion
of dialogs, the `ScreenHeaderContext` consumer API (used across screens owned by other sub-issues),
the `status-strip-state`/`status-strip-trend` model builders, and `BottomNav`.

## Acceptance criteria

- A per-component audit note in the PR naming the rules applied or skipped, with the reason.
- No new boolean-prop modes: `labelled` and `zeroLine` replaced by explicit variants; other
  booleans audited and kept only with a stated data-fact reason.
- Strip expansion and the budget bar's active segment live behind state/actions/meta workspaces,
  read by the siblings rather than threaded as props.
- A compound `StatusStrip` with `StripPanel`, `StripCard`, `StripGlyph` and `StripTrend` parts, and
  one module per detail card, chip and panel.
- Existing shell display contexts audited against `state-context-interface`; no parallel context.
- No component over ~300 lines left in scope without a stated reason.
- Folder tests pass; `pnpm snap` shows no visual regression on the campaign screen and the strip's
  collapsed, expanded, hover and deferred states.
- `pnpm preflight` and `pnpm check` green on the final commit.

## Approach

`agent decides`. Keep the rendered DOM, class names, accessible names and test ids byte-identical;
move files first, then introduce the workspaces, then swap the two boolean modes for variant
unions, then split `App.tsx`'s interruption chain into a component that reads the shell context.

## Required tests

No bug regression tests: this is behaviour-preserving. Existing `StatusStrip`, `StatusStrip.reads`,
`BudgetContextChips`, `App`, `AppFrame` and `a11y` tests pass unchanged in what they assert. New
tests: the strip workspace (expand/collapse state through the compound parts), the budget
allocation workspace (bar and legend share the active segment), and the `StripGlyph`/`StripTrend`
variant unions.

## Expected artifacts

Before and after `pnpm snap --strict --freeze` captures in
`apps/desktop/.dev-data/view/shell-496-base/` and `shell-496-branch/`, attached to the PR.

## Delivery authority

- Pull request: may open after local gates pass.
- Merge: not authorized.

## Blockers that need a human

- A snap diff that cannot be explained as a capture-timing artefact.
- A part boundary that would require changing a wire schema or the IPC contract.
- Any engine, content or persistence file appearing in the affected set.

## Downstream work

Audit note and follow-ups: the header folder is already split; #500 (fleet) should reuse the card
and glyph parts rather than clone them.

## Result

### Shape

- `shell/StatusStrip.tsx` is an 8-line facade; the strip lives in `shell/status-strip/`.
- `useStatusStripWorkspace` owns the model, trend and expansion as state/actions/meta. Density remains
  the existing display source (`DensityContext`), not a second display context.
- `BudgetAllocationProvider` owns the active segment; `AllocationBar`, `AllocationLegend` and
  `CommittedRow` read the same workspace instead of threading `active`/`onActive`/`noteFor`.
- `PinnableCard` takes `variant: "button" | "pointer" | "pressable"`; `StripTrend` takes
  `baseline="zero"`. Both booleans are gone.
- One module per card, chip and panel. Largest file is `StripGlyph.tsx` (299 lines) because it holds
  six glyph arms; every other file is below 160 lines.
- `App.tsx` 358 → 307 lines; the interruption dialog chain is now
  `shell/interruptions/CampaignInterruptions.tsx`. The remaining 307 lines are the shell composition
  root (mode/route decisions and the frame wiring), not a card or panel.

### Tests

- `pnpm --filter @bluewave/desktop exec vp test run src/renderer/shell`: 48 files, 395 tests pass.
- New tests: `useStatusStripWorkspace`, `BudgetAllocationContext` sibling sharing,
  `StripGlyph` variants and `StripTrend` variants.
- `pnpm --filter @bluewave/desktop typecheck` and `pnpm --filter @bluewave/desktop lint` pass.

### Snap

Both runs used the same save and walk:

```
pnpm --filter @bluewave/desktop run snap --strict --freeze --save .dev-data/snap-save \
  --out .dev-data/view/shell-496-{base,branch} --wait 800 --wait-max 8000 \
  --shot strip-expanded --click "Collapse" --shot strip-collapsed --click "Expand" \
  --shot strip-expanded-again --hover "Maintenance" --shot strip-maintenance \
  --click "Not yet modelled" --shot strip-deferred --click "Not yet modelled" --shot strip-closed
```

- `aria.txt` and `text.txt` are byte-identical across every capture.
- `screenshot.png`, `strip-collapsed`, `strip-expanded-again`, `strip-maintenance`,
  `strip-deferred` and `strip-closed` differ on 0 pixels.
- `strip-expanded` differs on 1,388 pixels (0.147%), all in the NATIONS map overlay's fading
  scrollbar (x 1245–1252, y 136–309, max channel delta 46). It is not part of the strip.
- A first branch run also showed a 17×17 map-marker square on every capture; a second run removed
  it, confirming both artifacts are capture timing rather than the refactor.

## Audit note

| Component or prop                                                    | Rule                                     | Applied or skipped                                              |
| -------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `StatusStrip`, `StripPanel`, `StripCard`, `StripGlyph`, `StripTrend` | compound components                      | applied; each part is its own module                            |
| `PinnableCard.labelled`                                              | explicit variants                        | applied; `variant: "button" \| "pointer" \| "pressable"`        |
| `TrendSpark.zeroLine`                                                | explicit variants                        | applied; `baseline="zero"`                                      |
| `StatusStripView` expansion                                          | lift state                               | applied; `useStatusStripWorkspace`                              |
| `BudgetPanel` active segment                                         | lift state                               | applied; `useBudgetAllocationWorkspace`                         |
| Strip and budget siblings                                            | context interface                        | applied; split state/actions/meta providers                     |
| Existing display contexts                                            | context interface audit                  | `DensityContext` reused; no parallel context added              |
| `App` interruption chain                                             | children over render props / composition | applied; `CampaignInterruptions` reads the shell context        |
| `startCollapsed`, `pinned`, `open`, `checked`                        | avoid boolean props                      | skipped; each is a data or interaction fact, not a display mode |
| `advancing`, `saving`, `disabled`                                    | avoid boolean props                      | skipped; async status facts from the shell                      |
| `PrestigeCard.explanation` optional                                  | avoid boolean props                      | skipped; optional data, not a mode                              |
| `App.tsx` 307 lines                                                  | size budget                              | kept; composition root, no card/panel left inside               |

## Cleanup

`pnpm worktrees status composition-shell ready-for-review`, then prune once merged.
