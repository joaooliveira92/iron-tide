# Baseline and benchmark report

Environment **[M]**: Apple M4 (8-core GPU), 16 GB, macOS 27.0.1, built-in display 60 Hz (`requestAnimationFrame` measured 61 Hz), AC power, low-power mode off, Electron 44.9.2 / Chromium 152, viewport 1470x868 CSS px at DPR 2, packaged arm64 builds. One machine only. All frame times are **vsync-capped at ~16.7 ms**, so a result of 16.7 ms means "met 60 fps", not "has headroom". Frame times are `requestAnimationFrame` deltas; long tasks come from `PerformanceObserver('longtask')`.

## 1. Test scene and the comparability problem

Both renderers were driven by the **same scripted real input** (`scripts/map-baseline.mjs` and the `bench` task of `scripts/globe-spike-validate.mjs`): 3 s idle; two drag cycles of 40 px steps; 40 wheel notches of -200 at a fixed pointer, 80 ms apart; 40 notches back. Same viewport, same machine, same sample windows.

The **scenes are not equal** and the difference is stated, not hidden:

| | Current renderer (baseline) | Hybrid spike (candidate) |
|---|---|---|
| Content | Fresh 1880 UK campaign Overview: 973 SVG elements, 36 area buttons, 9 fleet markers, lanes, ports, nation borders, strength glyphs, minimap, scale bar, plus the Overview cards over the map | baked Natural Earth land (2,779 polygons / 376 k points), 36 densified sea areas, 10 GL markers with SDF labels, 3 routes, entity list; **no** lanes, borders, minimap or Overview cards |
| Marker/route/label count | 9 fleets, lanes, ports | 10 markers, 3 routes, 11 labels (area labels not drawn in v2) |
| Rendering | SVG + Canvas2D (CPU) | MapLibre WebGL2 |

So the candidate measured here is **lighter in overlay content and heavier in the coastline**. A like-for-like production scene was not built (it is a Phase 2 task). The candidate was also run once on the committed-code build (n = 1 run, 3 s idle + the sequences above); the baseline three times.

## 2. Current renderer baseline (3 runs, default packaged build)

| Metric | Run 1 (cold) | Run 2 | Run 3 |
|---|---|---|---|
| Click "Take command" -> first painted map canvas | 1,524 ms | 1,021 ms | 1,082 ms |
| Idle frame p95 | 17.2 ms | 17.2 | 17.1 |
| Pan p50 / p95 / max | 17.3 / **66.8** / 83.4 ms | 16.7 / 17.4 / 34.2 | 16.7 / 16.8 / 33.4 |
| Zoom-in p50 / p95 / p99 / max | 16.7 / **50.0** / 99.8 / 116.6 ms | 16.7 / 17.3 / 33.3 / 34.2 | 16.7 / 17.2 / 33.8 / 50.0 |
| Zoom-out p95 / p99 / max | 50.1 / 83.3 / 100 ms | 17.4 / 33.3 / 33.4 | 17.2 / 33.3 / 33.4 |
| Long tasks during pan / zoom-in / zoom-out | 148 / 18 / 37 | 0 / 0 / 0 | 0 / 0 / 0 |
| JS heap at rest / at max zoom (after GC) | 25.3 / 25.6 MB | same | same |
| DOM nodes at rest / listeners | 2,193 / 1,079 | same | same |
| SVG elements at rest / at max zoom | 973 / 953 | | |
| Maximum usable zoom | scale bar saturates at **"20 nm"** from wheel notch 12; camera scale cap 60 => about 4 px/nm, ~463 m/px, z ~7.4 | | |

Interpretation: after the first (cold) run the current renderer holds ~60 fps with isolated 33-50 ms frames; the cold run has a heavy first-interaction hitch (148 long tasks while panning, p95 67 ms). Coastline asset: `coastline-data-*.js` = 2,027,723 bytes (0.01 degree quantisation); renderer main chunk 4.15 MB.

## 3. Hybrid spike (1 run, capped)

