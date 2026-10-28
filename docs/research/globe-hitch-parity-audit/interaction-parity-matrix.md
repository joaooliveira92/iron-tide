# Overview interaction-parity matrix

Scope: every interaction surface the current default Overview map offers, against the
experimental globe adapter behind `VITE_BLUEWAVE_GLOBE_ADAPTER` plus `#globe-adapter`.
The current renderer remains the default and the fallback. A row with `not-applicable`
means the current renderer does not offer the surface, so parity is undefined; adapter-only
behaviour is recorded rather than scored as a regression.

Rows: 71. Verdicts: blocked 1, fail 37, not-applicable 13, pass 19, unverified 1.

Evidence paths are relative to `apps/desktop/src/renderer/`. MapLibre evidence is the
installed dependency under `node_modules/.pnpm/maplibre-gl@6.16.0/`.

| ID | Surface | Current renderer | Adapter | Verdict | Severity | Note |
|---|---|---|---|---|---|---|
| P-01 | Drag the map to pan | `world-map/useMapCamera.ts:232-268` | `globe-adapter/GlobeAdapter.tsx:538-549` | **pass** | none | MapLibre dragPan defaults; current renderer uses a 3 px threshold. |
| P-02 | Wheel zoom at the pointer | `world-map/useMapCamera.ts:223-226` | `globe-adapter/GlobeAdapter.tsx:538-549` | **pass** | none | MapLibre scrollZoom defaults; zoom step differs. |
| P-03 | Click an area to select it | `world-map/WorldMapChart.tsx:150-154` | `globe-adapter/GlobeAdapter.tsx:645-653` | **pass** | none | Adapter queries rendered areas-fill features. |
| P-04 | Click the selected area again to clear it | `world-map/map-state.ts:55-57` | `globe-adapter/GlobeAdapter.tsx:645-653` | **pass** | none | Adapter delegates the toggle to the same onSelect controller. |
| P-05 | Shift-click two areas for a route reading | `world-map/WorldMapChart.tsx:150-153` | `globe-adapter/GlobeAdapter.tsx:637,651,676` | **blocked** | high | MapLibre boxZoom suppresses the click on shift-mouseup; the adapter never disables boxZoom. |
| P-06 | Click a fleet marker to select the fleet | `world-map/WorldMapChart.tsx:156-175` | `globe-adapter/GlobeAdapter.tsx:620-643` | **fail** | high | Adapter selects the marker's area, not the fleet; orders/onSelectFleet is never wired. Not reachable on Overview, reachable on the strategic map. |
| P-07 | Click a port marker | `world-map/layers/PortsLayer.tsx:9-41` | `globe-adapter/GlobeAdapter.tsx:620-643` | **not-applicable** | info | Current renderer has no port click; adapter selects the port's area. |
| P-08 | Hover an area to highlight it | `world-map/layers/AreasLayer.tsx:85` | `globe-adapter/GlobeAdapter.tsx:197-333,660-673` | **fail** | medium | Adapter records marker hover in the store but paints no hover state and never queries area hover. |
| P-09 | Hover tooltip / accessible area title | `world-map/layers/AreasLayer.tsx:92,101` | `globe-adapter/GlobeAdapter.tsx:248-265` | **fail** | medium | Adapter baked labels are text only; no title, tooltip or popup. |
| P-10 | Marker hover feedback | `world-map/layers/FleetsLayer.tsx:37` | `globe-adapter/GlobeAdapter.tsx:668-670` | **not-applicable** | info | Adapter-only cursor pointer; store.setHovered has no paint consumer. |
| P-11 | Double-click to zoom | `world-map/WorldMapChart.tsx:250-257` | `globe-adapter/GlobeAdapter.tsx:538-549` | **not-applicable** | low | Adapter-only MapLibre default; two click events may race the selection toggle (unverified). |
| P-12 | Right-drag rotate / context menu | `world-map/WorldMapChart.tsx:250-257` | `globe-adapter/GlobeAdapter.tsx:538-549` | **not-applicable** | low | Adapter-only MapLibre defaults; rotation risk not reviewed for parity. |
| P-13 | Shift-drag box zoom | `world-map/WorldMapChart.tsx:250-257` | `globe-adapter/GlobeAdapter.tsx:538-549` | **not-applicable** | low | Adapter-only; also the cause of P-05. |
| P-14 | Touch pinch zoom, rotate and pitch | `world-map/useMapCamera.ts:232-268` | `globe-adapter/GlobeAdapter.tsx:538-549` | **not-applicable** | low | Current renderer is single-pointer pan only. |
| P-15 | Minimap drag to recentre | `world-map/MapMinimap.tsx:107-136` | `globe-adapter/GlobeAdapter.tsx:885-988` | **fail** | medium | No minimap in the adapter render tree. |
| P-16 | Fleet pick-up and drag-to-order | `world-map/WorldMapChart.tsx:156-197` | `globe-adapter/GlobeAdapter.tsx:54-65` | **fail** | high | Adapter has no marker pointer handler; orders prop is used only for pending route geometry. Strategic map only, not Overview. |
| P-17 | Pointer capture and cancel cleanup | `world-map/WorldMapChart.tsx:166,186-188,256-257` | `globe-adapter/GlobeAdapter.tsx:538-549` | **pass** | none | Delegated to MapLibre; adapter manages no capture itself. |
| K-01 | Map is a focusable application surface | `world-map/WorldMapChart.tsx:250-252` | `globe-adapter/GlobeAdapter.tsx:893-896` | **pass** | none | Both expose role=application, tabIndex=0 and a key hint label. |
| K-02 | Arrow keys pan | `world-map/WorldMapChart.tsx:134-142` | `globe-adapter/GlobeAdapter.tsx:841-849` | **pass** | none | Adapter does not implement the current renderer's Shift acceleration. |
| K-03 | Plus/equals/minus zoom | `world-map/WorldMapChart.tsx:143-144` | `globe-adapter/GlobeAdapter.tsx:850-852` | **pass** | none | Step differs: x1.4 versus +0.5 zoom levels. |
| K-04 | Zero fits the world | `world-map/WorldMapChart.tsx:145` | `globe-adapter/GlobeAdapter.tsx:853-861` | **pass** | none | Both reset to a world camera. |
| K-05 | Escape clears selection | `world-map/WorldMapChart.tsx:128-133` | `globe-adapter/GlobeAdapter.tsx:864` | **pass** | none | Adapter only receives the key while the map div, not the entity nav, owns focus. |
| K-06 | f cycles the selected fleet and focuses it | `world-map/WorldMapChart.tsx:114-127` | `globe-adapter/GlobeAdapter.tsx:845-865` | **fail** | medium | No f handler and no fleet focus in the adapter. |
| K-07 | Tab to each area | `world-map/layers/AreasLayer.tsx:88-89` | `globe-adapter/GlobeAdapter.tsx:918-940` | **fail** | high | Canvas features are not focusable; the entity nav lists ports and fleets only. |
| K-08 | Enter/Space activates a focused area | `world-map/layers/AreasLayer.tsx:94-99` | `globe-adapter/GlobeAdapter.tsx:845-865` | **fail** | high | No per-area element or activation handler. |
| K-09 | n returns bearing to north | `world-map/WorldMapChart.tsx:250-257` | `globe-adapter/GlobeAdapter.tsx:862-863` | **not-applicable** | info | Adapter-only; the current renderer has no rotation. |
| K-10 | Visible focus ring | `world-map/layers/AreasLayer.tsx:85` | `globe-adapter/GlobeAdapter.tsx:886-988` | **fail** | medium | No focus-visible styling in the adapter; native outline behaviour unverified. |
| K-11 | MapLibre native keyboard handler | `world-map/WorldMapChart.tsx:245-257` | `node_modules/.pnpm/maplibre-gl@6.16.0/node_modules/maplibre-gl/src/ui/map.ts:4181` | **unverified** | low | Canvas container has no tabIndex; double handling of arrow keys was not observed from source. |
| C-01 | Explicit zoom +/- buttons | `world-map/MapControlsPanel.tsx:34-123` | `globe-adapter/GlobeAdapter.tsx:900-917` | **not-applicable** | info | Absent on both sides. |
| C-02 | Explicit pan buttons | `world-map/MapControlsPanel.tsx:34-123` | `globe-adapter/GlobeAdapter.tsx:900-917` | **not-applicable** | info | Absent on both sides. |
| C-03 | Reset view / fit | `world-map/MapControlsPanel.tsx:96-106` | `globe-adapter/GlobeAdapter.tsx:975-987` | **fail** | medium | Adapter resets bearing only; it does not reset centre or zoom. |
| C-04 | Projection switch | `world-map/MapControlsPanel.tsx:43-63` | `globe-adapter/GlobeAdapter.tsx:902-908` | **fail** | high | Adapter toggles globe/mercator locally and never writes app projection state; the app's Miller/equirectangular enum has no mapping. |
| C-05 | Projection explanatory tooltip | `components/ui/tip.tsx:14-42, world-map/projection.ts:33,41` | `globe-adapter/GlobeAdapter.tsx:900-917` | **fail** | low | No explanation in the adapter controls. |
| C-06 | Ownership layer toggle | `world-map/MapLayers.tsx:63-72` | `globe-adapter/GlobeAdapter.tsx:446-455` | **fail** | medium | Ownership is always painted from overlay.ownership; state.layers.ownership is unused. |
| C-07 | 1880 borders toggle and layer | `world-map/useWorldMapModel.ts:99-113, WorldMapChart.tsx:227` | `globe-adapter/GlobeAdapter.tsx:197-333` | **fail** | medium | No border source or layer in the adapter. |
| C-08 | Sea lanes toggle | `world-map/MapLayers.tsx:78, layers/LanesLayer.tsx` | `globe-adapter/GlobeAdapter.tsx:267-283,454` | **fail** | medium | Lanes are static routes gated by the routes toggle; the lanes toggle has no effect. |
| C-09 | Possessions / ports toggle | `world-map/MapLayers.tsx:86-88` | `globe-adapter/GlobeAdapter.tsx:285-304` | **fail** | medium | Port markers are always drawn. |
| C-10 | Fleets toggle | `world-map/MapLayers.tsx:90-99` | `globe-adapter/GlobeAdapter.tsx:285-304` | **fail** | medium | Fleet markers are always drawn. |
| C-11 | Labels toggle | `world-map/useWorldMapModel.ts:195-197` | `globe-adapter/GlobeAdapter.tsx:446-453` | **pass** | none | Adapter toggles area-labels-list visibility. |
| C-12 | Routes toggle | `world-map/useWorldMapModel.ts:298-307` | `globe-adapter/GlobeAdapter.tsx:454` | **pass** | none | Adapter toggles adapter-routes visibility. |
| C-13 | Graticule | `world-map/MapLayers.tsx:53, layers/GraticuleLayer.tsx` | `globe-adapter/GlobeAdapter.tsx:197-333` | **fail** | low | Always drawn in the current renderer; absent in the adapter. |
| C-14 | Centre-longitude slider | `world-map/MapControlsPanel.tsx:83-95` | `globe-adapter/GlobeAdapter.tsx:54-65` | **fail** | medium | onSetCentre and state.centre are not in the adapter props. |
| C-15 | Layers & areas disclosure | `world-map/WorldMapChart.tsx:338-350` | `globe-adapter/GlobeAdapter.tsx:900-987` | **fail** | low | No disclosure control in the adapter. |
| C-16 | Area tree panel | `world-map/WorldMapChart.tsx:366-376, components/shared/CollapsiblePanel.tsx` | `globe-adapter/GlobeAdapter.tsx:918-940` | **fail** | high | Adapter has a flat port/fleet navigation list only. |
| C-17 | Area tree modes, filter, grouping, row selection | `world-map/AreaTreePanel.tsx:42-110` | `globe-adapter/GlobeAdapter.tsx:918-940` | **fail** | medium | No area rows, modes, filter or grouping. |
| C-18 | Inline Areas details | `world-map/MapControlsPanel.tsx:113-122` | `globe-adapter/GlobeAdapter.tsx:900-987` | **fail** | low | No inline area list. |
| C-19 | Minimap | `world-map/WorldMapChart.tsx:301-312` | `globe-adapter/GlobeAdapter.tsx:885-988` | **fail** | medium | No minimap and showMinimap is not a prop. |
| C-20 | Legend and not-modelled notes | `world-map/MapLegend.tsx:9-45` | `globe-adapter/GlobeAdapter.tsx:885-988` | **fail** | medium | No legend or explicit not-modelled notes. |
| C-21 | Scale bar | `world-map/MapScaleBar.tsx:19-52` | `globe-adapter/GlobeAdapter.tsx:885-988` | **fail** | low | No ScaleControl or scale bar. |
| C-22 | Area inspector with neighbours and clear | `world-map/AreaInspector.tsx:22-71` | `globe-adapter/GlobeAdapter.tsx:885-988` | **fail** | high | No inspector; only a transient live message. |
| C-23 | Route readout numbers | `world-map/RouteReadout.tsx:22-38` | `globe-adapter/GlobeAdapter.tsx:885-988` | **fail** | high | No hops/nm/months readout, so shift-click cannot produce a reading even if P-05 is fixed. |
| C-24 | Frame-time meter | `world-map/useFrameMeter.ts:10-41` | `globe-adapter/GlobeAdapter.tsx:692-722` | **fail** | low | Only the dev diagnostics global exists. |
| C-25 | Panel size compact/large/fill | `world-map/WorldMapPanel.tsx:62-75` | `globe-adapter/GlobeAdapter.tsx:886-890` | **fail** | medium | Adapter is fixed inset-0 and ignores variant/className placement. |
| C-26 | F1 full-screen map sheet | `shell/MapSheet.tsx:13-40` | `globe-adapter/GlobeAdapter.tsx:886-890` | **not-applicable** | info | The adapter is already a full-window overlay. |
| C-27 | Dock layout and chrome insets | `world-map/map-variant-layout.ts:56-71, useMapCamera.ts:192-217` | `globe-adapter/GlobeAdapter.tsx:886-899` | **fail** | high | Adapter draws its own absolute chrome over the whole window and ignores panel insets. |
| C-28 | Coastline loading/unavailable status | `world-map/WorldMapChart.tsx:230-244` | `globe-adapter/MapSurface.tsx:11-20` | **pass** | none | Both report failure and fall back with a role=alert. |
| C-29 | Source-zoom/tile diagnostics bar | `world-map/useFrameMeter.ts:10-41` | `globe-adapter/GlobeAdapter.tsx:900-917` | **not-applicable** | info | Adapter-only dev chrome. |
| C-30 | Selection is app state and reflected by the renderer | `world-map/AreasLayer.tsx:54,91` | `globe-adapter/GlobeAdapter.tsx:465-471` | **pass** | none | Both read state.selected. |
| C-31 | Camera persistence across navigation | `world-map/useMapCamera.ts:68` | `globe-adapter/GlobeAdapter.tsx:402-403` | **pass** | none | Neither persists a camera. |
| C-32 | Resize handling | `world-map/useMapCamera.ts:288-301` | `globe-adapter/GlobeAdapter.tsx:538-549` | **pass** | none | Current clamps/resets; MapLibre trackResize defaults on. |
| C-33 | Initial focus on the home area/nation | `world-map/useInitialFocusArea.ts:59-74, WorldMapChart.tsx:83` | `globe-adapter/GlobeAdapter.tsx:54-65,402-403` | **fail** | high | Overview passes initialFocusAreaId/NationId but the adapter props drop them; camera starts at fit-world. |
| C-34 | Panel-open memory (sessionStorage) | `components/shared/panel-memory.ts:5-18` | `globe-adapter/GlobeAdapter.tsx:885-988` | **fail** | low | No collapsible panels in the adapter. |
| C-35 | Build flag, hash opt-in, current-renderer fallback | `globe-adapter/globe-adapter-flag.ts:1-25` | `globe-adapter/MapSurface.tsx:22-73` | **pass** | none | Single decision point; default build aliases the adapter to a stub. |
| A-01 | role=application, descriptive label, key hints | `world-map/WorldMapChart.tsx:250-252` | `globe-adapter/GlobeAdapter.tsx:893-894` | **pass** | none | Both present. |
| A-02 | Per-area accessible name with ownership/fleets/strength | `world-map/layers/AreasLayer.tsx:92, map-a11y.ts:12-19` | `globe-adapter/GlobeAdapter.tsx:944-962` | **fail** | high | Adapter SR table lists ports/fleets only; areas have no accessible nodes. |
| A-03 | aria-pressed selection state per area | `world-map/layers/AreasLayer.tsx:91` | `globe-adapter/GlobeAdapter.tsx:927` | **fail** | high | Only entity buttons carry aria-pressed. |
| A-04 | SR-only ownership data table with selected rows | `world-map/WorldMapChart.tsx:275-295` | `globe-adapter/GlobeAdapter.tsx:944-962` | **fail** | high | Adapter table has no area ownership, strength or selected state. |
| A-05 | Live region for selection feedback | `world-map/RouteReadout.tsx:13-38` | `globe-adapter/GlobeAdapter.tsx:639-641,941-943` | **not-applicable** | info | Adapter-only partial: announces marker picks and entity buttons, not area clicks. |
| A-06 | Decorative map layers hidden from AT | `world-map/layers/LabelsLayer.tsx:18, MapLegend.tsx:12, MapScaleBar.tsx:44` | `globe-adapter/GlobeAdapter.tsx:886-988` | **not-applicable** | info | Single canvas; nothing is exposed. |
| A-07 | Reduced motion | `world-map/layers/AreasLayer.tsx:85` | `globe-adapter/GlobeAdapter.tsx:841-844` | **pass** | none | Both honour prefers-reduced-motion. |
| A-08 | Keyboard-accessible alternative to the canvas | `world-map/AreaTreePanel.tsx:97-110` | `globe-adapter/GlobeAdapter.tsx:918-940` | **fail** | high | Entity nav is a partial substitute; areas are missing. |

