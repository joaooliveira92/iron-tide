# G-03: deterministic offline tile bake

**Status: passed-with-limitations.** One acceptance criterion is **unverified**: the 67 ms zoom-out hitch that motivated pre-baked tiles did not reproduce in the baseline, so its removal cannot be shown (section 8). Everything else passes. Commits `65fdd20e` (pipeline), `2644391a` (spike integration and harness), plus the asset-placement fix described in section 9. Evidence: `evidence/g03-g04/`.

Labels: **[F]** repository fact, **[M]** measured, **[U]** unverified.

## 1. Scope

A build-time tool bakes pinned Natural Earth data into one checksummed tile pack and a manifest. The flagged spike consumes the pack through a custom protocol. The production renderer, `src/main`, the preload, the CSP and every Electron setting are unchanged **[F]**. The default build does not contain the tile data (section 9).

## 2. Commands

```
pnpm --filter @bluewave/desktop map-data fetch        # downloads the three archives, verifies pinned SHA-256, caches outside git
pnpm --filter @bluewave/desktop map-data bake         # bakes, validates, writes the output directory
pnpm --filter @bluewave/desktop map-data verify       # re-hashes, re-validates, compares with the committed expectation
pnpm --filter @bluewave/desktop map-data determinism  # two clean bakes, byte comparison
pnpm --filter @bluewave/desktop map-data fixtures     # builds the corrupt-pack test fixture
```

`fetch` is the only networked step and runs at build time. The game never downloads, tiles, hashes with external tools, or infers licences at runtime.

## 3. Inputs and provenance

| Input | Version | SHA-256 of the archive | Licence |
|---|---|---|---|
| ne_10m_land | 5.1.1 | `e547d749445eaa0964aba76738090ec88f5e63c4585122170f98c67a7ea922dc` | public domain |
| ne_10m_minor_islands | 4.1.0 | `47c0b3ce26df7b4dbabdbb251023918cb2f5c83462a426288f1f253da7284db2` | public domain |
| ne_10m_rivers_lake_centerlines (Suez and Panama centrelines only) | 5.0.0 | `ded71b01870855ccfe19b51f2ec14c9bb48fae23c0e9f3c11974d426433b5c38` | public domain |

The three hashes match the ones recorded independently in the G-01 investigation, and `fetch` re-downloaded all three from the pinned URLs and matched them **[M]**. Terms of use and the archives' own `README.html` and `VERSION.txt` are copied verbatim into the output (`licences/`). No OSM, GSHHG or marine/place layer is used. The URLs are documentation in `sources.v1.json`, not a runtime dependency.

Toolchain recorded in the manifest **[M]**: Node 24.18.0, geojson-vt 5.0.4, vt-pbf 3.1.3, shapefile 0.6.6, @mapbox/vector-tile 1.3.1, pbf 3.3.0, plus the SHA-256 of `pnpm-lock.yaml`. All are build-time devDependencies under permissive licences; none ships in the package. The zip reader is about 50 lines on `node:zlib`, to avoid another dependency.

Configuration (`pipeline.config.v1.json`): projection EPSG:3857 tiles from WGS84 source; lon/lat-linear edges, densified to 25 m; tile extent 4096, buffer 64; levels z0 to z7; simplification 0.35 px per level in Mercator; Mercator latitude clamp 85.0511287798066; no wall-clock value is written anywhere.

## 4. Levels and resolution honesty

Natural Earth 10 m has a median edge of 1,489 m on land and 600 m on islands **[M]**. One screen pixel is 1,223 m at z6 and 611 m at z7 on the equator. The data is therefore genuinely usable to about z7 and is **not** fit for z12.

- `tileMaxZoom` 7 and `fitForPurposeMaxZoom` 7 are recorded separately in the manifest. Technical tile availability and geographic resolution are different fields.
- Beyond z7 MapLibre overscales the z7 tiles up to `overscaleMaxZoom` 12. The spike's HUD then reads `coast detail limited to z7` and `status().land.overscaled` is true. The overscaled coast shows its true vertices (visible facets); no detail is invented.
- Per-level simplification tolerance and quantisation are recorded in `levels[]` (for example z7: 213.8 m and 76.35 m per tile unit; z0: 27,364 m and 9,773 m).
- A future approved higher-resolution source changes `sources.v1.json`, `fitForPurposeMaxZoom` and `tileMaxZoom` and nothing in domain coordinates.
- The approximately 261 MB global z12 figure from G-01 remains an **unverified estimate** for OSM-class data. Nothing here measures it.

