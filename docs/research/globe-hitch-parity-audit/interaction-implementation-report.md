# Globe interaction-parity implementation report

**Status: engineering work complete on `feat/globe-interaction-parity`; adapter
still disabled by default; current renderer still the default and fallback;
nothing merged or released.**

| Item | Value |
|---|---|
| Base | `perf/globe-hitch-parity-audit` at `a6b1fa3f` |
| Branch | `feat/globe-interaction-parity` |
| Implementation commit | `67a7a18f` |
| Parent tracker | #341 |
| Child issues | #342-#349 |

## What changed

The adapter now reuses the Overview renderer's application contracts rather than
re-implementing them:

- `adapter-layer-state.ts` maps every `LayerId` to its own layer/filter, maps the
  two application projections deterministically, and builds the 1880 border and
  graticule GeoJSON. MapLibre stays inside the adapter.
- `adapter-derivations.ts` builds ownership rows, the area tree and the selected
  area summary from the shared `campaignWorldMapSource` and `buildOwnershipRows`.
- `adapter-interaction.ts` owns the 6 px drag threshold, fleet marker identity and
  the drop hand-off through `resolveDrop`. It does not resolve orders itself.
- `GlobeAdapterChrome.tsx` hosts the Overview panels and controls: layer/projection
  disclosure, centre slider, reset, area tree, area list, inspector, route readout,
  minimap, legend, scale bar, frame meter, SR ownership table and entity list.
- `GlobeAdapter.tsx` wires MapLibre pointer/keyboard events, hover paint, fleet
  selection/drag, route reading, projection/reset/initial focus and lifecycle
  disposal. New canvas listeners and the hover animation frame are registered in
  the existing `DisposalRegistry`.

## Issue status

| Issue | Surface | Status | Evidence |
|---|---|---|---|
| #342 | Hitch reproduction on other hardware | **Blocked externally** (no reproducing host; no packaged tile pack in this checkout). No speculative code fix. | `hitch-report.md` update; matrix H-01 |
| #343 | Shift-click route reading and readout | Complete | `GlobeAdapter.test.tsx`, `GlobeAdapterChrome.test.tsx`, `adapter-interaction.test.ts` |
| #344 | Fleet selection and drag-to-order | Complete | `GlobeAdapter.test.tsx`, `adapter-interaction.test.ts` |
| #345 | Area hover and tooltips | Complete | `GlobeAdapter.test.tsx`, `adapter-derivations.test.ts` |
| #346 | Layer toggles, borders and graticule | Complete | `adapter-layer-state.test.ts`, `GlobeAdapter.test.tsx` |
| #347 | Chrome and panels | Complete | `GlobeAdapterChrome.test.tsx` |
| #348 | Projection, reset and centre | Complete | `GlobeAdapterChrome.test.tsx`, `adapter-layer-state.test.ts` |
| #349 | Keyboard and screen-reader area access | Complete | `GlobeAdapterChrome.test.tsx` |

## Interaction coverage

- Pointer: area select/toggle, shift-click route, fleet select, fleet drag with
  threshold, cancel, illegal-destination rejection, minimap recentre.
- Keyboard: arrows with shift acceleration, +/-/_, 0 reset, n north, f/F fleet
  cycle, Escape clear, tab to every area, Enter/Space activation.
- State: projection write-through, reset fit, centre changes, initial home focus,
  panel disclosure memory, selection persistence.
- Layers: all seven toggles plus an always-on graticule; no geometry rebuilds.
- Accessibility: native buttons, ownership/fleet/strength names, `aria-pressed`,
  focus-visible rings, SR area control table, live route announcements.
- Failure: the existing adapter fallback and flag guard are unchanged.

## Intentional differences

- The adapter has two camera modes (globe/mercator) while the Overview renderer has
  two planar projections (Miller/equirectangular). The documented mapping is
  globe→Miller and mercator→equirectangular; it preserves the application
  projection state but cannot reproduce a planar Miller camera exactly inside a
  globe surface.
- Double-click zoom is disabled in the adapter to avoid racing the selection
  toggle; the current renderer does not implement double-click zoom (P-11).
- The adapter keeps its existing separate entity list for ports and fleets in
  addition to the new area list.

## Performance

No new performance claim is made. The packaged adapter tile pack and build
artifacts used by `globe-audit-benchmark.mjs` are not present in this checkout, and
the repository forbids inventing measurements. The parity changes are
interaction-path only and add no per-frame work beyond a single rAF-coalesced hover
query. #342 remains the correct place for a reproducing host, GPU/compositor trace
and before/after frame comparison. Cross-GPU, Windows and Linux evidence remains
absent.

## Validation

- Focused adapter/chrome/contract tests: **73/73 pass** across 11 files.
- Packaged adapter smoke: **47/47 pass**, including the area mirror (36 buttons),
  screen-reader area table (36 rows), minimap, frame meter, layer controls,
  fallback modes, no remote request, worker return and bounded lifecycle.
- Adapter package guard: **PASS**, 19,587 files, 16 allow-listed map assets,
  0 violations.
- Lifecycle on the parity build: 548 listeners / 813 detached nodes, flat across
  five cycles; live DOM 70 → 70; workers 0 → 0; heap 20.3 → 20.5 MB.
- `pnpm check` and `pnpm test:scripts` results are recorded on the parent issue.

Evidence: `evidence/parity/` (`globe-adapter-smoke.json`,
`globeadapter-guard.json`, `packaged-smoke.txt`, `environment.txt`).

## Rollback

The branch changes only `apps/desktop/src/renderer/components/globe-adapter` and
`docs/research/globe-hitch-parity-audit`. Reverting `67a7a18f` restores the audit
branch exactly; the flag, default renderer and fallback are untouched either way.