## Confirmed defects that need a child issue

- **P-05 shift-click route reading:** blocked by MapLibre `boxZoom`; the same shift-mouseup
  suppresses the adapter click. This is a narrow, proven cause, but a route readout (C-23) is
  also missing, so the interaction is not complete after unblocking it.
- **P-06 fleet selection and P-16 fleet drag-to-order:** the adapter selects a marker's area,
  not the fleet, and has no marker pointer handler. Orders are only pending route geometry.
- **P-08/P-09 hover:** marker hover is recorded in the store but never painted; area hover and
  tooltips have no adapter implementation.
- **C-06 to C-10, C-13 layer parity:** only labels and routes are honoured. Ownership, borders,
  lanes (gated by routes), possessions and fleets are not; borders and the graticule have no
  layer at all.
- **C-14 to C-27 chrome and panels:** no centre slider, area tree, minimap, legend, scale bar,
  inspector, route readout, frame meter, panel sizing or dock-inset layout.
- **A-02 to A-04, K-07/K-08:** no per-area accessible node, no artefact for area selection,
  and no keyboard path to an area.
- **C-33 initial focus:** `initialFocusAreaId` and `initialFocusNationId` are passed by
  Overview and dropped by the adapter; the camera always starts at fit-world.
- **C-04 projection state:** the adapter's globe/mercator toggle is local-only and has no
  mapping to the app's Miller/equirectangular projection state.

## Areas that are already at parity

Pan, wheel zoom, area selection and toggle, keyboard pan/zoom/fit, label and route toggles,
selection as app state, failure status/fallback, the flag and hash gate, reduced motion, and
the basic application role and key hints.

## Test coverage gap

The adapter has no component test for `GlobeAdapter.tsx`, `MapSurface.tsx` or
`GlobeAdapterHost.tsx`. The packaged smoke asserts that the keyboard surface and entity nav
exist, not that a key or click does anything. The current renderer has component tests for
keyboard focus, area roles and layer/legend rendering, but no end-to-end wheel, drag, click or
shift-click test. See the parity section of `README.md` for the dispositions.