## 5. Output [M]

| Item | Value |
|---|---|
| Pack `land.bwtp` | 4,092,995 bytes, 13,241 tiles, SHA-256 `40e1c5e9b729c0bfd5cf909c252e1fb5ae54bc1a3f9ec8e4dd8ba16beb64bfa4` |
| Output directory | 11 files, 4,238,183 bytes (pack, manifest, validation report, protected resolution, 7 licence files) |
| Configuration SHA-256 | `7fa8b5e91cd8b44afbd0619f3e6bcc735b7d0f5ebb3aa0e068c62fef2e2e1cd4` |
| Pack format | `bluewave-tilepack-1`: 16-byte header, sorted 24-byte index entries with a per-tile CRC-32, raw (uncompressed) Mapbox Vector Tiles; no gzip, so no platform-dependent compressor bytes |
| Manifest | pipeline version, dataset and archive hashes, licence and attribution, generation-timestamp policy (none), toolchain, configuration hash, protected-feature version and resolution hash, tile and file counts, sizes, per-file SHA-256, per-level hash, zoom limits, bounds, validation result. Paths are relative; the home directory does not appear |

Tiles by level (count, bytes): z0 1 / 29,788; z1 4 / 65,020; z2 16 / 129,408; z3 64 / 231,407; z4 244 / 398,085; z5 856 / 622,103; z6 2,772 / 909,538; z7 9,284 / 1,389,846.

## 6. Determinism [M]

- Two clean bakes in one process: all 11 files byte-identical.
- A fresh `bake` in a separate process after the build matched the committed `expected-output.v1.json` pack hash (`verify: ok`).
- The bake is a pure function of pinned archives, configuration, catalogue and the recorded toolchain. The committed expectation is valid for those toolchain versions; a geojson-vt or Node change that alters bytes is detected by `verify` and requires a deliberate re-pin.
- Cross-OS byte identity is **[U]**: only macOS arm64 was run.

## 7. Sizes [M]

| Measurement | Bytes |
|---|---|
| Source archives (3) | 5,663,509 |
| Extracted source | 14,373,309 |
| Intermediate files on disk | 0 (the bake streams in memory) |
| Generated output | 4,238,183 |
| Pack gzip -9 / zip of the output directory (as an installer would compress) | 2,664,611 / 2,693,894 |
| Packaged spike `app.asar` | 225,216,724 (default build 218,307,451) |
| Installed spike app (`du -sk`) | 528,668 KB (default build 515,416 KB) |
| Incremental change: moving one Kiel vertex | 4 tiles, 9,359 bytes differ out of 13,241 tiles; the whole 4 MB pack file is rewritten, so a per-file updater re-downloads all of it |

The earlier Natural Earth estimate for tiles to z8 was 6.2 MB gzipped; this z7 pack is 2.66 MB gzipped. These numbers say nothing about OSM, GSHHG or a global z12 asset.

## 8. Runtime behaviour and the hitch

Method: packaged spike, 6 cold launches per condition at 1470x868, DPR 2, display capped at about 61 Hz; the same scripted wheel input as the earlier baseline; mode order alternated; benchmark run alone (load average about 3.5 to 4.2). Two sets of three runs each per mode: one without and one with the earlier pan step.

| Metric (mean of runs) | Runtime GeoJSON tiling | Baked pack |
|---|---|---|
| Hash change to protocol and API ready | 380 ms | 353 ms |
| First painted canvas | 567 ms | 450 to 472 ms |
| Idle (all tiles loaded) | 962 ms | 632 to 648 ms |
| JS heap after GC | 42.6 MB | 20.6 MB |
| Pack read, verify and parse | n/a | 28 to 39 ms |
| Zoom-in max frame | 33.3, 33.4, 82.9 ms (no pan) and 18.7 ms (pan) | 50, 17.7, 18.7 ms (no pan) and 18.7 ms (pan) |
| **Zoom-out max frame** | **17.8 to 18.8 ms (12 runs)** | **17.7 to 18.7 ms (12 runs)** |
| Frames over 33 ms during zoom-out | 0 | 0 |
| Long tasks during zoom-out | 0 | 0 |
| Settle time after a zoom-out burst | 17 to 32 ms | 29 to 33 ms |
| Main-thread script time during zoom-out | about 740 to 790 ms | about 760 to 870 ms |

