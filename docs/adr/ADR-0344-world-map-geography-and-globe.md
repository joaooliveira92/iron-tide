# ADR-0344: World map geography, data pipeline and globe rendering

Consolidates: ADR-0244, ADR-0323, ADR-0324, ADR-0325, ADR-0326, ADR-0327, ADR-0329

Applies to: desktop

Rule: The world map is an offline, deterministic geography pipeline (Natural Earth 10m and Koppen-Geiger V3 sources, z7 source ceiling, EPSG:3857 tile pack at manifestVersion 4) feeding a production globe adapter that is the default Overview renderer with a tested SVG fallback, a renderer-neutral overlay contract, and no simulation-state authority.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0244
Supersedes: ADR-0323
Supersedes: ADR-0324
Supersedes: ADR-0325
Supersedes: ADR-0326
Supersedes: ADR-0327
Supersedes: ADR-0329

## Context

Seven previous ADRs defined the world map's geography sources, nation borders, climate overlay, protected-feature catalogue, edge semantics, offline tiling, globe adapter contract, interaction parity and production enablement. They were recorded sequentially as the investigation spike and production migration progressed and now overlap in scope, source pins and rules. This record consolidates them into one authoritative reference.

The world map evolved from a coarse SVG Overview to a hybrid globe powered by an offline tile pack. Natural Earth 10m land provides the coastline, clipped to nation borders from the 1880 historical-basemaps outline and overlaid with climate zones from Koppen-Geiger V3. Canals and narrow straits are tracked as protected rendering overlays; OSM and GSHHG remain excluded pending legal review. Edge semantics are WGS84 lon/lat with lonlat-linear interpolation, densified before projection, and baked into EPSG:3857 tiles at z0-z7 with a declared source ceiling of z7. The globe adapter matured through a renderer-neutral overlay contract, interaction parity with the Overview surface, and production enablement as the default renderer. The SVG renderer remains the tested rollback path. Nation borders and climate zones are author-time presentation data that the engine never reads.

## Rules

### 1. Geographic sources

Natural Earth 10m land, minor islands and the Suez/Panama river centrelines are the only approved geographic source for the bake. The archives are pinned by URL, version and SHA-256 in `apps/desktop/map-data/sources.v1.json`; only public-domain data enters the pack. Climate zones use Koppen-Geiger V3 (Beck et al., 2023), period 1991-2020, the 0.1 degree GeoTIFF from Figshare record 10.6084/m9.figshare.21789074, CC BY 4.0, pinned in `map-data/climate-zones.v1.json`.

OSM-derived data remains excluded pending legal review of ODbL as it applies to tiles bundled in software (G-01a). GSHHG remains excluded pending written clarification of its licence (G-01b). Corinth and Kiel are Bluewave-authored schematic lines; they must not be described as verified geography. A future approved higher-resolution dataset replaces or augments these sources by changing the pinned sources, pipeline limits, expected-output hashes and this record.

### 2. Source ceiling and honest detail

The honest visual-detail ceiling is z7. `tileMaxZoom` and `fitForPurposeMaxZoom` are recorded as separate manifest fields. Above z7 the renderer overscales to `overscaleMaxZoom` 12 and the HUD states `coast detail limited to z7`. Overscaling never raises the declared source detail. The product does not claim z12 geographic accuracy.

### 3. Protected features

The 13-feature catalogue (`protected-features.v1.json`) carries canals, straits and narrows as rendering overlays only. Every entry declares `displayOnly` true and `simulationNavigabilityImplicated` false. Routes and navigability stay in authored content; simulation coordinates and save formats are untouched. Canal geometry above z7 needs a larger-scale approved source (G-04d); at z7 the overlay keeps about 3 px of quantisation at z12.5, acceptable for the strategic map and not acceptable for a surveyed canal. Schematic geometry (Corinth and Kiel) is explicitly disclosed investigation data, not verified geography.

### 4. Edge semantics and coordinate system

Source coordinates are WGS84 longitude/latitude. Every source edge is `lonlat-linear`; the protected catalogue and area-outline specification accept no other value and reject omitted, `mercator-linear`, `great-circle`, `rhumb`, `mixed` or empty semantics with a named error. Mixed semantics inside one geometry are not supported.