| Metric | Value |
|---|---|
| Hash change -> map idle (incl. lazy chunk load, coastline decode, worker start) | 851 ms and 1,294 ms in two packaged runs |
| Idle p50 / p95 / p99 / max | 16.7 / 17.4 / 17.7 / 17.7 ms |
| Pan p95 / p99 / max | 16.9 / 17.5 / 17.7 ms |
| Zoom-in (40 notches, z~2 -> 13.1) p95 / p99 / max | 17.4 / 17.6 / 17.7 ms |
| Zoom-out p50 / p95 / p99 / max | 16.7 / **33.4** / **50.0** / **67.1** ms |
| Long tasks (main thread) | 0 in every phase |
| JS heap after GC | 51.1 MB (includes the decoded coastline and GeoJSON copies) |
| Frame while stationary in the blend (z11.5), earlier PoC run | p95 17.9 ms |
| Main-thread blocking after a far jump | not blocked: `setView` 0-1 ms, worst event-loop gap 22-28 ms, no long tasks at z3-z21 |

Zoom-out hitches (up to 67 ms) are the one candidate regression: when zooming out the map regenerates many low-zoom tiles from the runtime GeoJSON (no pre-baked tiles) in the worker; no main-thread task shows it, so it is a presentation hitch from late tiles. Pre-baked tiles (G-03) were expected to remove it. The later accepted G-03a run reproduced the hitch and it was not eliminated (section 13).

**Not valid / not done:** the uncapped runs (`--disable-frame-rate-limit --disable-gpu-vsync`) produced multi-second stalls (pan max 5.3 s, zoom-in max 9.8 s, long-task sums above wall-clock) because the unthrottled rAF loop queues GPU work unboundedly. That is a measurement artefact, not performance, and is **not used**. **GPU headroom is therefore unmeasured**; the 60 Hz cap hides it. A GPU timer query (`EXT_disjoint_timer_query_webgl2`) or Chromium tracing is needed (ticket P-01).

## 4. Deep-zoom sweep (z12.5 -> z22) **[M]**

10 locations x 11 zooms = 110 rows per run, 9 red probe circles per row placed at unprojected grid points; the red-weighted centroid in the rendered canvas is compared with CPU `project()`.

| Run | Rows | Worst error | Missing probes | Globeness | Resource errors | Heap start -> end |
|---|---|---|---|---|---|---|
| DPR 2 (main) | 110 | **0.066 css px** | 0 | 0 at every row | 0 | 38.8 -> 42.9 MB |
| DPR 1 (`--force-device-scale-factor=1`) | 110 | **0.076 css px** | 0 | 0 | 0 | 38.7 -> 42.7 MB |

Locations: equator ocean, 76N, 65S, 179.9E, -179.9, Aegean archipelago, Gibraltar strait, Mediterranean, Malta coast, route tile boundary. The measurement floor is ~0.03 px (centroid method). **No residual globe-specific precision error at z15-z22** (every row is planar). A first run of this sweep reported a constant 2.05 px error; it was a defect in my own spike layout (the map container had height 0, so probe points were clipped at the top edge) and was fixed before these numbers; both runs above are post-fix.

Settle time after a jump: median 36 ms (max 69 ms) once tiles exist; earlier harness runs showing 4-7 s per jump were Playwright round-trip latency, not map work (an in-page measurement showed idle in ~410 ms and no main-thread block).

## 5. Area picking (point queries) **[M]**

Truth = point-in-polygon in lon/lat on the **original** (undensified) ring; the map uses rings densified to a 10 m tolerance. A mismatch is "ambiguous" only if the truth changes within 1.5-2 px of the pixel.

| Run | Interior cases (36 areas x 7 zooms x 3 views) | Failures | Scatter cases (6 points x 4 zooms x areas) | Hard failures | Ambiguous within 1.5 px | Ambiguous mismatches |
|---|---|---|---|---|---|---|
| Main (DPR 2) | 756 | **0** | 864 | **0** | 6 | 0 |
| DPR 1, every 6th area | 126 | 0 | 144 | 0 | - | - |
| Browser zoom factor 1.5, every 6th area | 126 | 0 | 144 | 0 | - | - |

Zooms: 2, 5, 11.5, 12.5, 15, 18, 22 (interior); 2, 5, 11.5, 12.5 (scatter); views: bearing 0/37 and pitch 0/45; areas include the antimeridian-spanning and high-latitude ones (Barents, N Pacific). Transition reversal (gibraltar marker + area pick stepping z11 -> z12 -> z11 in 0.1 steps): marker hit at every step, identical results going in and out.