Findings:

1. **The 67 ms zoom-out hitch did not reproduce.** The runtime-tiling baseline's worst zoom-out frame was 18.8 ms in every run. The earlier 67 ms was a single sample in an earlier build. I therefore cannot claim the hitch was removed or reduced; the acceptance criterion "removed or materially reduced against a stated budget" is **unverified**. A stated budget for the record: zoom-out frames above 33.4 ms must be zero and the maximum under 20 ms; the baked path meets it, and so did the baseline in this setting.
2. **Startup and memory improved clearly:** about 33% earlier idle and 52% less heap, because the coastline no longer has to be decoded into GeoJSON on the main thread.
3. Main-thread script time is slightly higher with the pack (about 5%), because the protocol handler runs on the main thread and copies each tile. Worker decode time and visible tile count are **not measured**: the worker cannot be instrumented without tracing, and the frame cap hides GPU headroom. Do not read this table as GPU headroom.
4. Display refresh was about 61 Hz in every run, so a result of 16.7 ms means "held 60 fps", not "has headroom".

## 9. Offline and packaging [M]

- The pack, manifest and licences are inside `app.asar` under `out/renderer/map-spike/land-tiles/`; asar's own integrity hash equals the pack SHA-256.
- Normal run: 0 non-local requests in every mode; no CSP violation; the smoke suite passes 27 of 29, the two failures being the known constant retained listeners and DOM nodes after close (+27 listeners, +97 nodes, flat across cycles; ticket N-09).
- Under OS-level network denial (`sandbox-exec` profile, loopback and Unix sockets allowed): cold-start rendering with the baked pack, all four modes, 50 protected-feature views (19 canal, 31 strait) and the smoke suite behave identically. **That run needs `--no-sandbox` because Chromium's sandbox cannot nest inside `sandbox-exec`; it is a property of that single nested invocation, not an application setting, and the application defaults are unchanged.**
- Worker cleanup is unchanged (workers 0 after each close, heap flat).
- Failure behaviour, each checked in the packaged app: a missing pack (`land-tiles-missing`) reports `cannot read <url>: Failed to fetch`; a corrupt pack (one flipped byte, size consistent, hash stale) is rejected with `tile pack hash does not match the manifest`; both fall back to runtime tiling with a visible `role=alert` notice and a rendered, non-blank canvas. Per-tile checksum failures are counted, reported with the tile address and surfaced as a notice; that path is unit-tested but cannot be reached in the packaged app without altering the signed pack.
- **Packaging bug found and fixed in this session:** the first packaged build shipped the 5.7 MB source-archive cache inside `app.asar`, and Vite's `public/` directory then copied the tiles and fixtures into the **default** build as well. Fixed by excluding `.map-data-cache`, `map-data`, `scripts/map-data` and the spike assets from packaging, and by moving the spike assets to `map-spike-assets/`, copied into the renderer output only when `VITE_BLUEWAVE_GLOBE_SPIKE=true`. The default package no longer contains any of them (verified by listing the asar), and the default packaged smoke passes 22 of 22.
- Missing-asset behaviour for the worker and glyphs is still untested (ticket N-10).

## 10. Tile-boundary continuity

`validate.ts` compares the land mask on both sides of every shared tile edge at every level: 626,544 samples, 0 mismatches, 6 ambiguous within 1.5 tile units. A negative test drops a tile and the validator reports `tile-edge-continuity` **[M]**.

## 11. Limitations

- One OS and one GPU. The OS-level offline proof used a nested `--no-sandbox` launch.
- z7 ceiling; anything above is overscaled Natural Earth.
- The pack is read whole into memory on the main thread (4 MB); a range-read format would be needed for larger datasets.
- Area outlines are still GeoJSON and are not baked into the pack; the runtime GeoJSON tiling that remains is for areas, routes and markers, not for the coastline.
- The `horizon` empirical comparison is inconclusive (see the benchmark report).

## 12. G-03a: area outlines baked into the pack

