# Overview interaction-parity matrix

**Status (2026-10-28): production enabled.** The globe adapter is the default Overview
renderer; the current SVG renderer remains the rollback fallback (ADR-0327). This matrix
was revalidated against the production candidate and the packaged pointer/keyboard
smoke `globe-packaged-interactions.mjs` (15/15).

Scope: every interaction surface the current default Overview map offers, against the
globe adapter. A row with `not-applicable` means the current renderer does not offer the
surface, so parity is undefined; adapter-only behaviour is recorded rather than scored as
a regression. Every not-applicable row has a current product rationale in
[§ Not-applicable review](#not-applicable-review).

Rows: 71. Verdicts: not-applicable 13, pass 58, fail 0, unverified 0.
Implementation commits: `67a7a18f` (parity implementation), `0baa769a` and `db16d738`
(keyboard/control fixes and regression coverage). The note column records the post-fix
behaviour; the tests column links the regression evidence.

Evidence paths are relative to `apps/desktop/src/renderer/`. Test paths are relative to
`apps/desktop/src/renderer/components/globe-adapter/` unless a shared component is named.

| ID | Surface | Current renderer | Adapter | Verdict | Severity | Note | Tests |
|---|---|---|---|---|---|---|---|
| P-01 | Drag the map to pan | `world-map/useMapCamera.ts:232-268` | `globe-adapter/GlobeAdapter.tsx:723-746` | **pass** | none | MapLibre dragPan remains on; fleet drag temporarily holds it. | globe-audit-benchmark.mjs pan protocol |
| P-02 | Wheel zoom at the pointer | `world-map/useMapCamera.ts:223-226` | `globe-adapter/GlobeAdapter.tsx:723-746` | **pass** | none | MapLibre scrollZoom remains on; the wheel step differs from the Overview exp curve. | globe-audit-benchmark.mjs wheel protocol |
| P-03 | Click an area to select it | `world-map/WorldMapChart.tsx:150-154` | `globe-adapter/GlobeAdapter.tsx:815-866` | **pass** | none | Rendered areas-fill features drive selection; empty click clears. | GlobeAdapter.test.tsx:128 |
| P-04 | Click the selected area again to clear it | `world-map/map-state.ts:55-57` | `globe-adapter/GlobeAdapter.tsx:815-866` | **pass** | none | The adapter calls the shared onSelect, so the app state toggle is preserved. | GlobeAdapter.test.tsx:128 |
| P-05 | Shift-click two areas for a route reading | `world-map/WorldMapChart.tsx:150-153` | `globe-adapter/GlobeAdapter.tsx:743,815-866; GlobeAdapterChrome.tsx:306-312` | **pass** | high | boxZoom is disabled; shift-click reaches onRuler; RouteReadout renders the numbers. | GlobeAdapter.test.tsx:128; GlobeAdapterChrome.test.tsx:95 |
| P-06 | Click a fleet marker to select the fleet | `world-map/WorldMapChart.tsx:156-175` | `globe-adapter/GlobeAdapter.tsx:833-838` | **pass** | high | A fleet marker calls orders.onSelectFleet instead of selecting its area. | GlobeAdapter.test.tsx:147 |
| P-07 | Click a port marker | `world-map/layers/PortsLayer.tsx:9-41` | `globe-adapter/GlobeAdapter.tsx:833-838` | **not-applicable** | info | The current renderer has no port click; the adapter selects the port's area. | n/a (adapter-only) |
| P-08 | Hover an area to highlight it | `world-map/layers/AreasLayer.tsx:85` | `globe-adapter/GlobeAdapter.tsx:869-905` | **pass** | medium | Rendered area hover drives areas-hover and areas-hover-line paint filters. | GlobeAdapter.test.tsx:207 |
| P-09 | Hover tooltip / accessible area title | `world-map/layers/AreasLayer.tsx:92,101` | `globe-adapter/GlobeAdapter.tsx:1285-1295` | **pass** | medium | Hover renders a role=tooltip with the area ownership/fleet/strength description. | GlobeAdapter.test.tsx:207 |
| P-10 | Marker hover feedback | `world-map/layers/FleetsLayer.tsx:37` | `globe-adapter/GlobeAdapter.tsx:869-898` | **not-applicable** | info | Marker hover is adapter-only cursor/store feedback; the current renderer has no marker hover. | n/a (adapter-only) |
| P-11 | Double-click to zoom | `world-map/WorldMapChart.tsx:250-257` | `globe-adapter/GlobeAdapter.tsx:743-746` | **not-applicable** | low | doubleClickZoom is disabled to avoid a selection-toggle race; the current renderer has no double-click zoom. | GlobeAdapter.test.tsx:105 |
| P-12 | Right-drag rotate / context menu | `world-map/WorldMapChart.tsx:250-257` | `globe-adapter/GlobeAdapter.tsx:723-746` | **not-applicable** | low | MapLibre dragRotate/context defaults remain; adapter-only, the current renderer does not rotate. | n/a (adapter-only) |
| P-13 | Shift-drag box zoom | `world-map/WorldMapChart.tsx:250-257` | `globe-adapter/GlobeAdapter.tsx:743` | **not-applicable** | low | boxZoom is disabled for parity and route reading; adapter-only otherwise. | GlobeAdapter.test.tsx:128 |
| P-14 | Touch pinch zoom, rotate and pitch | `world-map/useMapCamera.ts:232-268` | `globe-adapter/GlobeAdapter.tsx:723-746` | **not-applicable** | low | MapLibre touch defaults remain; the current renderer is single-pointer pan only. | n/a (adapter-only) |
| P-15 | Minimap drag to recentre | `world-map/MapMinimap.tsx:107-136` | `globe-adapter/GlobeAdapterChrome.tsx:70-109,295` | **pass** | medium | The minimap renders the world and viewport and recentres on pointer down. | GlobeAdapterChrome.test.tsx:119 |
| P-16 | Fleet pick-up and drag-to-order | `world-map/WorldMapChart.tsx:156-197` | `globe-adapter/GlobeAdapter.tsx:914-970` | **pass** | high | A 6 px threshold starts a fleet drag; dragPan is held; resolveDrop decides, cancel restores. | GlobeAdapter.test.tsx:175,305; adapter-interaction.test.ts:54-77 |
| P-17 | Pointer capture and cancel cleanup | `world-map/WorldMapChart.tsx:166,186-188,256-257` | `globe-adapter/GlobeAdapter.tsx:914-970` | **pass** | none | Pointer capture, pointerup and pointercancel are disposed by the registry. | GlobeAdapter.test.tsx:303 |
| K-01 | Map is a focusable application surface | `world-map/WorldMapChart.tsx:250-252` | `globe-adapter/GlobeAdapter.tsx:1258-1264` | **pass** | none | role=application, tabIndex=0 and a full key hint label. | GlobeAdapter.test.tsx:343 |
| K-02 | Arrow keys pan | `world-map/WorldMapChart.tsx:134-142` | `globe-adapter/GlobeAdapter.tsx:1155-1212` | **pass** | none | Arrow keys pan 120 px, 240 px with Shift; reduced motion is honoured. | GlobeAdapter.test.tsx:343,362 |
| K-03 | Plus/equals/minus zoom | `world-map/WorldMapChart.tsx:143-144` | `globe-adapter/GlobeAdapter.tsx:1155-1212` | **pass** | none | Plus/equals and minus/underscore change zoom by 0.5 levels. | GlobeAdapter.test.tsx:343 |
| K-04 | Zero fits the world | `world-map/WorldMapChart.tsx:145` | `globe-adapter/GlobeAdapter.tsx:1143-1153` | **pass** | none | Zero and Reset view fit the world at the app centre with zero bearing/pitch. | GlobeAdapter.test.tsx:335 |
| K-05 | Escape clears selection | `world-map/WorldMapChart.tsx:128-133` | `globe-adapter/GlobeAdapter.tsx:1155-1168` | **pass** | none | Escape clears the selected fleet and area through onSelect(null). | GlobeAdapter.test.tsx:343 |
| K-06 | f cycles the selected fleet and focuses it | `world-map/WorldMapChart.tsx:114-127` | `globe-adapter/GlobeAdapter.tsx:1155-1185` | **pass** | medium | f/F cycles orders.fleets, selects the fleet and jumps to its area. | GlobeAdapter.test.tsx:225 |
| K-07 | Tab to each area | `world-map/layers/AreasLayer.tsx:88-89` | `globe-adapter/GlobeAdapterChrome.tsx:228-255` | **pass** | high | Every area is a native focusable button in stable ownership order. | GlobeAdapterChrome.test.tsx:65 |
| K-08 | Enter/Space activates a focused area | `world-map/layers/AreasLayer.tsx:94-99` | `globe-adapter/GlobeAdapterChrome.tsx:228-255` | **pass** | high | Native button activation selects the area with Enter/Space. | GlobeAdapterChrome.test.tsx:65 |
| K-09 | n returns bearing to north | `world-map/WorldMapChart.tsx:250-257` | `globe-adapter/GlobeAdapter.tsx:1199` | **not-applicable** | info | n returns bearing to north; adapter-only, the current renderer does not rotate. | GlobeAdapter.test.tsx:343 |
| K-10 | Visible focus ring | `world-map/layers/AreasLayer.tsx:85` | `globe-adapter/GlobeAdapterChrome.tsx:242,261` | **pass** | medium | Area and entity buttons carry focus-visible outline styling. | GlobeAdapterChrome.test.tsx:65 |
| K-11 | MapLibre native keyboard handler | `world-map/WorldMapChart.tsx:245-257` | `globe-adapter/GlobeAdapter.tsx:743-746` | **pass** | low | MapLibre's native keyboard handler is disabled so only the adapter handler acts. | GlobeAdapter.test.tsx:141 |
| C-01 | Explicit zoom +/- buttons | `world-map/MapControlsPanel.tsx:34-123` | `globe-adapter/GlobeAdapter.tsx:900-917` | **not-applicable** | info | Absent on both sides. |  |
| C-02 | Explicit pan buttons | `world-map/MapControlsPanel.tsx:34-123` | `globe-adapter/GlobeAdapter.tsx:900-917` | **not-applicable** | info | Absent on both sides. |  |
| C-03 | Reset view / fit | `world-map/MapControlsPanel.tsx:96-106` | `globe-adapter/GlobeAdapter.tsx:1143-1153; GlobeAdapterChrome.tsx:195-208` | **pass** | medium | Reset fits the world; the duplicate bottom-left reset button was removed. | GlobeAdapter.test.tsx:335; GlobeAdapterChrome.test.tsx:76 |
| C-04 | Projection switch | `world-map/MapControlsPanel.tsx:43-63` | `globe-adapter/GlobeAdapter.tsx:1214-1225; adapter-layer-state.ts:30-36` | **pass** | high | Projection writes ProjectionId through onSetProjection with a deterministic mapping. | GlobeAdapter.test.tsx:335; adapter-layer-state.test.ts:38 |
| C-05 | Projection explanatory tooltip | `components/ui/tip.tsx:14-42, world-map/projection.ts:33,41` | `globe-adapter/GlobeAdapterChrome.tsx:195-208` | **pass** | low | The reused MapControlsPanel keeps the projection Tips and explanations. | ui/tip.test.tsx; WorldMapChart.test.tsx:47 |
| C-06 | Ownership layer toggle | `world-map/MapLayers.tsx:63-72` | `globe-adapter/GlobeAdapter.tsx:596-610,632-635; adapter-layer-state.ts:67-76` | **pass** | medium | Ownership paint is dimmed, not removed, so areas remain pickable. | adapter-layer-state.test.ts:92; GlobeAdapter.test.tsx:240 |
| C-07 | 1880 borders toggle and layer | `world-map/useWorldMapModel.ts:99-113, WorldMapChart.tsx:227` | `globe-adapter/GlobeAdapter.tsx:321-341,601-603; adapter-layer-state.ts:94-121` | **pass** | medium | 1880 border fill/line GeoJSON is built once and toggled by its own layer. | adapter-layer-state.test.ts:68; GlobeAdapter.test.tsx:240 |
| C-08 | Sea lanes toggle | `world-map/MapLayers.tsx:78, layers/LanesLayer.tsx` | `globe-adapter/GlobeAdapter.tsx:349-359,605; adapter-layer-state.ts:49-52` | **pass** | medium | Static lanes are tagged overlayClass=lane and have their own toggle. | adapter-layer-state.test.ts:63; GlobeAdapter.test.tsx:240 |
| C-09 | Possessions / ports toggle | `world-map/MapLayers.tsx:86-88` | `globe-adapter/GlobeAdapter.tsx:385-410,607; adapter-layer-state.ts:38-47` | **pass** | medium | Port markers are filtered by the possessions toggle. | adapter-layer-state.test.ts:45; GlobeAdapter.test.tsx:240 |
| C-10 | Fleets toggle | `world-map/MapLayers.tsx:90-99` | `globe-adapter/GlobeAdapter.tsx:385-410,607; adapter-layer-state.ts:38-47` | **pass** | medium | Fleet and alert markers are filtered by the fleets toggle. | adapter-layer-state.test.ts:45; GlobeAdapter.test.tsx:240 |
| C-11 | Labels toggle | `world-map/useWorldMapModel.ts:195-197` | `globe-adapter/GlobeAdapter.tsx:302-318,601` | **pass** | none | Area labels toggle their own layer visibility. | GlobeAdapter.test.tsx:240 |
| C-12 | Routes toggle | `world-map/useWorldMapModel.ts:298-307` | `globe-adapter/GlobeAdapter.tsx:361-383,606` | **pass** | none | Routes toggle their own layer visibility; lanes remain independent. | GlobeAdapter.test.tsx:240 |
| C-13 | Graticule | `world-map/MapLayers.tsx:53, layers/GraticuleLayer.tsx` | `globe-adapter/GlobeAdapter.tsx:342-348,604; adapter-layer-state.ts:123-151` | **pass** | low | The graticule is always-on geometry, matching the current renderer. | adapter-layer-state.test.ts:68; GlobeAdapter.test.tsx:240 |
| C-14 | Centre-longitude slider | `world-map/MapControlsPanel.tsx:83-95` | `globe-adapter/GlobeAdapter.tsx:622-626; GlobeAdapterChrome.tsx:195-208` | **pass** | medium | The centre slider writes onSetCentre and recentres the map. | GlobeAdapterChrome.test.tsx:76 |
| C-15 | Layers & areas disclosure | `world-map/WorldMapChart.tsx:338-350` | `globe-adapter/GlobeAdapterChrome.tsx:188-195` | **pass** | low | Layers & areas disclosure exists and is open by default in full mode. | GlobeAdapterChrome.test.tsx:140 |
| C-16 | Area tree panel | `world-map/WorldMapChart.tsx:366-376, components/shared/CollapsiblePanel.tsx` | `globe-adapter/GlobeAdapterChrome.tsx:195-208` | **pass** | high | The reused MapControlsPanel hosts the area tree/inline list. | WorldMapChart.test.tsx:158,184; GlobeAdapterChrome.test.tsx:65 |
| C-17 | Area tree modes, filter, grouping, row selection | `world-map/AreaTreePanel.tsx:42-110` | `globe-adapter/GlobeAdapterChrome.tsx:195-208` | **pass** | medium | AreaTreePanel supplies modes, filter, grouping and row selection. | WorldMapChart.test.tsx:226-271 |
| C-18 | Inline Areas details | `world-map/MapControlsPanel.tsx:113-122` | `globe-adapter/GlobeAdapterChrome.tsx:195-208` | **pass** | low | inlineAreas=true renders the Areas details list. | GlobeAdapterChrome.test.tsx:65 |
| C-19 | Minimap | `world-map/WorldMapChart.tsx:301-312` | `globe-adapter/GlobeAdapterChrome.tsx:70-109,295` | **pass** | medium | Minimap renders and recentres; showMinimap is honoured. | GlobeAdapterChrome.test.tsx:119 |
| C-20 | Legend and not-modelled notes | `world-map/MapLegend.tsx:9-45` | `globe-adapter/GlobeAdapterChrome.tsx:297-301` | **pass** | medium | The reused MapLegend shows ports/fleets and the not-modelled note. | GlobeAdapterChrome.test.tsx:119 |
| C-21 | Scale bar | `world-map/MapScaleBar.tsx:19-52` | `globe-adapter/GlobeAdapterChrome.tsx:112-123,302; adapter-layer-state.ts:184-195` | **pass** | low | Scale bar derives a bounded nm width from the camera zoom. | adapter-layer-state.test.ts:110 |
| C-22 | Area inspector with neighbours and clear | `world-map/AreaInspector.tsx:22-71` | `globe-adapter/GlobeAdapterChrome.tsx:220-226` | **pass** | high | The reused AreaInspector shows ownership, fleets, neighbours and clear. | adapter-derivations.test.ts:53; AreaInspector.tsx:22-71 |
| C-23 | Route readout numbers | `world-map/RouteReadout.tsx:22-38` | `globe-adapter/GlobeAdapterChrome.tsx:306-312` | **pass** | high | RouteReadout shows hops, nm, nm/hop and months. | GlobeAdapterChrome.test.tsx:95 |
| C-24 | Frame-time meter | `world-map/useFrameMeter.ts:10-41` | `globe-adapter/GlobeAdapterChrome.tsx:125-143,210` | **pass** | low | A live frame meter samples rAF in the chrome. | GlobeAdapterChrome.test.tsx:65 |
| C-25 | Panel size compact/large/fill | `world-map/WorldMapPanel.tsx:62-75` | `globe-adapter/GlobeAdapter.tsx:1250-1256; MapSurface.tsx:49-66` | **pass** | medium | The adapter is absolute inset-0 inside its host, honours variant root and className; the existing WorldMapPanel size control still applies. | GlobeAdapter.test.tsx:384; WorldMapPanel.test.tsx:18 |
| C-26 | F1 full-screen map sheet | `shell/MapSheet.tsx:13-40` | `globe-adapter/GlobeAdapter.tsx:886-890` | **not-applicable** | info | The adapter is already a full-window overlay. |  |
| C-27 | Dock layout and chrome insets | `world-map/map-variant-layout.ts:56-71, useMapCamera.ts:192-217` | `globe-adapter/GlobeAdapter.tsx:1250-1256; GlobeAdapterChrome.tsx:180-220` | **pass** | high | Chrome uses MAP_VARIANT_LAYOUT and the --chrome-* insets; command mode docks controls away from the host panels. | GlobeAdapter.test.tsx:384 |
| C-28 | Coastline loading/unavailable status | `world-map/WorldMapChart.tsx:230-244` | `globe-adapter/MapSurface.tsx:11-20,69-73` | **pass** | none | Failure falls back to the current renderer with a role=alert. | globe-adapter-smoke.mjs forced/missing/corrupt checks |
| C-29 | Source-zoom/tile diagnostics bar | `world-map/useFrameMeter.ts:10-41` | `globe-adapter/GlobeAdapter.tsx:900-917` | **not-applicable** | info | Adapter-only dev chrome. |  |
| C-30 | Selection is app state and reflected by the renderer | `world-map/AreasLayer.tsx:54,91` | `globe-adapter/GlobeAdapter.tsx:638-642` | **pass** | none | Selection is app state; the adapter reflects it in filters and rings. | GlobeAdapterChrome.test.tsx:65 |
| C-31 | Camera persistence across navigation | `world-map/useMapCamera.ts:68` | `globe-adapter/GlobeAdapter.tsx:517-530` | **pass** | none | Neither renderer persists a camera across navigation. | n/a (both absent) |
| C-32 | Resize handling | `world-map/useMapCamera.ts:288-301` | `globe-adapter/GlobeAdapter.tsx:723-746` | **pass** | none | MapLibre trackResize remains on; the host controls the container size. | n/a (MapLibre default) |
| C-33 | Initial focus on the home area/nation | `world-map/useInitialFocusArea.ts:59-74, WorldMapChart.tsx:83` | `globe-adapter/GlobeAdapter.tsx:1233-1245` | **pass** | high | initialFocusAreaId/NationId drive the opening camera at zoom 3.5. | GlobeAdapter.test.tsx:225 |
| C-34 | Panel-open memory (sessionStorage) | `components/shared/panel-memory.ts:5-18` | `globe-adapter/GlobeAdapterChrome.tsx:167-173` | **pass** | low | The controls disclosure persists in sessionStorage via panel-memory. | GlobeAdapterChrome.test.tsx:140 |
| C-35 | Build flag, default renderer, rollback and current-renderer fallback | `globe-adapter/globe-adapter-flag.ts:1-70` | `globe-adapter/MapSurface.tsx:1-104` | **pass** | none | The globe is the default renderer; `localStorage`/`?renderer=legacy`/`#legacy-renderer` force the current renderer, and init/asset/WebGL failures fall back in place. | globe-adapter-flag.test.ts; webgl-support.test.ts; packaged-smoke.mjs; globe-adapter-smoke.mjs |
| A-01 | role=application, descriptive label, key hints | `world-map/WorldMapChart.tsx:250-252` | `globe-adapter/GlobeAdapter.tsx:1258-1264` | **pass** | none | role=application with a full key-hint label. | GlobeAdapter.test.tsx:343 |
| A-02 | Per-area accessible name with ownership/fleets/strength | `world-map/layers/AreasLayer.tsx:92, map-a11y.ts:12-19` | `globe-adapter/GlobeAdapterChrome.tsx:234-244` | **pass** | high | Area buttons expose name: owner, fleet count and strength. | GlobeAdapterChrome.test.tsx:65 |
| A-03 | aria-pressed selection state per area | `world-map/layers/AreasLayer.tsx:91` | `globe-adapter/GlobeAdapterChrome.tsx:236` | **pass** | high | Area buttons expose aria-pressed selection state. | GlobeAdapterChrome.test.tsx:65 |
| A-04 | SR-only ownership data table with selected rows | `world-map/WorldMapChart.tsx:275-295` | `globe-adapter/GlobeAdapterChrome.tsx:272-292` | **pass** | high | The SR Area control table has area, owner, fleets, strength and aria-selected. | GlobeAdapterChrome.test.tsx:152 |
| A-05 | Live region for selection feedback | `world-map/RouteReadout.tsx:13-38` | `globe-adapter/GlobeAdapter.tsx:815-866,1322` | **not-applicable** | info | Area/fleet picks and route changes announce through role=status aria-live=polite; the current renderer has no live region. | GlobeAdapter.test.tsx:128; adapter-interaction.test.ts:78 |
| A-06 | Decorative map layers hidden from AT | `world-map/layers/LabelsLayer.tsx:18, MapLegend.tsx:12, MapScaleBar.tsx:44` | `globe-adapter/GlobeAdapterChrome.tsx:112-123,272-301` | **not-applicable** | info | The canvas is a single surface; decorative SVG chrome is aria-hidden where appropriate. | n/a (adapter-only structure) |
| A-07 | Reduced motion | `world-map/layers/AreasLayer.tsx:85` | `globe-adapter/GlobeAdapter.tsx:1186-1192` | **pass** | none | Keyboard pan reads prefers-reduced-motion and uses animate:false, duration:0. | GlobeAdapter.test.tsx:362 |
| A-08 | Keyboard-accessible alternative to the canvas | `world-map/AreaTreePanel.tsx:97-110` | `globe-adapter/GlobeAdapterChrome.tsx:228-267,272-292` | **pass** | high | Areas, ports and fleets are all keyboard reachable; the SR table mirrors area control. | GlobeAdapterChrome.test.tsx:65,152 |

## Implementation evidence

The 37 previously failing rows and the one blocked row are now implemented. The evidence
is grouped by implementation seam:

| Rows | Implementation | Regression evidence |
|---|---|---|
| P-01 to P-05 | MapLibre defaults, rendered-feature picking, boxZoom disabled, route readout | `GlobeAdapter.test.tsx:128`; `GlobeAdapterChrome.test.tsx:95`; `globe-audit-benchmark.mjs` |
| P-06, P-16, P-17 | Fleet selection, 6 px drag, legal/illegal drop, cancel, dragPan restore | `GlobeAdapter.test.tsx:147,175,305`; `adapter-interaction.test.ts:54-77` |
| P-08, P-09 | rAF-coalesced area hover paint and tooltip | `GlobeAdapter.test.tsx:207`; `adapter-derivations.test.ts:37` |
| P-15, C-14 to C-24 | Chrome: minimap, legend, scale, area tree/list, inspector, route readout, frame meter, centre, disclosure | `GlobeAdapterChrome.test.tsx:65-160`; `adapter-layer-state.test.ts:98-113` |
| C-03, C-04, C-05 | Reset fit, projection write-through and mapping, shared projection tips | `GlobeAdapter.test.tsx:335`; `GlobeAdapterChrome.test.tsx:76`; `adapter-layer-state.test.ts:38` |
| C-06 to C-13 | Every layer toggle plus borders and graticule | `adapter-layer-state.test.ts:19-90`; `GlobeAdapter.test.tsx:240` |
| C-25, C-27 | Host-sized root, variant layout and chrome insets | `GlobeAdapter.test.tsx:384`; `WorldMapPanel.test.tsx:18` |
| K-07, K-08, K-10, A-02, A-03, A-04, A-08 | Native area buttons, accessible names, pressed state, focus ring, SR area table | `GlobeAdapterChrome.test.tsx:65,152` |
| K-11 | MapLibre native keyboard handler disabled | `GlobeAdapter.test.tsx:141` |

Rows that remain `not-applicable` retain the audit's reason: the current renderer does
not offer that surface, so parity is undefined. Adapter-only differences are recorded
in the note column and are not counted as regressions.

The adapter is the default Overview renderer as of ADR-0327; the current renderer remains
the tested fallback.

## Not-applicable review

Each of the 13 rows was re-reviewed against the current Overview contract on the production
candidate. None is required by that contract; each is either a surface neither renderer
offers or an adapter-only enhancement.

| ID | Surface | Product rationale on the production candidate |
|---|---|---|
| P-07 | Click a port marker | The Overview contract has no port selection action; ports are informational markers. The adapter selects the port's area when the marker is clicked, which is an adapter-only enhancement. Not required. |
| P-10 | Marker hover feedback | The current renderer has no marker hover. The adapter's cursor/store feedback is optional polish; area hover and tooltips cover the required hover surface. Not required. |
| P-11 | Double-click to zoom | The current renderer has no double-click zoom. Keeping double-click disabled also avoids a selection-toggle race and preserves single-click fleet/area semantics. Not required. |
| P-12 | Right-drag rotate / context menu | The current renderer does not rotate. MapLibre's drag-rotate is adapter-only and does not replace any Overview contract surface. Not required. |
| P-13 | Shift-drag box zoom | The current renderer has no box zoom, and shift-click is the route-reading gesture the product requires. Box zoom must stay disabled to keep shift-click reachable. Not required. |
| P-14 | Touch pinch/rotate/pitch | The Overview contract is a desktop pointer/keyboard surface. MapLibre touch defaults remain adapter-only; no touch workflow is claimed. Not required for this release; revisit with a touch product decision. |
| K-09 | `n` returns bearing to north | The current renderer never rotates, so it has no north-reset action. The adapter supports it as an adapter-only control; reset (`0`) already returns the camera to the world. Not required. |
| C-01 | Explicit zoom +/- buttons | Neither renderer has explicit buttons. Wheel, keyboard (`+`/`-`) and the reset control cover the contract. Not required. |
| C-02 | Explicit pan buttons | Neither renderer has explicit pan buttons. Drag, arrow keys and the minimap cover the contract. Not required. |
| C-26 | F1 full-screen map sheet | The adapter already fills its Overview host and command layout; the legacy F1 sheet is a shell affordance for a windowed map, not an Overview contract item. Not required. |
| C-29 | Source-zoom/tile diagnostics bar | The adapter's source/overscale status is adapter-only developer chrome. The player-facing disclosure is the status/legend copy; diagnostics stay out of the contract. Not required. |
| A-05 | Live region for selection feedback | The current renderer has no live region. The adapter adds a polite route/selection announcement as an enhancement; the required accessibility path is the focusable area/entity controls and the area table. Not required, but kept because it is free and tested. |
| A-06 | Decorative layers hidden from AT | The canvas is one surface; decorative SVG chrome is `aria-hidden` where appropriate. The legacy row described a different DOM structure, so parity is undefined. The accessible controls and tables are present. Not required. |

## Packaged interaction evidence

`apps/desktop/scripts/globe-packaged-interactions.mjs` drives the packaged app and passes
15/15: keyboard zoom/pan/reset, keyboard area activation, layer toggle, both projection
directions, reset view, return north, pointer fleet selection, shift-click route reading,
hover tooltip, legal fleet drop, illegal-drop rejection, and label rendering after the
gesture pass. Reduced motion is enabled for the pass. Component tests additionally cover
pointer cancel/cleanup, back-side rejection, horizon classification and drag cancellation.
