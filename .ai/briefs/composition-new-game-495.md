# Task brief: compose the new-game screens from variants, parts and providers

```yaml
task:
  id: "#495"
  objective: "screens/new-game shows the briefing, archetype and world-situation views through explicit variants and one provider per sibling group, the orphaned BounceCards deck is gone, and no component in scope exceeds ~300 lines."
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "refactor/composition-new-game"
  worktree: ".worktrees/composition-new-game"
  machine: "joao-local-arm64"
  thread: "qoder desktop session 996c5012"
  model: "Qoder Desktop agent"
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

The new-game flow carries its display choices in booleans and its shared state in the screen
component. `NewGameScreenLayout` switches between three layouts from `centered` and `fullBleed`;
`ArchetypeConsequencePanel` hides two sections behind `compact`, and both callers pass `compact`,
so the full arm is unreachable. `NewGameArchetypeScreen` holds eight state hooks and derives the
focused, applied and pending shape of the selection, then drills eleven props into the deck pane
and the detail panel that are the same selection seen from two sides. `PowerNavigator` receives
`renderDossier`, a render prop for a slot that composition could express directly, and keeps its
own expansion state while its parent owns selection and the screen-reader announcement.
`FleetNationCard` and `DossierAccordionItem` branch five and two times on an `active` boolean.
`NewGameBriefingScreen` picks a page component from a five-arm index comparison chain.
`components/bounce-cards/BounceCards.tsx` (457 lines, `activeOnTop`, `shadow`, `enableHover`) has
no production consumer at all. `NewGameFleetMethodScreen` and `RulesOfTheNavalAgeScreen` hold the
same deck selection the same way the archetype screen did — pending id plus focus override in the
screen, applied and pending handed down as props to a deck pane and a detail panel.

## Evidence

- Issue #495, rank 5 of 14 in #490.
- Boolean-prop declarations in scope: `NewGameScreenLayout.tsx:14-15`, `ArchetypeConsequencePanel.tsx:54`,
  `FleetNationCard.tsx:10`, `DossierAccordionItem.tsx:9`, `BounceCards.tsx:26-32`.
- Render prop: `PowerNavigator.tsx:106`, called at `PowerNavigator.tsx:238`, supplied at
  `WorldSituationBriefing.tsx:57`.
- Drilled sibling state: `NewGameArchetypeScreen.tsx:66-105` (8 `useState`) into
  `ArchetypeDeckPane` (6 props) and `ArchetypeDetailPanel` (5 props) at lines 182-208.
- `BounceCards` has never had a consumer: `git log --oneline -- .../bounce-cards/` shows the initial
  commit only, the sole JSX use is its own test, and `a11y.audit.test.tsx:243` names a deck the
  fleet-method picker builds from `@/components/card-deck` instead. External references are
  `content-boundary.test.ts:27`, `released-screen-theme.test.ts:20-21`, and one row in
  `scripts/presentation-formatting.baseline.json`.
- Non-compact `ArchetypeConsequencePanel` is unreachable: only two call sites, both `compact`
  (`ArchetypeDetailPanel.tsx:121,136`).
- Same drilled deck state in the other two deck groups at `4c1c9208`:
  `NewGameFleetMethodScreen.tsx:30,33,35` into `FleetMethodDeckPane` (4 props, line 91) and
  `FleetMethodDetailPanel` (3 props, line 108); `RulesOfTheNavalAgeScreen.tsx:37,65` into
  `PresetDeckPane` (4 props, line 110) and `PresetDetailPanel` (3 props, line 127).
- Precedent: #505, #506 and #494 landed state/actions/meta providers and variant unions in this effort.

## Constraints and non-goals

Renderer only, behaviour-preserving. No engine, content, IPC, schema or shared-component change.
No code comments. Tests stay green in what they assert; new tests on `vite-plus/test`.

Folder ownership: `screens/new-game` only, plus the four edits the removal needs outside it —
`renderer/content-boundary.test.ts`, `renderer/shell/released-screen-theme.test.ts`,
`scripts/presentation-formatting.baseline.json` and the stale title in `renderer/a11y.audit.test.tsx`.
Nothing in `shell`, `components/card-deck`, `components/world-map` or `components/globe-adapter`
(folders owned by #496, #501 and #504).

Not in scope: converting the dossier slide panel or any dialog to the modal guide, the `useSvgGlobe`
frame loop, `world-situation.ts` model sizing, and the three near-duplicate deck panes
(archetype, fleet-method, preset) that share the card-deck contract.

## Acceptance criteria

- A per-component audit note in the PR naming the rules applied or skipped, with the reason —
  in particular why `applied`, `pending`, `selected`, `tabbable` and `canGoBack` stay booleans.
- No boolean display mode left in scope: `compact`, `centered`, `fullBleed`, `active` replaced by
  explicit variants; the orphaned `activeOnTop`, `shadow` and `enableHover` removed with their host.
- Sibling state in every deck group in the folder lives behind one provider or hook each with a
  state/actions/meta interface, read by the parts instead of received as props: the archetype deck,
  the world-situation navigator and dossier, the fleet-method deck and the preset deck. The last two
  were found while verifying the criterion folder-wide, after the approved audit set was fixed.
- `PowerNavigator` takes a dossier slot as children, not a `renderDossier` function.
- No component over ~300 lines left in scope without a stated reason.
- Folder tests pass; `pnpm snap` shows no visual regression on every new-game screen reached.
- `pnpm preflight` and `pnpm check` green on the final commit.

## Approach

`agent decides`. Clear the unreachable code first (BounceCards removal, dead consequence arm), then
swap booleans for variant unions, then lift each sibling group into a provider, then replace the
render prop and the briefing page chain. The last two groups join after the criterion is checked
folder-wide rather than per approved item. Keep every `data-testid`, accessible name, DOM class and
inline style so the snap comparison stays pixel-level.

## Required tests

No bug regression tests: this is behaviour-preserving. Existing new-game tests must pass unchanged
in what they assert, except where the removal deletes a component's own test. New tests: the two
providers (state/actions/meta through the composed parts), the layout and consequence variant unions,
and the dossier slot composition.

## Expected artifacts

Before and after `pnpm snap --strict --freeze` captures in
`apps/desktop/.dev-data/view/new-game-495-walk-base/` and `new-game-495-walk-branch/`, attached to
the PR. One recorded walk drives both: `--click "New Campaign"`, then `--click-at 1170,26` for every
header primary action, `--click` for the two deck cards, and two `--fill` steps for the admiral and
campaign name. The earlier per-build walks are not a valid pair: the header advances were matched by
accessible name, so a card click that fell back to `dispatchEvent` left the pointer elsewhere and the
next capture differed by one hover state rather than by the refactor.

## Delivery authority

- Pull request: may open after local gates pass.
- Merge: not authorized.

## Blockers that need a human

- A snap diff that cannot be explained as a capture-timing artefact.
- A part boundary that would require changing a wire schema or the IPC contract.
- Any engine, content or persistence file appearing in the affected set.
- A new-game screen that cannot be reached from the landing flow during capture.

## Downstream work

Audit note and follow-ups: #496 (shell) and #500 (fleet) should reuse the variant unions rather than
reintroduce booleans; the three duplicate deck panes are a separate deduplication ticket; the stale
a11y test title is fixed here, its siblings may not be.

## Cleanup

`pnpm worktrees status composition-new-game ready-for-review`, then prune once merged.
