# ADR-0324: Edge semantics, offline tiling and renderer boundaries

Applies to: desktop

## Status

Accepted for the Phase 0/1 investigation spike (2026-10-27); not approved for production migration or as the default Overview renderer. The pack remains behind the globe-spike build flag.

## Context

The hybrid globe initially tiled its 36 sea-area outlines in the renderer at runtime. That left
two incompatible interpretations of one edge (longitude/latitude-linear and Mercator-linear), a
startup cost that grew with the source, and a risk that renderer objects would leak into domain
state. The protected-feature catalogue needed a single edge interpretation because corridor
checks, transects and pinning all reason about source vertices. The tile bake needed byte-stable
output so that a changed pack always means a changed input.

The spike uses MapLibre GL JS in both globe and Mercator projections. The bake emits ordinary
Mapbox Vector Tiles; MapLibre is a consumer, not a dependency of the data or domain layers.

## Decision

- Source coordinates are WGS84 longitude/latitude and every source edge is `lonlat-linear`.
  The protected catalogue and the area-outline specification accept no other value and reject
  an omitted, `mercator-linear`, `great-circle`, `rhumb`, `mixed` or empty semantics with a named
  error. Mixed semantics inside one geometry are not supported.
- Densification runs in preprocessing, before any projection-specific rendering. Land edges use
  a 25 m tolerance and sea-area outlines 10 m. The tested helper preserves original endpoints,
  takes the short way across the antimeridian, orders an edge canonically so an edge and its
  reverse produce the same vertices, is idempotent, removes consecutive duplicates, preserves
  ring closure and orientation, and bounds subdivision growth.
- An antimeridian crossing is represented by unwrapped longitude (for example 255 degrees)
  rather than by an edge of 180 degrees or more. The tiler splits the ring into tile-local
  pieces; source edges at or beyond 180 degrees are rejected as ambiguous.
- Tiles are EPSG:3857 from z0 through z7, extent 4096, buffer 64. Area fills and outlines carry
  stable ids and the area's stable ordinal. Clipping produces open line pieces without invented
  closing edges. Continuity is measured across every shared tile edge, and the neighbour-crack
  check distinguishes exact shared edges, collinear partial overlaps, near-adjacent independent
  outlines and real cracks instead of claiming topological sharing that the source does not have.
- Protected-feature validation constrains simplification: sealing is detected before
  simplification, a sealed passage injects the catalogue fallback or fails, and land vertices in
  a corridor around an open passage may be pinned. Pinning is insurance at the shipped 0.35 px
  tolerance, where validation also passes without it; at 2 px and 4 px it prevents the closures
  the validator detects.
- Domain coordinates stay renderer-independent. MapLibre types, layer specifications and
  protocol handlers stay in the renderer spike. The bake and its schemas emit plain arrays,
  GeoJSON features and vector tiles; no MapLibre object enters domain state, simulation
  coordinates or a save format.
- Build-time tiling is preferred to runtime source-wide tiling. Coastline and, since G-03a, the
  36 sea-area outlines are baked into the offline pack. Area labels, markers and routes are
  still small runtime GeoJSON sources in the spike; that remaining gap is a known limitation,
  not a claim that all runtime tiling is gone. No runtime step downloads, tiles or hashes with
  an external tool.
- Globe and Mercator modes consume the same logical offline pack. Projection is a renderer
  choice; the pack does not fork per projection. The same ids, attributes and geometry feed
  both modes, so a feature does not change identity at the transition.
- Schemas are versioned explicitly. The pack format is `bluewave-tilepack-1`; the manifest is
  `manifestVersion` 2 (it added the area-outline block); the pipeline is `1.1.0`; the
  area-outline dataset is `1.0.0`; the protected catalogue is version 1. The loader rejects an
  older manifest version and a manifest whose area outlines do not declare `lonlat-linear`
  semantics. Compatibility is never inferred.
- Deterministic output is verified, not assumed. Two clean bakes in one process are
  byte-identical, and a bake in a fresh process matches the committed
  `expected-output.v1.json` pack hash. The bake writes no wall-clock value, uses canonical JSON
  and fixed input hashes, records the toolchain, and emits per-file and per-level SHA-256.
  A toolchain or source change that alters bytes requires a deliberate re-pin.
- Integrity failures are explicit. A missing pack, a corrupt pack, a stale hash and a per-tile
  CRC failure are reported and surfaced; the spike falls back to runtime tiling with a visible
  alert rather than rendering silently wrong geography.
- Rejected alternatives: implicit Mercator or great-circle edges; runtime source-wide tiling as
  the production path; moving MapLibre types into domain state; separate globe and planar packs;
  compressed tile bytes whose platform compressor could change the hash; and hiding a corrupt
  pack behind a blank canvas.

## Consequences

- The pack is a pure function of pinned sources, configuration, catalogue, area specification
  and toolchain, so review can compare hashes instead of inspecting tiles by eye.
- Adding a dataset or changing edge semantics is a schema and ADR change, not a renderer tweak.
- The spike still carries runtime GeoJSON for markers and routes (area labels are baked by the
  amendment below), and the map remains behind the flag. This record does not authorize Phase 2,
  a production adapter or a default renderer switch.
- Cross-operating-system byte identity and the remaining cross-GPU, platform and hit-testing
  evidence are still unverified and stay on the Phase 0/1 decision's condition list.

## Amendment: G-03c baked area labels (2026-10-28)

The G-03c implementation adds a baked `area_labels` vector layer to the same pack. The pack
format remains `bluewave-tilepack-1`; the manifest moves to `manifestVersion` 3 and the pipeline
to `1.2.0` so a reader cannot mistake a label-bearing pack for the earlier schema. Label
features carry the stable area id and anchor; localized or mutable text is not baked. Marker and
route state remains dynamic and moves to the bounded incremental overlay contract in
ADR-0325, not into the pack. The z7 source ceiling, edge semantics, renderer boundary and
production prohibitions in this record are unchanged.
