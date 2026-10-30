# G-03c, G-06 and G-07: dynamic overlays, tile hierarchy and production adapter

**Decision: `CONDITIONAL_GO`, unchanged.** This sequence implements the authorized engineering
foundation. It does **not** enable the globe by default, replace the Overview renderer, authorize
Phase 2, authorize G-07 production enablement, merge, push or release.

| Ticket | Status |
|---|---|
| G-03c dynamic overlays and baked labels | **passed-with-limitations** |
| G-06 tile hierarchy and LOD foundation | **passed-with-limitations** |
| G-07 production adapter behind a disabled flag | **passed-with-limitations** |
| N-08 pointer hit testing (G-07 portion) | **resolved for G-07** |
| N-09 lifecycle retention (adapter portion) | **resolved for G-07; legacy spike finding unchanged** |
| N-11 rendered visibility (G-07 portion) | **resolved for G-07** |

Labels: **[F]** repository fact, **[M]** measured, **[U]** unverified.

## 1. Baseline and authorization

- Branch `feat/globe-phase-0-1`, start HEAD `6b47ba47`, clean tree, no upstream, `dev` at
  `b77d6b30`, production Overview renderer the default **[F]**.
- This pass was explicitly authorized to start G-03c, G-06 and G-07 without waiting for legal,
  cross-GPU, Windows/Linux or Fleet the Waves 3 evidence. Those gaps remain **release blockers**
  and are not converted into completed evidence.
- Only Natural Earth and Bluewave-owned inputs are used. No OSM or GSHHG data entered the pack,
  source pins or tests.

## 2. G-03c: dynamic data paths

### Classification

| Data class | Ownership | Path | Update behavior |
|---|---|---|---|
| Area label anchor and stable id | Build-time geography | Baked `area_labels` vector layer | Static; localized text is resolved from the stable id |
| Static sea lanes | Campaign geography | Runtime route feature, class `static` | Snapshot; changed only when the lane set changes |
| Planned order | Campaign command state | Runtime route feature, class `planned` | Diffed by command id |
| Active/preview route | Interaction state | Runtime route feature, class `preview` | Replaced as one route feature |
| Static port | Campaign geography | Runtime marker, class `port` | Incremental upsert/remove by port id |
| Fleet / unit | Campaign dynamic state | Runtime marker, class `fleet` | Incremental upsert/remove by fleet id |
| Hidden/fog state | Presentation state | Store visibility, not geometry | Feature-state toggle; no source rebuild |
| Selection/hover | Presentation state | Store selection, not geometry | Ring filter/feature-state; no geometry rebuild |

Area-label geometry and identity are no longer prepared from runtime GeoJSON on the baked path.
The spike keeps a label GeoJSON source only for its explicit runtime-fallback mode. Markers and
routes remain dynamic by design: baking unit or command state into geographic tiles would make
stale gameplay state look like map data.

### Contract and store

`overlay-contract.ts` defines stable ids, kinds, explicit route classes, explicit edge semantics,
snapshot versions, change sets, selection, hover and visibility. `overlay-store.ts` applies
sorted change sets, diffs replacements, rejects duplicates, and exposes deterministic snapshot
ordering by kind, order and id. `overlay-projection.ts` maps `LiveWorldMapOverlay`,
`MapPrototypeState`, `RouteReading` and `MapOrders` into that contract without MapLibre types.
`route-geometry.ts` unwraps the antimeridian and distinguishes `lonlat-linear`, `great-circle`
and `rhumb`; the application's area-anchor routes use `lonlat-linear` explicitly.

### Baked labels [M]

The pack adds a fifth layer, `area_labels`, with 36 stable anchors. The manifest moves to
`manifestVersion` 3 and pipeline `1.2.0`.

| Item | Value |
|---|---|
| Pack | 5,678,007 bytes, 16,969 tiles |
| Pack SHA-256 | `2b7b264e928124d314c577b9bb112c1e79b9db8c85329030eeae931e12952b16` |
| Configuration SHA-256 | `4015bfdd8ac84571eca63e79910456c198270f6b2bebd22cdee540d8ca9ae34f` |
| Label count | 36 ids at every level z0-z7 |
| Label anchor validation | 36/36 found, worst 0.635 tile units, bound 1.0 |
| Combined validation | 134 checks, 0 findings (protected 56, area 78) |
| Area neighbour cracks | 10 pairs, 444 samples, worst 0.493 units (26.59 m), bound 1.5 |
| Determinism | two clean bakes plus a fresh process byte-identical |

### Measured incremental behavior [M]

Packaged adapter, Apple M4, macOS 27.0.1 arm64:

