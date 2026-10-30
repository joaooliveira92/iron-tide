# Production map assets

Committed runtime assets for the default Overview globe renderer. They are copied to
`out/renderer/map-assets/` by `electron.vite.config.ts`; the source directory itself is
excluded from the package.

- `land-tiles/land.bwtp` — Natural Earth 10m land, minor islands and canal centrelines,
  plus the presentation-only `climate` layer (Köppen-Geiger V3 zones clipped to the
  coastline), baked at z0-z7. Pack SHA-256 `dd04ff1dac017ac5e24e7fbf3973c947928b4622e9b7f181e5f1a642547199ea`.
- `land-tiles/manifest.json` — layer ids, zoom contract (fit-for-purpose z7, overscale
  to z12), bounds, source pins and integrity hashes.
- `land-tiles/licences/` — Natural Earth terms and source version/readme notices
  (public domain) and the Köppen-Geiger V3 CC BY 4.0 notice, which requires attribution.
- `glyphs/Inter Regular/*.pbf` — three Inter SDF ranges for map labels.
- `glyphs/OFL.txt` — SIL Open Font License 1.1 for the Inter derivative.

This pack is the complete approved production geography. It contains no
OpenStreetMap-derived data and no GSHHG data. Climate zones are baked at author time
by `scripts/map-data/bake-climate.ts` into `map-data/climate-zones.v1.bin`; the normal
bake reads that file and never downloads the raster. Higher-resolution geography requires a
separate legal, licensing and pack-size decision.

Regenerate the pack only with the pinned source pins and pipeline:

```sh
pnpm --filter @bluewave/desktop map-data fetch
pnpm --filter @bluewave/desktop map-data bake --out map-assets/land-tiles
pnpm --filter @bluewave/desktop map-assets:verify
```

The bake is deterministic: the committed `map-data/expected-output.v1.json` pins the
pack hash. Raw source archives and the download cache are build-time inputs and are
never committed or packaged.
