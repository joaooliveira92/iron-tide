# ADR-0323: Geographic data sources and protected-feature overlays

Applies to: desktop

## Status

Accepted for the Phase 0/1 investigation spike (2026-10-27); not approved for production migration. A larger-scale canal source and every non-Natural-Earth dataset remain blocked on the legal decisions in G-01a and G-01b.

## Context

The hybrid globe map needs offline coastline geometry and a small set of navigation-critical
features that Natural Earth does not carry: canals and narrow straits. The investigation
measured the pinned Natural Earth 10 m layers at a median land edge of about 1,489 m and an
island edge of about 600 m. One screen pixel is about 1,223 m at z6 and 611 m at z7 on the
equator, so the data is genuinely usable to about z7 and is not fit for tactical zoom. The
existing production Overview map and the authoritative simulation domain are unchanged.

Three separate questions had to be kept apart: which source may be used, how far its visual
detail honestly reaches, and which overlay is needed where the source is silent or too coarse.
A source that cannot be licensed cannot be made acceptable by engineering. A z7 tile that is
stretched to z12 does not gain z12 information. An overlay drawn for display must not become
simulation topology by accident.

## Decision

- Natural Earth 10 m land, minor islands and the Suez/Panama river centrelines are the only
  approved geographic source for the bake. The archives are pinned by URL, version and SHA-256
  in `apps/desktop/map-data/sources.v1.json`; only public-domain data enters the pack.
- The honest visual-detail ceiling is z7. `tileMaxZoom` and `fitForPurposeMaxZoom` are recorded
  as separate manifest fields. Above z7 the renderer overscales the z7 tiles to
  `overscaleMaxZoom` 12 and the spike HUD states `coast detail limited to z7`; overscaling
  never raises the declared source detail.
- Protected features are rendering overlays, not authoritative simulation topology. Every
  catalogue entry declares `displayOnly` true and `simulationNavigabilityImplicated` false.
  Routes and navigability stay in the authored content; simulation coordinates and save
  formats are untouched.
- The 13-feature catalogue (`protected-features.v1.json`) carries identifiers, representation,
  edge semantics, zoom threshold, tolerances, provenance, licence status and a gameplay reason
  traced to 1880 content. Validation probes are transects measured on the unsimplified source,
  not surveyed centrelines.
- Schematic geometry is allowed only as explicitly disclosed investigation data. Corinth and
  Kiel are Bluewave-authored lines labelled schematic; they must not be described as verified
  geography. Replacing them needs an approved source (G-04a).
- Canal geometry above z7 needs a larger-scale approved source (G-04d). At z7 the overlay keeps
  about 3 px of quantisation at z12.5. That is acceptable against the catalogue's 1.5 km to 6 km
  accuracy classes for a strategic map, and not acceptable for a surveyed canal. Natural Earth
  cannot supply the missing detail, so the decision is recorded here while source selection
  remains blocked on G-01a.
- OSM-derived data remains excluded pending legal review of ODbL as it applies to tiles bundled
  in software (G-01a). GSHHG remains excluded pending written clarification of its licence
  (G-01b). Neither is replaced by an assumption.
- A future approved higher-resolution dataset replaces or augments Natural Earth by changing
  the pinned sources, the pipeline limits, the expected-output hashes and this record. These
  interfaces stay stable across that replacement: WGS84 longitude/latitude source
  coordinates, the catalogue schema and stable feature ids, the tile-pack and manifest
  schemas, the renderer loader contract, and the validation rules and findings vocabulary.
- Provenance and attribution travel with the data: the build copies the source terms and
  version files into the output, and the manifest records the archive hashes, versions,
  licence status and attribution. A packaged pack is accompanied by its manifest and
  licences.
- Rollback is deliberately cheap. The production renderer remains the default, the spike is
  behind an explicit build flag, and the default-package guard rejects every spike and map-data
  file. Reverting the flag, the pack and the commits restores the previous map. A deliberate
  re-pin of `expected-output.v1.json` is required before any source or toolchain change can
  alter the pack.
- Rejected alternatives: shipping OSM or GSHHG before legal clearance; drawing canals as land
  because the coastline source omits them; inventing detail above z7; fetching tiles at
  runtime; and treating the overlay as a navigability authority.

## Consequences

- The map can ship an honest, offline, public-domain foundation now, with a visible ceiling and
  a visible disclosure when it is exceeded.
- Tactical-zoom quality, the true narrows at Hormuz and Malacca, Singapore Strait, Little Belt,
  and verified Corinth/Kiel geometry remain open and are tracked as G-04a, G-04b and G-04c.
- A production migration still needs the legal, cross-GPU, Windows/Linux, hit-testing,
  visibility and product-comparison evidence listed in the Phase 0/1 decision. This record does
  not authorize Phase 2 or replace the Overview renderer.
- Any new dataset is an explicit reviewed decision, not a build-time convenience.