| Operation | Result |
|---|---|
| Apply a 1,000-marker scene | 1,000 changes, 1.6 ms synchronous store apply; 1,006 markers total |
| Update one marker | 1 change, 0.7 ms |
| Update a 100-marker batch | 100 changes, 0.3 ms |
| Visibility toggle | Feature state only; marker set count unchanged |

These are store/apply measurements, not GPU frame times. The historical zoom-out hitch is **not**
claimed fixed; see section 6.

## 3. G-06: tile hierarchy and LOD

The versioned policy lives in `tile-hierarchy.ts`. It separates tile pyramid level, display
zoom, source resolution, geometric subdivision and renderer overscaling.

| Policy field | Value |
|---|---|
| Source projection | EPSG:3857 |
| Source ceiling | z7 (`tileMax` = `fitForPurposeMax` = 7) |
| Overscale ceiling | z12; display ceiling z22 |
| Tile extent / buffer | 4096 / 64 |
| Levels | z0-z7 with per-level label and protected thresholds |
| Cache / in-flight / visible budgets | 512 entries / 8 / 256 |
| Cache version | `natural-earth-10m-v1:<pack sha prefix>` |
| Manifest compatibility | zoom range, extent and pack hash must match the policy |

The pack hash is part of the cache key, so replacing the pack invalidates every entry. A manifest
whose zoom range or extent disagrees with the policy is rejected before the map starts. Missing,
corrupt and forced-failure paths fall back to the current renderer. Tile selection is deterministic
for a fixed camera, viewport, DPR, pack and policy; tests cover full-world globe, antimeridian,
high latitude, DPR, rotation/pitch factors and deep planar zoom. At z12.5 the adapter reports
source level 7, overscaled true, and still selects visible tiles.

The same logical pack feeds globe and Mercator modes. The adapter switches projection without
swapping packs or ids. A future approved higher-resolution source changes the source ceiling,
pack hash and level table behind the same interfaces; it does not change domain coordinates.

Protected-feature validation remains 56 checks with 0 findings after the label pack change. All
13 features remain evaluable; schematic Corinth/Kiel, wide Hormuz/Malacca probes, the unassessed
Singapore Strait and Little Belt limitations are unchanged.

## 4. G-07: production adapter

### Boundary

`GlobeAdapter` is the only module that imports MapLibre. It consumes renderer-neutral overlay,
tile, camera and visibility contracts. `MapSurface` routes the existing Overview and strategic
map props to the adapter only when the build flag and explicit hash are both present; otherwise
it renders the unchanged `WorldMapChart`.

Camera state crosses through `camera-contract.ts` (version, centre, zoom, bearing, pitch,
projection). Unknown versions decode to no state; raw MapLibre internals are never authoritative.
The adapter supports selection, shift-click route reading, keyboard pan/zoom, fit world, return
north, projection toggle, reduced motion, a DOM entity list, live announcements and a fallback
alert. Panels are retained around the experimental surface.

### Flag and fallback

- Build flag: `VITE_BLUEWAVE_GLOBE_ADAPTER=true`; default false. The default build resolves the
  adapter entry to an inert stub.
- Opt-in hash: `#globe-adapter`. The packaged validation host uses `#globe-adapter-demo`.
- Default behavior: current Overview renderer, unchanged.
- Failure behavior: structured reason, resources disposed, current renderer retained. Forced
  initialization failure, missing pack and corrupt pack were each exercised in the packaged app.
- No retry loop, no camera/selection write-back on failure, no default renderer switch.

### Pointer selection and rendered visibility

The adapter uses `queryRenderedFeatures` hits plus `classifyHorizon`; it never uses `project()`
proximity as the authority. Back-side and unrendered entities cannot be selected. Horizon class
has 0.05-degree hysteresis. The unit fixture reproduces the 14 `project()` misses among 1,440
near-side markers and excludes them. Rendered pixel readback is not used as a selection
authority.

### Lifecycle

A disposal registry removes event handlers, subscriptions, animation frames, protocol
registration, overlay store, tile cache, map and API global in reverse order. In the packaged
adapter, five open-close cycles leave 497 listeners and 272 DOM nodes after the first close,
with no growth across later cycles; heap stays ~15 MB, workers return to 0 and the live DOM is
the baseline plus two harness nodes. CDP attribution shows the absolute delta is 13 Playwright
window listeners plus one MapLibre document `visibilitychange` listener; retained nodes are
detached, bounded library/harness state. The legacy spike's strict N-09 checks still fail at
+27 listeners/+97 nodes; that finding is not concealed or reclassified.

## 5. Packaged and offline evidence