**Status: passed-with-limitations.** The 36 sea-area outlines are generated offline and baked into
the same checksummed pack as the coastline and the protected overlays. The remaining limitation
is that area labels, markers and routes are still runtime GeoJSON (G-03c), and the historical
67 ms hitch criterion is still unverified. Commit `0cef07c3`; decision record
ADR-0324. Evidence: `evidence/g03a/`.

### 12.1 Source-to-output flow

1. The 36 authored sea areas are `AREAS` in
   `apps/desktop/src/renderer/components/world-map/map-geometry.ts`. They are presentation
   geometry: plain WGS84 longitude/latitude rings with stable ids and names, no MapLibre types
   and no simulation role.
2. `map-data/area-outlines.v1.json` pins the source (module, export, count 36), the
   `lonlat-linear` edge semantics, a 10 m densification tolerance and a canonical SHA-256 of
   every id and ring. A changed outline fails the pin until it is deliberately re-pinned;
   the package guard keeps this build-time file out of both runtime packages.
3. `loadInputs` decodes the spec and validates the source: count, duplicate ids, ring length,
   finite coordinates, Mercator latitude range, zero-length edges, edges of 180 degrees or more,
   zero-area rings and the canonical hash.
4. `prepareAreas` sorts by id, closes rings, densifies every edge at 10 m with the tested
   helper, removes consecutive duplicates and records the source orientation.
5. `bakeTiles` creates two `geojson-vt` indexes from the prepared rings: polygon fills
   (`areas`) and open outline lines (`area_outlines`). They are written as ordinary Mapbox
   Vector Tiles into the same pack, with the area's stable ordinal as the feature id and the
   stable string id in properties.
6. `validateAreaOutlines` decodes the generated pack and checks ids, closure, orientation,
   fidelity, neighbour cracks, outline crossings, fill continuity and count metadata.
7. The spike reads the same pack through its custom protocol. In baked mode it binds the fill
   and outline layers to the `land` vector source; the runtime `areas` GeoJSON source is not
   created at all. In runtime-fallback mode the old GeoJSON source is still used, so the
   fallback remains testable.
8. The manifest records the area dataset version, source hash, edge semantics, densification,
   quantisation, clipping, layer names, geometry and vertex counts, per-level tile counts,
   protected catalogue version, generation tool and validation summary.

### 12.2 Output and hashes [M]

| Item | Value |
|---|---|
| Area-outline dataset | `1.0.0`, 36 areas, 237 source vertices, 11,016 densified vertices |
| Source canonical SHA-256 | `0a6720e058ce366903df750235447ff2b66148309dd2a3d5e8290a08ac4ec345` |
| Pack | 5,647,299 bytes, 16,969 tiles, SHA-256 `91c74f4662bc795f4593be75dd8917c58b9fccc413347dd1f4d54bcf9dd31851` |
| Pack before G-03a | 4,092,995 bytes, 13,241 tiles |
| Delta | +1,554,304 bytes (+38.0%), +3,728 tiles (+28.2%) |
| Output directory | 11 files, 5,806,088 bytes (was 4,238,183) |
| Configuration SHA-256 | `526e327051673742f64b325885c765b980bc473ec1256c9cae868653714f2d88` |
| Manifest schema | `manifestVersion` 2, pipeline `1.1.0`, pack format `bluewave-tilepack-1` |
| Area tiles at z7 | 5,636; outline crossings at z7 1,593 |

The pack grew because ocean tiles that previously carried no data now carry area fills and
outlines, and because the z7 area lines add vertices to tiles that already carried land. The
declared detail is unchanged: `tileMaxZoom` and `fitForPurposeMaxZoom` remain 7. Overscaling
above z7 still discloses `coast detail limited to z7` and does not claim higher source detail.

### 12.3 Determinism [M]

- Two clean bakes in one process produced 11 byte-identical files.
- A bake in a fresh process produced the same pack SHA-256
  `91c74f4662bc795f4593be75dd8917c58b9fccc413347dd1f4d54bcf9dd31851` and matched the committed
  `expected-output.v1.json`.
- `pnpm map-data verify` passed: pack hash, per-level hashes, configuration hash, manifest and
  validation all matched.
- Feature order is id-sorted, tile order is `z/x/y`, geometry order follows the source rings
  and the tiler, and numeric serialisation is canonical. No wall-clock value is written.
- Cross-OS byte identity remains **unverified**; only macOS arm64 was run.