Densification runs in preprocessing, before any projection-specific rendering. Land edges use a 25 m tolerance and sea-area outlines 10 m. The helper preserves original endpoints, takes the short way across the antimeridian, orders an edge canonically so an edge and its reverse produce the same vertices, is idempotent, removes consecutive duplicates, preserves ring closure and orientation, and bounds subdivision growth.

An antimeridian crossing is represented by unwrapped longitude (for example 255 degrees) rather than by an edge of 180 degrees or more. The tiler splits the ring into tile-local pieces; source edges at or beyond 180 degrees are rejected as ambiguous.

### 5. Nation borders

Nation borders are baked at author time by `bake-borders.ts`, which clips each nation's 1880 outline (about 220 points for Germany) to the map's own coastline (`coastline-data.ts`, about 376k points). Per nation: `(coarse ∩ land) ∪ ((coarse grown by 0.3 degrees ∩ land) − every other 1880 polygon)`. The growth reaches the real shore where the outline stops short; subtracting other polygons keeps it from moving any frontier with a neighbour. Inland frontiers stay as coarse as the source.

The bake runs at author time only. The clipper (`polygon-clipping`) and `tsx` are installed in a scratch directory outside the repo and are not project dependencies; the GeoJSON is untrusted input passed by path. Clipper failures on near-coincident edges are retried with inputs snapped to a coarser grid (never coarser than 0.001 degrees, a tenth of the 0.01 degree output grid), which is deterministic. Output is encoded with `lib/coastline-codec.ts` per nation and base64'd; `BORDERS_1880` keeps its shape. The canvas simplifies borders per zoom tier with the land's tolerances.

Provenance: the source is GPL-3.0 and, by its own caveat, work in progress at world scale. The baked file is presentation only; the engine never reads it, and the data is not used for any authoritative outcome. A coastline rebake must be followed by a border rebake (a test guards the drift).

### 6. Climate zones

Land climate zones are baked at author time by `bake-climate.ts` from Koppen-Geiger V3. The 30 Koppen classes are reclassified into 7 presentation zones (tropical wet, tropical seasonal, arid, semi-arid, temperate, cold, polar). Only the zone id is stored.

The bake fills raster no-data from neighbours, smooths each zone, vectorises it, and clips each polygon against the Natural Earth land and minor islands, retrying with inputs snapped to a coarser grid (never coarser than 0.002 degrees) on clipper failure. `geotiff`, `d3-contour` and `polygon-clipping` are installed in a scratch directory and are not project dependencies. Output is committed as `map-data/climate-zones.v1.bin` (delta varints, 0.01 degree grid) with a JSON provenance sidecar. The normal build never downloads the raster.

The map-data pipeline tiles the zones as the `climate` layer with a `zone` property, in the same pack as the land. The manifest gains `layers.climate`, a `climate` provenance block, `manifestVersion` 4, and an attribution that credits the dataset. The configuration hash covers the climate provenance. The renderer colours land by zone under the coastline stroke; the map legend carries the attribution, and the licence notice ships in `licences/`.

Climate geometry is simplified at 1.5 tile pixels (`climateSimplificationPixels`) against the land's 0.35 to keep pack growth down. Zone edges are the 0.1 degree source, smoothed, so they are broad climate shading, not a vegetation survey. The pack grows from 5.68 MB to 9.11 MB; a test pins that adding climate zones leaves the land layer's decoded tiles unchanged. The data is presentation only; no authoritative outcome reads it.

### 7. Offline tile pack

Tiles are EPSG:3857 from z0 through z7, extent 4096, buffer 64. Area fills and outlines carry stable ids and the area's stable ordinal. Clipping produces open line pieces without invented closing edges. Continuity is measured across every shared tile edge, and the neighbour-crack check distinguishes exact shared edges, collinear partial overlaps, near-adjacent independent outlines and real cracks instead of claiming topological sharing that the source does not have.

Protected-feature validation constrains simplification: sealing is detected before simplification, a sealed passage injects the catalogue fallback or fails, and land vertices in a corridor around an open passage may be pinned. Pinning is insurance at the shipped 0.35 px tolerance, where validation also passes without it; at 2 px and 4 px it prevents the closures the validator detects.

Build-time tiling produces the offline pack. Coastline, sea-area outlines (36), area labels and the climate layer are baked. Markers and routes remain dynamic runtime state. Schemas are versioned explicitly: the pack format is `bluewave-tilepack-1`; the manifest is `manifestVersion` 4 (added climate provenance); the pipeline is `1.2.0` (amended for baked area labels); the area-outline dataset is `1.0.0`; the protected catalogue is version 1. The loader rejects an older manifest version and a manifest whose area outlines do not declare `lonlat-linear` semantics.