| Build | Guard | Smoke |
|---|---|---|
| Default | PASS, 19,555 files, 0 map assets, 0 violations, `app.asar` 206,228,275 bytes | **23/23**; default package holds no globe-spike, map-data or adapter assets |
| Spike | PASS, 19,575 files, 16 allowed map assets, 0 violations, `app.asar` 214,932,641 bytes | **28 PASS / 2 known N-09 FAIL**; unchanged listener/node retention |
| Adapter | PASS, 19,576 files, 16 allowed map assets, 0 violations, `app.asar` 214,951,736 bytes | **41/41**; labels, markers, routes, deep zoom, fallback and lifecycle |

Adapter smoke checks include: marker rendering, baked area labels (17 rendered), route rendering,
z7 source ceiling, pack-hash cache version, one-marker update, 1,000-marker scene, 100-marker batch,
visibility toggle, forced/missing/corrupt fallback, no remote runtime request, no page errors,
projection switch, repeated open-close, listener/node/heap/worker bounds.

All loading is local file access. The adapter smoke records zero non-`file:`/`data:`/`blob:`
requests. CSP and Electron web preferences are unchanged; context isolation on, node integration
off, sandbox on, web security on.

## 6. Performance and the historical hitch

The incremental overlay work removes avoidable source-wide marker/label/route preparation and
shows sub-millisecond to low-millisecond store updates. It does **not** isolate or remove the
historical approximately 67 ms zoom-out hitch. That hitch reproduced in the accepted G-03a
benchmark at 83.4 ms runtime and 50.9 ms baked, and no new frame-time run in this pass overturns
that result. Capped frame rates are not GPU headroom. The hitch remains a limitation of G-03c and
of the adapter's interaction budget.

## 7. Determinism

- Pack: two clean bakes and a fresh-process bake byte-identical, SHA-256
  `2b7b264e...`; `map-data verify` ok.
- Overlay store: stable kind/order/id ordering, deterministic batch order, one-feature marker
  updates, route-only diffs, idempotent visibility.
- Tile selection: deterministic for fixed camera/viewport/DPR/policy; antimeridian, high latitude
  and deep zoom tested.
- Adapter: semantic projection/camera contract; no wall-clock, random or insertion-order
  authority. Cross-OS determinism remains **[U]**; only macOS arm64 was run.
- Cross-GPU behaviour remains **[U]**; only Apple M4 was run.

## 8. Gates

Run sequentially and alone on the working tree at `6b47ba47` after the code changes, before the
documentation commit:

| Gate | Result |
|---|---|
| `pnpm check` | exit 0, 642 s; 22/22 steps; 1,149 workspace test files, 12,267 passed, 1 skipped; e2e 39/39; `test:scripts` 410/410 |
| `pnpm test:scripts` | exit 0, 11 s; 410 passed, 0 failed, 0 skipped, 3 suites |

Three early failures were fixed before the passing run: a forbidden `as unknown as` cast in a
new test, four untagged `throw new Error` sites in the overlay store, and two ad-hoc `toFixed`
sites in the benchmark API. Each was fixed at the cause; no assertion or gate was weakened. The
first-failure log is preserved at `evidence/g03c-g07/check-first-failure.txt`; the passing log is
`check-final.txt`.

Code commits: `c2b218cc` (baked labels), `cdf09309` (overlay and hierarchy contracts), `d6c6e78c`
(disabled adapter). This documentation commit follows them. Nothing was pushed or merged.

## 9. Remaining blockers and rollback

**Engineering/release blockers:** the 67 ms hitch; cross-GPU evidence; Windows and Linux packaged
validation; production enablement; full Overview interaction parity review; the legacy spike
N-09 retention finding; any future high-resolution source.

**Legal/external blockers:** written ODbL review for bundled tiles, written GSHHG licence
confirmation, cross-GPU hardware, Windows/Linux packaged builds, direct Fleet the Waves 3
observation. None is waived or converted into completed evidence.

**Rollback:** remove `#globe-adapter`/`#globe-adapter-demo`, or rebuild without
`VITE_BLUEWAVE_GLOBE_ADAPTER` (the default build aliases the adapter entry to the stub). The
current Overview renderer then remains the only surface. The default package continues to carry
no map assets. Reverting the pack to manifest v2 requires reverting the G-03c map-data commit and
re-baking; the committed `expected-output.v1.json` pins the current v3 bytes.

**Exact next decision:** production enablement remains blocked until the deferred legal,
cross-GPU, Windows/Linux, Fleet the Waves 3 and interaction-parity evidence is provided and a
separate decision explicitly accepts the remaining hitch and N-09/retention risk.
