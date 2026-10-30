# ADR-0327: Globe overview production enablement

Applies to: desktop

## Status

Superseded by: ADR-0344

Accepted (2026-10-28). The globe adapter is the default Overview renderer. The
current SVG Overview renderer remains a tested, supported rollback path.

## Context

ADR-0325 defined the globe adapter and overlay contract and ADR-0326 completed
interaction parity. Both deliberately left the adapter disabled by default and
required packaged pointer/keyboard evidence, accessibility evidence, lifecycle
bounds, a performance budget and a production activation path before enablement.

The production candidate uses the Natural Earth 10m land, minor-island and
canal-centreline sources baked at z0-z7 into a 5.68 MB offline tile pack
(`2b7b264e...`). It does not use OpenStreetMap-derived data or GSHHG. Natural
Earth is public domain; the pack and its licence notices ship with the app. The
Inter glyph SDFs are a derivative of the repository's Inter font under the SIL
Open Font License, with its licence text shipped beside them.

The historic 50-83 ms zoom-out hitch could not be reproduced for the globe on the
available Apple M4. The same benchmark measured 66.7 ms zoom frames in the
current SVG renderer and 84.3 ms globe frames under controlled CPU contention.
The hitch is cross-renderer frame pacing, not a globe-specific regression.

## Decision

- The globe adapter is the default Overview renderer whenever the app build
  includes it. The build includes it by default; only an explicit
  `VITE_BLUEWAVE_GLOBE_ADAPTER=false` build omits it. The separate Strategic Map
  screen keeps the SVG renderer in this release.
- Activation is not tied to a URL hash. `#globe-renderer` and `#legacy-renderer`
  remain development overrides; production rollback is selected with
  `localStorage["bluewave.overviewRenderer"] = "legacy"` or
  `?renderer=legacy`. No network feature flag exists.
- Initialization failure, a missing or corrupt asset pack, an unavailable map
  container and unsupported WebGL all switch to the current SVG renderer in the
  same mount. The adapter is not retried; no retry loop is possible.
- Fallback reason and the active renderer are recorded as structured renderer
  diagnostics (`window.__bluewaveRendererDiagnostics`, `data-overview-renderer`
  and `data-overview-renderer-fallback` on the document element) and logged.
- Camera, selection, layer, projection and order state stay in the existing
  application state. Switching renderers neither migrates saved state nor
  requires reinstalling map data.
- Production runtime assets are committed under `apps/desktop/map-assets/`
  (tile pack, manifest, Natural Earth notices, Inter SDFs, OFL). Raw sources,
  the download cache, bake inputs and harness-only validation files are excluded
  from the package by the default guard, which also verifies the pack SHA-256.
- The z7 source ceiling is the honest detail limit. Zooming deeper overscales the
  same tiles; the renderer labels that state (`source z7 ... overscaled`) and the
  status bar reports the source level. The product does not claim z12 geographic
  accuracy.
- Lifecycle acceptance uses explicit ceilings: 600 retained listeners, 900
  detached nodes, live DOM back to baseline, zero surviving workers and 32 MB
  heap after five open-close cycles. The retained nodes are the detached React
  chrome/accessibility mirror and MapLibre/harness listeners; they are bounded
  and flat across cycles.
- Frame budget for a clean three-run packaged benchmark: refresh >= 55 Hz, idle
  p95 <= 34 ms, pan max <= 50 ms, zoom-in p95 <= 34 ms and max <= 100 ms,
  zoom-out p95 <= 34 ms and max <= 50 ms, zero zoom-out long tasks, settle
  <= 100 ms. The zoom-in maximum admits one first-use shader/tile warm-up frame;
  steady runs measured 17.7 ms in the same window.
- Supported release platforms remain macOS, Windows and Linux, matching the
  repository release workflow. The packaged default is exercised graphically on
  macOS and by build/package/guard checks on the other platforms in CI. WebGL
  capability detection is the first fallback on any platform.
- A future higher-resolution dataset (including OSM-derived tiles or GSHHG)
  requires a separate legal, licensing and pack-size decision. This ADR approves
  only Natural Earth z7 for the current scope.

## Consequences

- Players get the globe Overview with the same selection, route, fleet, layer,
  keyboard and screen-reader workflows as the SVG renderer.
- Rollback is a local configuration change; it does not invalidate saves or
  require a download.
- The package grows by the pack, manifest, licence notices and three glyph
  ranges, all covered by the default guard's allow-list and integrity check.
- The z7 ceiling and overscaling disclosure are visible, not inferred.
- Additional GPU/hardware combinations and native screen-reader combinations
  remain post-release validation, not hidden claims.

## Conditions for revisiting

Revisit if a reproducible globe-specific frame-time regression exceeds the
budget across clean runs; if WebGL fallback is shown to corrupt state; if the
package guard cannot account for a new runtime asset; or if a higher-resolution
dataset is proposed with a completed legal and technical decision.