Deterministic output is verified, not assumed. Two clean bakes in one process are byte-identical, and a bake in a fresh process matches the committed `expected-output.v1.json` pack hash. The bake writes no wall-clock value, uses canonical JSON and fixed input hashes, records the toolchain, and emits per-file and per-level SHA-256. A toolchain or source change that alters bytes requires a deliberate re-pin.

Integrity failures are explicit. A missing pack, a corrupt pack, a stale hash and a per-tile CRC failure are reported and surfaced; the adapter falls back to the SVG renderer with a visible alert. Globe and Mercator modes consume the same logical offline pack. Projection is a renderer choice; the pack does not fork per projection.

### 8. Globe adapter and overlay contract

MapLibre source and layer operations live only in the adapter. Overlay contracts, tile policy, camera conversion, pointer visibility and projection logic carry no MapLibre types.

Area-label geometry and stable identity are baked into the offline pack as an `area_labels` vector layer. Localized or mutable text is resolved by the renderer from the stable area id; it is not baked. The pack manifest records the label count, source hash, layer, anchor tolerance and stable-identity rule.

Markers and routes are dynamic presentation state, never geographic tile content. They flow through a renderer-neutral overlay contract with stable ids, explicit kinds, batch changes, selection, hover, visibility, route replacement, cancellation and disposal. A marker update touches one feature; a route replacement diffs only route features. Dynamic unit state is never written into static tiles.

Route features declare their edge semantics explicitly (`lonlat-linear`, `great-circle` or `rhumb`). The application's area-anchor routes use `lonlat-linear`; the adapter unwraps the antimeridian and densifies the other semantics rather than treating them as interchangeable.

Tile policy is versioned and separate from display zoom. The approved Natural Earth source ceiling is z7; deeper display zoom is explicitly overscaled, with no synthetic detail. The policy declares tile extent, buffer, levels, label/protected thresholds, cache and in-flight budgets, visible-tile cap and a cache version derived from the pack SHA-256. A manifest whose zoom range or extent disagrees with the policy is rejected. Tile selection is deterministic for a fixed camera, viewport, DPR, pack and policy. It wraps across the antimeridian, clamps high-latitude rows, and never invents a level above the source ceiling.

Camera state crosses the boundary through a versioned application contract (centre, zoom, bearing, pitch, projection). Raw MapLibre camera internals are not authoritative state. Unknown versions decode to no state rather than guessing.

Pointer selection uses rendered feature hits plus the horizon classifier, not `project()` proximity. A back-side or unrendered entity cannot be selected. The horizon class has hysteresis at the boundary. The 14 near-side `project()` misses in the 1,440-marker fixture are excluded by design.

Adapter lifecycle is registered through a disposal registry. Event handlers, subscriptions, animation frames, protocol registration, the overlay store, tile cache, map and API global are disposed in reverse registration order. Repeated open-close cycles must not grow live DOM or listeners; a constant post-close footprint attributable to the harness and MapLibre globals is recorded rather than hidden.

### 9. Interaction parity

The adapter consumes the existing `MapViewProps` callbacks. It does not own selection, layer, projection, centre or order state. Orders are handed to `MapOrders.onDrop` only after the shared `resolveDrop` contract accepts a destination.

Projection mapping: globe -> `miller`, mercator -> `equirectangular`. It preserves the application projection state; it is not a claim that a cylindrical MapLibre projection reproduces the planar Miller camera exactly.

Static sea lanes and dynamic routes share the overlay route source but carry an explicit `overlayClass` (`lane` or `route`). The lanes and routes toggles filter their own class; they do not toggle each other. Every Overview layer toggle maps to its own layer, filter or paint change. Area fills stay rendered at reduced opacity when ownership is off so rendered-feature picking continues to work.

Hover uses rendered-feature queries and a per-area filter, not projected proximity or feature-state promotion. The horizon classifier remains the authority for globe-side visibility. Areas, ports and fleets are exposed as native buttons with ownership, fleet and strength in the accessible name; the screen-reader table repeats the same data. MapLibre types never enter these contracts. The adapter fills its host container and honours the map variant and `--chrome-*` insets; it is not a fixed full-window surface.

