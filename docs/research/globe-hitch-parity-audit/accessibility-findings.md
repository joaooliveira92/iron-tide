# Globe adapter accessibility findings

**Scope:** the experimental adapter behind `VITE_BLUEWAVE_GLOBE_ADAPTER`. The
current Overview renderer is unchanged.

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

- A full axe run against a packaged adapter build.
- A manual NVDA/VoiceOver pass.
- High-contrast forced-colors testing.
- A cross-OS or cross-browser accessibility run.

These remain follow-up evidence, not claims. The current renderer's existing
accessibility behaviour is unchanged.
