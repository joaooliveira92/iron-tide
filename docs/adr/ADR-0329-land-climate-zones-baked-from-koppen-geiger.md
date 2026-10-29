# ADR-0329: Land climate zones are baked from Köppen-Geiger V3

Applies to: desktop

Rule: The globe's land colour comes from a presentation-only `climate` tile layer baked at author time from Köppen-Geiger V3 and clipped to the Natural Earth coastline; no engine or authoritative code reads it.

## Status

Accepted (2026-10-28).

## Context

The globe drew every landmass in one colour, with a blurred coastal band as a stand-in for
vegetation. Land in the reference cartography varies with climate: rainforest, temperate
land, steppe and desert read as different colours, and the Sahara stays pale to the coast
while Europe is green. Natural Earth, the pinned geography source, has no climate layer, and
a colour blended at draw time cannot be clipped to the coast in MapLibre.

## Decision

1. Source: Köppen-Geiger V3 (Beck et al., 2023), period 1991-2020, the 0.1 degree GeoTIFF from
   Figshare record 10.6084/m9.figshare.21789074. The record's metadata gives CC BY 4.0, which
   permits commercial use with attribution; the GloH2O page's licence link said CC BY-NC, so the
   record was taken as authoritative. The archive and file hashes are recorded in
   `map-data/climate-zones.v1.json`.
2. Classes: the 30 Köppen classes are reclassified into seven presentation zones in
   `scripts/map-data/climate-zones.ts` (tropical wet, tropical seasonal, arid, semi-arid,
   temperate, cold, polar). Only the zone id is stored.
3. Bake: `scripts/map-data/bake-climate.ts` runs at author time only. It fills raster no-data
   from its neighbours, smooths each zone, vectorises it, and clips it per polygon against the
   Natural Earth land and minor islands, retrying with inputs snapped to a coarser grid (never
   coarser than 0.002 degrees) on clipper failure, as ADR-0244 does. `geotiff`, `d3-contour` and
   `polygon-clipping` are installed in a scratch directory and are not project dependencies.
4. Output: the clipped geometry is committed as `map-data/climate-zones.v1.bin` (delta varints,
   0.01 degree grid) with a JSON provenance sidecar. The normal build never downloads the raster.
5. Pack: the map-data pipeline tiles the zones as the `climate` layer with a `zone` property, in
   the same pack as the land. The manifest gains `layers.climate`, a `climate` provenance block,
   `manifestVersion` 4, and an attribution that credits the dataset. The configuration hash covers
   the climate provenance.
6. Renderer: a `climate-fill` layer colours land by `zone`, under the coastline stroke. The map
   legend carries the attribution, and the licence notice ships in `licences/`.

## Consequences

- The pack grows from 5.68 MB to 9.11 MB and its hash (`2b7b264e...` to `dd04ff1d...`) and
  `expected-output.v1.json` change deliberately; the cause is the new layer, not a land or area
  change. A test pins that adding climate zones leaves the land layer's decoded tiles unchanged.
  Climate geometry is simplified at 1.5 tile pixels (`climateSimplificationPixels`) against the
  land's 0.35 to keep the growth down.
- Zone edges are the 0.1 degree source, smoothed, so they are broad climate shading, not a
  vegetation survey. Sub-zone detail would need the 1 km raster and a larger pack.
- Near the coast the zones follow the unsimplified clip while the tiled land is simplified per
  zoom, so a sliver of colour can sit within one simplification tolerance of the drawn shore.
- The data is presentation only and no authoritative outcome reads it.
- Rebaking needs the three scratch-directory tools and the downloaded archive; the header of
  `bake-climate.ts` gives the command.
