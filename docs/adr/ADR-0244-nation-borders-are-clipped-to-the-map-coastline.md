# ADR-0244: Nation borders are baked clipped to the map's coastline

Applies to: desktop

## Status

Accepted (2026-10-20).

## Context

The nation overlay came from the 1880 outline of aourednik/historical-basemaps, a world-scale
dataset (about 220 points for Germany), drawn over Natural Earth 1:10m land (376k points). The tint
was clipped to the land at draw time, but the border line followed the coarse outline, so it sat
kilometres off the real shore and the tint stopped short of the coast.

## Decision

1. `bake-borders.ts` clips each nation to the map's own coastline (`coastline-data.ts`), so the
   coast of a nation is the coast the map draws. Per nation:
   `(coarse ∩ land) ∪ ((coarse grown by 0.3° ∩ land) − every other 1880 polygon)`.
   The growth reaches the real shore where the outline stops short; subtracting the other polygons
   (playable or not) keeps it from moving any frontier with a neighbour. Inland frontiers stay as
   coarse as the source.
2. The bake runs at author time only. The clipper (`polygon-clipping`) and `tsx` are installed in a
   scratch directory outside the repo and are not project dependencies; the GeoJSON is untrusted
   input passed by path. Clipper failures on near-coincident edges are retried with the inputs
   snapped to a coarser grid (never coarser than 0.001°, a tenth of the 0.01° output grid), which is
   deterministic.
3. Output is encoded with `lib/coastline-codec.ts` per nation and base64'd; `BORDERS_1880` keeps its
   shape. The canvas simplifies borders per zoom tier with the land's tolerances.
4. Provenance: the source is GPL-3.0 and, by its own caveat, work in progress at world scale. The
   baked file is presentation only; the engine never reads it, and the data is not used for any
   authoritative outcome.

## Consequences

- Rebaking needs the two scratch-directory tools; the header of `bake-borders.ts` gives the command.
- A nation's frontier still shows the 1880 source's coarseness and its gaps (for example the
  Frisian coast, parts of the Balearics, Schleswig). Fixing those is a historical decision, tracked
  separately from this one.
- A coastline rebake must be followed by a border rebake, or the two drift apart (a test guards it).