### 10. Production enablement and rollback

The globe adapter is the default Overview renderer whenever the app build includes it. The build includes it by default; only an explicit `VITE_BLUEWAVE_GLOBE_ADAPTER=false` build omits it. The SVG Overview renderer remains a tested, supported rollback path. The separate Strategic Map screen keeps the SVG renderer in this release.

Activation is not tied to a URL hash. `#globe-renderer` and `#legacy-renderer` remain development overrides; production rollback is selected with `localStorage["bluewave.overviewRenderer"] = "legacy"` or `?renderer=legacy`. No network feature flag exists.

Initialization failure, a missing or corrupt asset pack, an unavailable map container and unsupported WebGL all switch to the SVG renderer in the same mount. The adapter is not retried; no retry loop is possible. Fallback reason and the active renderer are recorded as structured diagnostics (`window.__bluewaveRendererDiagnostics`, `data-overview-renderer` and `data-overview-renderer-fallback` on the document element) and logged.

Camera, selection, layer, projection and order state stay in existing application state. Switching renderers neither migrates saved state nor requires reinstalling map data.

Production runtime assets are committed under `apps/desktop/map-assets/` (tile pack, manifest, Natural Earth notices, Inter SDFs, OFL). Raw sources, the download cache, bake inputs and harness-only validation files are excluded from the package by the default guard, which also verifies the pack SHA-256.

Lifecycle acceptance uses explicit ceilings: 600 retained listeners, 900 detached nodes, live DOM back to baseline, zero surviving workers and 32 MB heap after five open-close cycles. The retained nodes are the detached React chrome/accessibility mirror and MapLibre/harness listeners; they are bounded and flat across cycles.

Frame budget for a clean three-run packaged benchmark: refresh >= 55 Hz, idle p95 <= 34 ms, pan max <= 50 ms, zoom-in p95 <= 34 ms and max <= 100 ms, zoom-out p95 <= 34 ms and max <= 50 ms, zero zoom-out long tasks, settle <= 100 ms. The zoom-in maximum admits one first-use shader/tile warm-up frame; steady runs measured 17.7 ms in the same window.

Supported release platforms are macOS, Windows and Linux, matching the repository release workflow. The packaged default is exercised graphically on macOS and by build/package/guard checks on the other platforms in CI. WebGL capability detection is the first fallback on any platform.

### 11. Presentation-only boundary

Map data (nation borders, climate zones, protected features) feeds the renderer. No map data enters simulation state, save formats, or authoritative outcomes. Nation borders are presentation only; the engine never reads them. Climate zones are presentation only; no authoritative outcome reads them. Protected features declare `displayOnly` true and `simulationNavigabilityImplicated` false. Domain coordinates stay renderer-independent; MapLibre types, layer specifications and protocol handlers stay in the renderer spike.

### 12. Conditions for revisiting

Revisit if a reproducible globe-specific frame-time regression exceeds the budget across clean runs; if WebGL fallback is shown to corrupt state; if the package guard cannot account for a new runtime asset; or if a higher-resolution dataset is proposed with a completed legal and technical decision.

## Consequences

- The map ships an honest, offline, public-domain geography foundation with a visible source ceiling and a tested SVG fallback path.
- The tile pack is a pure function of pinned sources, configuration, catalogue, area specification and toolchain; review compares hashes instead of inspecting tiles by eye.
- Adding a dataset or changing edge semantics is a schema and ADR change, not a renderer tweak.
- The overlay contract can be tested without a GPU; the adapter can be replaced without touching application state.
- Baked labels remove source-wide label preparation from the runtime; markers and routes remain dynamic by design with incremental updates.
- Players get the globe Overview with the same selection, route, fleet, layer, keyboard and screen-reader workflows as the SVG renderer.
- Rollback is a local configuration change; it does not invalidate saves or require a download.
- The package grows by the pack, manifest, licence notices and three glyph ranges, all covered by the default guard's allow-list and integrity check.
- A future legally approved higher-resolution pack can change the source ceiling and pack hash behind the same policy and adapter interfaces, without changing domain coordinates.
- Tactical-zoom quality, verified Corinth/Kiel geometry, OSM-derived data and GSHHG remain open pending legal and technical decisions.
- Additional GPU/hardware and native screen-reader combinations remain post-release validation, not hidden claims.