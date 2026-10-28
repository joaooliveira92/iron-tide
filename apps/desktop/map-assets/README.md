# Production map assets

Committed runtime assets for the default Overview globe renderer. They are copied to
`out/renderer/map-assets/` by `electron.vite.config.ts`; the source directory itself is
excluded from the package.

- `land-tiles/land.bwtp` — Natural Earth 10m land, minor islands and canal centrelines,
  baked at z0-z7. Pack SHA-256 `2b7b264e928124d314c577b9bb112c1e79b9db8c85329030eeae931e12952b16`.
- `land-tiles/manifest.json` — layer ids, zoom contract (fit-for-purpose z7, overscale
  to z12), bounds, source pins and integrity hashes.
- `land-tiles/licences/` — Natural Earth terms and source version/readme notices.
  Natural Earth is public domain.
- `glyphs/Inter Regular/*.pbf` — three Inter SDF ranges for map labels.
- `glyphs/OFL.txt` — SIL Open Font License 1.1 for the Inter derivative.

This pack is the complete approved production geography. It contains no
OpenStreetMap-derived data and no GSHHG data. Higher-resolution geography requires a
separate legal, licensing and pack-size decision (ADR-0327).

Regenerate the pack only with the pinned source pins and pipeline:

```sh
pnpm --filter @bluewave/desktop map-data fetch
pnpm --filter @bluewave/desktop map-data bake --out map-assets/land-tiles
pnpm --filter @bluewave/desktop map-assets:verify
```

The bake is deterministic: the committed `map-data/expected-output.v1.json` pins the
pack hash. Raw source archives and the download cache are build-time inputs and are
never committed or packaged.
