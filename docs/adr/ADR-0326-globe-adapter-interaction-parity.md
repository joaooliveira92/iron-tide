# ADR-0326: Globe adapter interaction parity and projection mapping

Applies to: desktop

## Status

Accepted for the experimental globe adapter (2026-10-28). The adapter remains
disabled by default; the current Overview renderer remains the default and the
failure fallback. This ADR does not approve production enablement, merge or release.

## Context

ADR-0325 defined the overlay and camera boundary but left the Overview interaction
surface unmapped. The audit in #341 found 37 failing parity rows plus one blocked
shift-click row: no route readout, no fleet orders, no hover, five ignored layer
toggles, missing chrome, local-only projection state and no per-area keyboard or
screen-reader path. Two decisions could otherwise drift: how the adapter's
globe/mercator camera corresponds to the application's Miller/equirectangular
`ProjectionId`, and where static lanes and routes are separated.

## Decision

- The adapter consumes the existing `MapViewProps` callbacks. It does not own
  selection, layer, projection, centre or order state. Orders are handed to
  `MapOrders.onDrop` only after the shared `resolveDrop` contract accepts a
  destination.
- The projection mapping is **globe → `miller`, mercator → `equirectangular`**.
  It preserves the application projection state; it is not a claim that a
  cylindrical MapLibre projection reproduces the planar Miller camera exactly.
- Static sea lanes and dynamic routes share the overlay route source but carry an
  explicit `overlayClass` (`lane` or `route`). The lanes and routes toggles filter
  their own class; they do not toggle each other.
- Every Overview layer toggle maps to its own layer, filter or paint change. Area
  fills stay rendered at reduced opacity when ownership is off so rendered-feature
  picking continues to work.
- Hover uses rendered-feature queries and a per-area filter, not projected proximity
  or feature-state promotion. The horizon classifier remains the authority for
  globe-side visibility.
- Areas, ports and fleets are exposed as native buttons with ownership, fleet and
  strength in the accessible name; the screen-reader table repeats the same data.
  MapLibre types never enter these contracts.
- The adapter fills its host container and honours the map variant and
  `--chrome-*` insets. It is not a fixed full-window surface.

## Consequences

- The adapter can be reviewed as a drop-in surface behind the existing flag without
  changing the default renderer or fallback.
- The projection mapping is an explicit, testable limitation rather than an
  accidental mismatch.
- Packaged pointer/keyboard smoke and axe/manual screen-reader evidence are still
  required before any enablement decision.