Caveat: boundary picks at z > 15 are not claimed (densification tolerance 10 m is hundreds of pixels at z22); interior picks are exact at z22. Overlapping areas: covered by the truth-set comparison (all overlapping ids must match).

## 6. Hidden markers **[M, extended spike]**

1,440 samples (10 markers x 72 centres x z1.4/z3). Findings, all at z = 1.4 (full globe):

- A **render-visibility** authority exists (a GL circle layer), so a back-side marker cannot be clicked by a pointer query at its own position.
- My **pure horizon formula disagrees with the rendered limb**: markers up to +2.8 degrees beyond it were still drawn, and polar markers (Longyearbyen, 78N) up to 13 degrees *inside* it were not found by a `project()`-then-query test (14 of 1,440 near-side samples).
- `queryRenderedFeatures` over the whole viewport returned a far-side marker (Honolulu, 20.5 degrees beyond the predicted horizon) in 1 of 669 far-beyond samples, so it is not a reliable occlusion test either.
- Visibility of a marker crossing the horizon (1,201 samples at 0.05 degrees): **0 flicker** (state changed at most once).
- A selected hidden entity shows an intentional edge indicator (button, `aria-label` "Suva is off screen at bearing 356 degrees. Activate to centre it."); clicking it brings the entity into view.

Conclusion: ghost dots are removed by using GL layers, not DOM markers; but hit-testing and the indicator decision must use **pointer-pixel queries and rendered visibility with hysteresis**, never `project()` or a closed-form horizon.

## 7. Input repeatability **[M]**

- **Semantic replay** (documented intent adapter, 80 zoom-around intents + 6 pans): three replays give **bit-identical** final camera state. Anchor drift after native `easeTo({around})` plus iterative correction: **0.0099 px** max through the 11-12 band (anchor inside the globe). Zoom in 10 levels then out returns to the start zoom within 6.6e-6 (threshold set at 1e-4).
- Native `easeTo({around})` **alone** left a constant ~35 px error for an off-centre anchor in globe mode (exact only at screen centre); the correction loop removes it, but a probe with 4 correction passes still left 1.8-3.8 px for anchors near the limb at low zoom (8 passes are now used; not re-measured for those anchors).
- **Panning in globe mode changes the reported zoom** (zoom is the Mercator zoom at the centre latitude, so moving the centre latitude changes it; keyboard pan then `+` gave 3.0027 -> 3.5027). Zoom reversal tests must therefore use pure zoom intents, and the spec "zoom stays constant while panning" does not hold in globe mode.
- Raw wheel: 30 notches at 20/60/120 ms spacing all zoom the map (verified >= 0.5 levels); run-to-run spread was recorded in `validate*/main.json` (`input.rawWheel`). In the earlier PoC the same sequence gave non-identical traces between runs (time-based smoothing), so raw device events must not be used in deterministic tests.

## 8. Accessibility foundation **[M]**

Keyboard pan (arrows) and zoom (+/-) work; entity list navigable with arrows, Enter selects, selection announced in a polite live region (`role=status`), `aria-pressed` conveys selection, reduced motion switches animation to a jump, and axe-core reports **0 violations** on the overlay (colour-contrast rule disabled: it cannot be computed on a WebGL canvas). This shows an interaction model is viable; it is not a full accessibility review (no screen-reader testing was done).

## 9. Offline isolation

In-app request interceptor: 0 non-local requests. OS-level: the packaged spike passes 29/29 under `sandbox-exec` network denial (loopback and Unix sockets allowed); see the G-00 report for the `--no-sandbox` caveat. Missing-asset behaviour: not tested **[U]** (glyph/worker removal).

## 10. Cross-GPU / low-end

**blocked-external.** No second GPU was available. Protocol and an empty result table: `cross-gpu-protocol.md`.

## 11. Raw data

`evidence/validate/*.json` (deep zoom, picking, bench), `evidence/validate2/*.json` (hidden, input, a11y, smoke), `evidence/baseline/capped/baseline.json` (all raw frame samples), `evidence/g00-final/`.

## 12. Update after G-03 and G-04 (pre-baked tiles, horizon, defects)

