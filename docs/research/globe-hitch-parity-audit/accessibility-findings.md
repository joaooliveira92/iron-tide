# Globe adapter accessibility findings

**Status: production enabled (ADR-0327).** The globe adapter is the default Overview
renderer; the SVG renderer is the rollback fallback.

## Production evidence (2026-10-28)

| Check | Result |
|---|---|
| axe-core against the full chrome and accessibility mirror | **PASS**; `GlobeAdapterChrome.a11y.test.tsx` reports no violations (color-contrast disabled in jsdom, region disabled because the component is fragment-hosted). |
| Keyboard-only path | **PASS** packaged: `+`, arrows, `0`, `n`, area-button Enter, layer, both projections and reset (15/15 interaction smoke). |
| Focus order and restoration | Native buttons in ownership order; the map application is focusable; area activation preserves focus. |
| Live region | Route/selection announcements are `role=status aria-live=polite`; route readout is visible text. |
| Reduced motion | **PASS** packaged pass with `prefers-reduced-motion: reduce`; keyboard pan uses `animate:false`. |
| ARIA tree | Packaged `ariaSnapshot` contains the application label, `Map areas` navigation (36 buttons), `Area control` table (36 rows) and the entity table. |
| Fallback | Forced, missing and corrupt asset paths fall back to the SVG renderer without page errors (47/47 adapter smoke). |
| High contrast | Not run: macOS host has no Windows forced-colors mode. Post-release. |
| Native screen reader | Not run: no NVDA/JAWS/VoiceOver session was available. aria-tree + axe + keyboard are the evidence. Post-release. |

## Closed findings (commit 67a7a18f)

| Matrix row | Finding | Resolution |
|---|---|---|
| K-07 | Canvas areas were not focusable. | Every area is a native `<button>` in the "Map areas" navigation, in stable name order. |
| K-08 | No Enter/Space activation for areas. | Native button activation selects the area. |
| K-10 | No visible focus treatment. | Area and entity buttons carry `focus-visible` outlines. |
| A-02 | No per-area accessible name with ownership, fleets or strength. | The accessible name is `"<area>: <owner>, <n> fleets, <strength>"`. |
| A-03 | No `aria-pressed` for area selection. | Area buttons expose `aria-pressed`. |
| A-04 | SR table had no area ownership or selected rows. | The SR "Area control" table lists name, owner, fleets and strength with `aria-selected`. |
| A-08 | Entity list was a partial keyboard substitute. | Areas, ports and fleets all have keyboard-reachable buttons. |
| P-05 / C-23 | Route reading was unreachable and had no accessible readout. | Shift-click works; `RouteReadout` renders the numbers and a polite live region announces the reading. |

## Evidence

- `GlobeAdapterChrome.test.tsx`: area list count and pressed state, ownership table
  content, panel disclosure, route readout.
- `GlobeAdapter.test.tsx`: keyboard `f` fleet cycle, shift-click reaching `onRuler`,
  hover tooltip content.
- `adapter-interaction.test.ts`: route announcement text.

## Not produced

- An axe run inside the packaged renderer (the axe run is on the production chrome
  component in jsdom; packaged evidence is the aria tree and keyboard smoke).
- A manual NVDA/JAWS/VoiceOver pass.
- High-contrast forced-colors testing.
- A cross-OS or cross-browser accessibility run.

These are post-release validation items, not claims of universal accessibility.
