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