Historical sections above are unchanged. This section adds measurements made after commits `fc3d4f33`, `65fdd20e` and `2644391a`; the full G-03 numbers are in `g-03-offline-tile-bake-report.md`.

### Before and after, runtime tiling versus the baked pack

Six cold launches per mode, same scripted wheel input, alternating order, benchmark run alone, display capped near 61 Hz (so 16.7 ms means "held 60 fps", not headroom).

| Metric | Runtime tiling | Baked pack |
|---|---|---|
| Hash change to idle | 962 ms | 632 to 648 ms |
| First painted canvas | 567 ms | 450 to 472 ms |
| JS heap after GC | 42.6 MB | 20.6 MB |
| Zoom-out max frame, 12 runs | 17.8 to 18.8 ms | 17.7 to 18.7 ms |

**The earlier 67 ms zoom-out hitch did not reproduce in the runtime-tiling baseline** (worst 18.8 ms in 12 runs), so the claim that pre-baked tiles remove it is **unproven**. The later accepted G-03a run did reproduce the hitch and it was not eliminated (section 13). What is proven is the startup and memory improvement. Not measured: GPU headroom, worker decode time, visible tile count.

### Horizon classification against the render (defects 2 and 3)

The corrected classifier (`classifyHorizon`) was compared with isolated-marker pixel readback over 5,760 samples (10 markers, 4 pitch/bearing combinations, 2 zooms, 2 centre latitudes, 36 longitudes). Three runs of the same task disagreed with each other:

| Run | Back-side markers rendered | Front-side in-viewport markers missing |
|---|---|---|
| Earlier harness variant (single render wait) | 60 of 2,957 | 59 of 2,119 |
| Second variant | 33 of 2,957 | 43 of 2,119 |
| Final variant, run 1 | 0 of 2,957 | 1 of 2,119 |
| Final variant, run 2 (identical code) | 108 of 2,957 | 104 of 2,119 |

At pitch 0 and at pitch 45 with bearing 0 the first two variants and the final run 1 agreed perfectly; the disagreements appear in different combinations from run to run, and in pairs (a marker wrongly seen as rendered while another is wrongly missing), which points at stale-frame readbacks in the harness, not at the formula. **Conclusion: the empirical comparison with the rendered limb is inconclusive.** The formula is supported by (a) the derivation, which is the tangent-cone condition that MapLibre's own clipping-plane code evaluates, and (b) an independent ray-casting reference over 4,000 randomised cameras. It is not validated against pixels. New ticket N-11 covers a deterministic render-truth method.

### Defect disposition

| Defect | Disposition |
|---|---|
| Near-side marker misses from `project()` (14 of 1,440) | **Preserved, not resolved.** It does not affect G-03 and G-04 validation, which use tile sampling and pixel readback at positions the tests compute themselves. The horizon runs above also show `project()`-based in-viewport tests are not trustworthy. Remains in N-08 and blocks G-07 production use and Phase 2. No new regression fixture was added |
| Far-side marker leakage from a whole-viewport query | Validation tooling no longer uses that query as a visibility test; `classifyHorizon` gives an explicit front, horizon or back class with a 0.05 degree tolerance (tested at exact horizon, near horizon, rotation and projection mode). Production indicator UX is not done |
| Horizon formula | Corrected and tested for pitched and rotated cameras; pixel agreement inconclusive (above) |
| Mercator edge interpretation | Resolved in schema, preprocessor, spike adapter, tests and documentation (G-04 report) |
| Layout regression (zero-height container) | Covered by `map-container.test.ts`, a size guard that fails the spike back to the current renderer, and non-zero container checks in all four packaged modes. The historical cause of the black window remains probable, not proven |

## 13. Update after G-03a (baked area outlines)

Historical sections are unchanged. This section records the G-03a comparison; the geometry and
packaging numbers are in `g-03-offline-tile-bake-report.md` section 12.

### Method

Same scripted scene and `bench` task as section 12: three launches per mode in alternating order,
3 s idle, two drag cycles, 40 wheel notches in and 40 out, viewport 1470x868 at DPR 2. The
`runtime` mode is the runtime-GeoJSON fallback (coastline and areas tiled at runtime); the
`baked` mode is the current pack (coastline, protected overlays and area outlines baked). The
benchmark ran alone. Every launch in the accepted run reported about 61 Hz.

