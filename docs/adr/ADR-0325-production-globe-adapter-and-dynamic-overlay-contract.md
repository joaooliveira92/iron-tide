# ADR-0325: Production globe adapter and dynamic overlay contract

Applies to: desktop

## Status

Accepted for the Phase 0/1 experimental adapter (2026-10-28); not approved as the default
Overview renderer, for production enablement, for merge, or for release. The adapter remains
behind a build-time flag that is off by default.

## Context

The hybrid globe investigation had a working spike but no production-shaped boundary. The
spike prepared area labels, markers and routes as small runtime GeoJSON collections, exposed
MapLibre objects directly to its component, and had no versioned camera contract, tile policy or
pointer-visibility authority. G-03a baked the 36 sea-area outlines, but labels, markers and
routes still used runtime GeoJSON. G-06 needed a replaceable tile hierarchy, and G-07 needed an
adapter that could consume application data without making the globe the default renderer.

The application already exposes renderer-neutral campaign data through `LiveWorldMapOverlay`,
`MapPrototypeState`, `RouteReading` and `MapOrders`. The production contract must build on those
values and keep MapLibre private to the adapter.

## Decision

- Area-label geometry and stable identity are baked into the offline pack as an `area_labels`
  vector layer. Localized or mutable text is resolved by the renderer from the stable area id;
  it is not baked. The pack manifest records the label count, source hash, layer, anchor
  tolerance and stable-identity rule.
- Markers and routes are dynamic presentation state, never geographic tile content. They flow
  through a renderer-neutral overlay contract with stable ids, explicit kinds, batch changes,
  selection, hover, visibility, route replacement, cancellation and disposal. A marker update
  touches one feature. A route replacement diffs only route features. Dynamic unit state is
  never written into static tiles.
- Route features declare their edge semantics explicitly (`lonlat-linear`, `great-circle` or
  `rhumb`). The application's area-anchor routes use `lonlat-linear`; the adapter unwraps the
  antimeridian and densifies the other semantics rather than treating them as interchangeable.
- MapLibre source and layer operations live only in the adapter. Overlay contracts, tile policy,
  camera conversion, pointer visibility and projection logic carry no MapLibre types.
- Tile policy is versioned and separate from display zoom. The approved Natural Earth source
  ceiling is z7; deeper display zoom is explicitly overscaled, with no synthetic detail. The
  policy declares tile extent, buffer, levels, label/protected thresholds, cache and in-flight
  budgets, visible-tile cap and a cache version derived from the pack SHA-256. A manifest whose
  zoom range or extent disagrees with the policy is rejected.
- Tile selection is deterministic for a fixed camera, viewport, DPR, pack and policy. It wraps
  across the antimeridian, clamps high-latitude rows, and never invents a level above the
  source ceiling. The adapter keeps the logical pack shared by globe and Mercator modes.
- Camera state crosses the boundary through a versioned application contract (centre, zoom,
  bearing, pitch, projection). Raw MapLibre camera internals are not authoritative state.
  Unknown versions decode to no state rather than guessing.
- Pointer selection uses rendered feature hits plus the horizon classifier, not `project()`
  proximity. A back-side or unrendered entity cannot be selected. The horizon class has
  hysteresis at the boundary. The 14 near-side `project()` misses in the 1,440-marker fixture
  are excluded by design.
- Adapter lifecycle is registered through a disposal registry. Event handlers, subscriptions,
  animation frames, protocol registration, the overlay store, tile cache, map and API global are
  disposed in reverse registration order. Repeated open-close cycles must not grow live DOM or
  listeners; a constant post-close footprint attributable to the harness and MapLibre globals is
  recorded rather than hidden.
- The adapter is enabled only by the `VITE_BLUEWAVE_GLOBE_ADAPTER` build flag plus an explicit
  `#globe-adapter` hash. The default build aliases the adapter entry to an inert stub and the
  package guard rejects the real adapter chunk and map assets. The current Overview renderer
  remains the default and the initialization-failure fallback.
- A failed, missing or corrupt pack, a failed map construction, or a failed renderer health check
  reports a structured reason, disposes partial resources and falls back to the current
  renderer. There is no retry loop and no camera or selection write-back on failure.

## Consequences

- The overlay contract can be tested without a GPU and the adapter can be replaced without
  touching application state.
- Baked labels remove source-wide label preparation from the runtime; markers and routes remain
  dynamic by design, with incremental updates measured on a 1,000-marker scene.
- A future legally approved higher-resolution pack can change the source ceiling and pack hash
  behind the same policy and adapter interfaces, without changing domain coordinates.
- The adapter remains experimental. Cross-GPU behaviour, Windows/Linux packaged validation,
  legal approval for higher-resolution data, direct Fleet the Waves 3 comparison and the
  historical zoom-out hitch remain open release blockers.
- The adapter does not make the globe the default, does not replace the current Overview renderer
  and does not authorize Phase 2 or production migration.