### 12.4 Geometry and continuity [M]

| Check | Result |
|---|---|
| Combined validation | 126 checks, 0 findings (protected 56; area 70) |
| Area ids in fill and outline | 36/36 at every level z0-z7 |
| Ring closure and exterior orientation | 0 findings |
| Baked outline fidelity at z7 | worst 0.792 tile units (bound 1.0), 11,016 vertices |
| Baked neighbour cracks | 10 collinear partial pairs, 444 samples, worst 0.493 units (26.59 m at z7), bound 1.5 |
| Source-level densified cracks | unchanged 4.6e-10 m over 436 vertices (`area-cracks.test.ts`) |
| Outline crossings across tile edges | 3,199 crossings, 0 mismatches, worst gap 0.88 units |
| Area-fill shared edges | 335,784 samples, 0 mismatches, 1 ambiguous |
| Land/protected shared edges | 546,688 samples, 0 mismatches, 6 ambiguous |
| Total tile-continuity samples | 885,671, 0 mismatches |

The source-level crack test still measures 4.6e-10 m because the authored rings still share the
same collinear spans. The 26.59 m figure is the distance between **baked** outlines after
integer tile quantisation at z7, not a changed source boundary or a new crack; it is compared
against a 1.5-unit bound. The continuity measurement was extended from the land layer to three
layer families, so the total sampled count (885,671) is stricter than the earlier 626,544 even
though the land-only count changed with the population filter.

Antimeridian handling, high-latitude rings (up to 84 degrees), duplicate-vertex removal,
anti-self-intersection tests, corrupt-tile rejection, missing-outline findings and repeated-bake
determinism are covered by `areas.test.ts`. A dropped tile is reported as
`tile-edge-continuity`; a corrupt tile throws instead of passing silently.

### 12.5 Protected features [M]

All 13 catalogue features remain evaluable after G-03a. The protected validation result is
unchanged at 56 checks with 0 findings; Suez, Panama, Bosporus, Dardanelles, Corinth and Kiel
are not sealed, and the nine straits keep their documented probes. The schematic Corinth/Kiel
and wide-probe Hormuz/Malacca limitations are unchanged, and no claim is made about Singapore
Strait or Little Belt. No OSM or GSHHG data entered the bake.

### 12.6 Packaged behaviour [M]

- Default build: guard PASS, 19,514 files, no map-spike or map-data asset, `app.asar`
  206,035,219 bytes; packaged smoke 23/23.
- Spike build: guard PASS, 19,534 files, 16 allowed map-spike files, `app.asar` 214,693,496
  bytes; packaged smoke 27/29 with the unchanged N-09 listener and DOM-node findings.
- The spike package under the default policy fails on 11 exact paths (spike manifest, licences,
  tiles and code), so the default policy is not merely permissive by omission.
- Globe and planar modes both load the baked area layers; the blend reaches planar after z12
  and marker picking still succeeds at every swept zoom.
- Packaged offline behaviour is inherited from G-03: no non-local request in the benchmark or
  smoke runs. Missing/corrupt pack fallback still renders the runtime GeoJSON path.

### 12.7 Performance and the historical hitch [M/U]

A benchmark run under system contention (load average 3-6) is recorded as
`evidence/g03a/g03a-benchmark-contended.json`; several launches reported 16-53 Hz instead of
about 61 Hz and 34-183 ms zoom-out frames in both the baked and runtime modes. That run is not a
valid baseline and is not used to claim either a regression or a removal. The isolated
re-measurement is recorded in the benchmark report; the criterion remains as stated there. G-03a
removes runtime outline preparation by design: the baked path creates no `areas` GeoJSON source,
so the 36-ring densification and source-wide tiling no longer run at startup. That design fact is
reported separately from any frame-time claim.

### 12.8 Limitations

- Area labels, markers and routes remain runtime GeoJSON; only the 36 outlines and fills are
  baked (G-03c).
- The pack is read whole into memory; the larger 5.65 MB pack strengthens the case for a
  range-readable format if a bigger approved source is chosen (G-03b).
- Cross-OS byte identity and cross-GPU behaviour are unverified.
- The historical 67 ms hitch criterion remains unverified; no valid baseline reproduced it and
  eliminated it under comparable conditions.
- z7 remains the honest ceiling; the area outlines above z7 are overscaled like the coastline.