A first run was discarded as contended: several launches reported 16-53 Hz instead of 61 Hz and
34-183 ms frames in both modes. It is kept as
`evidence/g03a/g03a-benchmark-contended.json` and is not used for any conclusion.

### Results (accepted run, mean of 3 launches unless stated)

| Metric | Runtime GeoJSON | Baked pack with area outlines |
|---|---|---|
| Hash change to API ready | 367 ms | 350 ms |
| First painted canvas | 549 ms | 412 ms |
| Idle (all tiles loaded) | 1,166 ms | 569 ms |
| JS heap after GC | 42.8 MB | 19.2 MB |
| Pack read, verify and parse | n/a | 20-37 ms |
| Idle max frame | 17.7 ms | 33.9 ms |
| Pan max frame | 82.8 ms | 33.4 ms |
| Zoom-in max frame | 100 ms | 315.8 ms (one outlier; other runs 66.7/83.4) |
| **Zoom-out max frame** | **83.4 ms** (runs 34.3/83.4/66.7) | **50.9 ms** (runs 50.8/50/50.9) |
| Zoom-out p99 max | 51 ms | 50 ms |
| Frames over 33 ms during zoom-out | 51.3 mean | 65.3 mean |
| Zoom-out settle time | 44 ms | 39 ms |
| Main-thread script time during zoom-out | 563 ms | 543 ms |

### Disposition of the historical 67 ms hitch

**The 67 ms zoom-out hitch reproduced.** In this accepted run the runtime fallback reached
83.4 ms and the baked path 50.9 ms; it is therefore **not** eliminated and the G-03 criterion
remains **unverified/unmet**. Earlier G-03 runs found 17.7-18.8 ms maxima in both modes over 12
launches, so the observation is variable rather than stable. The runtime fallback hitched at
least as badly as the baked path in the same run, which means the run does not isolate baked area
outlines as the cause; it is consistent with environment or GPU contention. No regression is
attributed to G-03a and no removal is claimed.

What G-03a does establish by design is that the baked path no longer creates the 36-ring area
GeoJSON source or runs its densification and source-wide tiling at startup. That is a code-path
removal, not a frame-time result.

GPU headroom remains unmeasured; a 61 Hz capped run says "held the cap", not "has headroom".
Cross-GPU behaviour remains blocked-external (section 10).

Raw data: `evidence/g03a/g03a-benchmark.json` (accepted) and
`evidence/g03a/g03a-benchmark-contended.json` (excluded).

## 14. Final branch validation

The branch gates were run sequentially and alone on exact HEAD `39c05f0e`:
`pnpm check` exited 0 in 541 s (workspace 12,228 tests passed, 1 skipped; e2e 39/39;
`test:scripts` 410/410) and `pnpm test:scripts` exited 0 in 12 s (410 passed, 0 failed,
0 skipped). Logs: `evidence/final-gates/`.

This does not change the benchmark disposition above. The historical ~67 ms zoom-out hitch
**reproduced and was not eliminated** (accepted G-03a run: runtime 83.4 ms, baked 50.9 ms), so
the performance criterion remains unmet. GPU headroom, cross-GPU behaviour and cross-OS
determinism remain unverified. The production renderer is unchanged and no production
migration is authorized.

## 15. G-03c/G-06/G-07 incremental overlay measurements

The packaged adapter measured store/apply behavior on Apple M4, macOS 27.0.1 arm64, 1470x868 CSS
px at DPR 2, 61 Hz display, AC power:

| Operation | Result |
|---|---|
| Apply 1,000-marker scene | 1,000 changes, 1.6 ms store apply; 1,006 markers |
| Update one marker | 1 change, 0.7 ms |
| Update 100-marker batch | 100 changes, 0.3 ms |
| Deep planar z12.5 | source level 7, overscaled true, visible tiles 1 |
| Cache after deep view | version `natural-earth-10m-v1:2b7b264e9281`, 5 entries, 121,989 bytes |

These are not frame-time or GPU-headroom measurements. The 67 ms zoom-out hitch remains
unresolved; no capped frame rate in this pass is presented as evidence that it was removed.
Evidence: `evidence/g03c-g07/adapter-smoke.json`.
