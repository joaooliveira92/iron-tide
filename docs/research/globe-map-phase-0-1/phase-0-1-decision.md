# Phase 0 / Phase 1 decision

## Decision: `CONDITIONAL_GO`

The hybrid sphere-to-plane map on MapLibre GL JS with offline Mercator-compatible tiles remains viable and **no mandatory constraint has failed**. Production migration is **not authorized**: Phase 2 may start only on the conditions in section 6. Several eligible Phase 1 tickets were **not completed** (section 5); this decision does not claim otherwise.

**Confidence:** high that the architecture is safe to continue on this machine and platform (packaged CSP, offline, lifecycle, precision, picking all measured); **medium** overall; **low** for tactical-zoom data (legal), for cross-GPU behaviour (one GPU), and for player benefit versus Fleet the Waves 3 (unobserved).

## 1. Gates

| Gate | Status | Evidence |
|---|---|---|
| G-00 packaged production CSP | **PASSED** (macOS arm64) | 29/29 packaged checks, unchanged CSP, no `src/main` change, also 29/29 under OS-level network denial; default-build smoke 22/22 |
| G-01 data licence and size | **PASSED WITH LIMITATIONS / requires-legal-review for z > ~8** | NE public domain, 6.2 MB tiles to z8; OSM ODbL and GSHHG (CC0 vs LGPL conflict) uncleared; canals absent from every candidate except Suez in OSM |
| G-02 geo-math | PASSED | 18 tests |
| G-08 subdivision (densify) | PASSED WITH LIMITATIONS | 8 tests; neighbour/crack checks not run |
| Deep-zoom z12.5-z22 | **PASSED** | worst 0.066 px (DPR 2), 0.076 px (DPR 1), 0 missing probes, 110 rows each |
| Area picking | **PASSED** | 756 interior + 864 scatter cases, 0 hard failures; DPR 1 and 150% zoom pass |
| Transition reversal | PASSED | picking identical z11->12->11; anchor drift 0.0099 px with correction |
| Accessibility foundation | VIABLE | keyboard, live region, aria-pressed, reduced motion, axe 0 violations (not a full review) |
| Hidden-marker policy | **DEFECTS FOUND** | GL markers remove ghost dots; but hit tests via `project()` miss 14/1,440 near-side markers and a whole-viewport query returned 1 far-side marker; horizon formula off by up to 2.8 degrees |
| Lifecycle | PASSED WITH LIMITATION | flat across 10 cycles; constant +27 listeners / +97 nodes retained vs pre-open |
| Performance | **INCONCLUSIVE** | candidate holds 60 fps on M4 but zoom-out hitches to 67 ms; baseline similar after warm-up; GPU headroom unmeasured |
| Cross-GPU / low-end | **BLOCKED-EXTERNAL** | one machine only |
| Fleet the Waves 3 comparison | **BLOCKED-EXTERNAL** | checklist written |
| Windows/Linux packaged CSP | **BLOCKED-EXTERNAL** | |

## 2. Security implications

None negative. No CSP directive was added or loosened, no Node integration, no sandbox change, no remote origin, no new IPC. Added surface: a WebGL canvas and a module worker from the app directory, only in flagged builds. The OS-level offline proof needs `--no-sandbox` on that single run (Chromium sandbox cannot nest); the normal run keeps the sandbox on.

## 3. Licensing status

Natural Earth: public domain, usable now. MapLibre: BSD-3-Clause. OSM-derived tiles inside software: **requires legal review** (ODbL share-alike scope). GSHHG: **requires maintainer confirmation** (CC0 vs LGPL-3.0-or-later). Inter glyph SDFs: repo lacks the font's licence file; PBFs are not committed.

## 4. Offline, performance, data-quality status

- **Offline:** proven with an in-app interceptor and OS-level denial. Missing-asset behaviour untested.
- **Performance:** 60 fps held on one M4 in both renderers; candidate adds zoom-out hitches (p99 50 ms, max 67 ms) from runtime GeoJSON tiling; startup 0.85-1.3 s to idle. Not representative of low-end GPUs.
- **Data quality:** current baked coastline (0.01 degree quantisation) cannot support z12 and omits Suez, Panama, Kiel, Corinth, Bosporus. Natural Earth alone cannot either; a protected-feature overlay is required for **every** option. 34 of 36 area polygons change shape by up to 191 km if edges are interpreted in Mercator instead of lon/lat; densification at bake time preserves the legacy outlines.

## 5. Not completed (eligible but not done in this session)

G-03 deterministic tile bake (measurement scripts exist; no product pipeline), G-04 protected-feature layer, G-06 tile hierarchy/LOD rules, G-07 production adapter (only the throwaway spike exists), G-10 camera controller (intent adapter prototype only), G-11 routes semantics (rhumb vs great-circle undecided), G-13/G-14 production picking and a11y mirror (validated only in the spike), G-15-G-17 (precision hardening was not needed in measurement; performance budget tests and image goldens not built). The unexplained black window seen during an earlier harness run was most likely the zero-height layout bug I introduced and then fixed; I could not reproduce a black canvas in any other probe, so I record the cause as **probable, not proven**.

## 6. Conditions before Phase 2

1. Legal decision on z > 8 data (or accept a z <= 8 ceiling and keep Natural Earth).
2. Cross-GPU run on at least one Windows integrated GPU and one discrete GPU, using the protocol; deep-zoom error <= 0.5 px, zoom-out p95 <= 20 ms.
3. Pointer-pixel hit testing and rendered-visibility edge indicator implemented and tested (replaces `project()`/horizon formula).
4. Pre-baked tiles with protected-feature overlay (canals, narrow straits) and 1e-5 degree quantisation; zoom-out hitch re-measured.
5. Area outlines densified in lon/lat at bake time with a neighbour-crack test.
6. `maplibre-gl` moved out of shipped `dependencies` (or proven necessary) and package size re-measured.
7. Windows/Linux packaged smoke (CSP and file:// worker).
8. Accessibility parity plan for the full Overview (not just the spike).
9. FTW3 observation or an explicit product decision on the tactical zoom target.

## 7. Recommended immediate next ticket

**G-01a (non-engineering): legal read of ODbL for bundled coastline tiles and written GSHHG licence confirmation.** In parallel, engineering can start **G-04/G-03 on Natural Earth data only** (public domain), which every option needs.

## 8. Production migration tickets

G-18, G-19, G-20 remain **not authorized**.

## 9. Update after G-03 and G-04

**Decision unchanged: `CONDITIONAL_GO`.** Production migration and Phase 2 are not authorized.

- G-04 passed-with-limitations: catalogue, edge semantics, pipeline and validator complete; Corinth and Kiel geometry is schematic and Hormuz and Malacca are validated only at their wide parts.
- G-03 passed-with-limitations: the Natural Earth bake is deterministic, packaged, offline and validated; honest detail ends at z7.
- Conditions 4 and 5 in section 6 are met for Natural Earth data at z7 (pre-baked tiles with protected overlay, densified lon/lat outlines and a neighbour-crack test). Condition 4's "1e-5 degree quantisation" and its zoom-out hitch re-measurement are not met: quantisation is the tile grid (76 m at z7), and the hitch did not reproduce in the G-03 runs. The later accepted G-03a benchmark did reproduce it and did not eliminate it (section 11).
- Still open: 1 (legal decision above z8), 2 (cross-GPU), 3 (pointer-pixel hit testing and rendered-visibility indicator; the horizon pixel comparison is inconclusive), 6 (`maplibre-gl` still ships in the default package), 7 (Windows and Linux), 8 (full Overview accessibility plan), 9 (Fleet the Waves 3 observation).
- New risk found and fixed: build-time map inputs and spike assets leaked into the default package. A guard (N-12) is still needed.

## 10. Update after N-12, G-03a and G-04d/e

**Decision unchanged: `CONDITIONAL_GO`.** Phase 2, production migration and a default renderer switch remain not authorized. Nothing was pushed or merged.

- **N-12 passed.** A manifest-driven package guard now inspects `app.asar`, the unpacked directory and the resources outside the archive. The default policy allows no map-spike or map-data file; the spike policy allow-lists exact runtime files, requires the pack, manifest and glyphs, and verifies the pack against the manifest SHA-256. Source archives, caches, fixtures, evidence, validation output and machine-specific paths fail both policies. Archive-size budgets are named in the policy. Default guard: 19,514 files, 0 violations, `app.asar` 206,035,219 bytes. Spike guard: 19,534 files, 16 allowed map assets, 0 violations, `app.asar` 214,693,496 bytes. The spike package under the default policy fails on 11 exact paths, as intended. Default packaged smoke is 23/23; spike smoke is 27/29 with the unchanged N-09 findings.
- **G-03a passed-with-limitations.** The 36 sea-area outlines are now densified at bake time (10 m, lon/lat-linear) and baked into the same offline pack as `areas` fills and `area_outlines` lines. The pack is 5,647,299 bytes over 16,969 tiles (was 4,092,995 bytes over 13,241); the outlines add 1,554,304 bytes and 3,728 tiles. Two clean bakes and a fresh-process bake are byte-identical (`91c74f46...`). Combined validation is 126 checks with 0 findings (protected 56; area 70); outline and fill tile-edge continuity have 0 mismatches, and the baked neighbour-crack worst case is 0.493 tile units (26.59 m at z7) against a 1.5-unit bound. The source-level densified crack result remains 4.6e-10 m; the larger number is tile quantisation, not a changed source boundary. Globe and planar modes, packaged offline loading and the area ids all pass. Limitation: area labels, markers and routes remain runtime GeoJSON (G-03c), and the historical ~67 ms zoom-out hitch **reproduced and was not eliminated** in the accepted G-03a benchmark (runtime 83.4 ms, baked 50.9 ms); the performance criterion remains unmet.
- **G-04d passed-with-limitations.** ADR-0323 records that canal geometry above z7 needs an approved larger-scale source; Natural Earth cannot supply it and source selection remains blocked on the legal decision in G-01a. Schematic Corinth and Kiel remain explicitly disclosed investigation data.
- **G-04e passed.** ADR-0323 (geographic sources and protected overlays) and ADR-0324 (edge semantics, offline tiling and renderer boundaries) are accepted for the spike only. They do not authorize production migration.
- Condition 5 (densified lon/lat area outlines and a neighbour-crack test) is now met on the offline pack. Condition 4's `1e-5` degree quantisation and its hitch re-measurement are still not met; the hitch was not resolved. The accepted (non-contended) G-03a benchmark reproduced it (section 11); the earlier contended re-run remains excluded. Conditions 1, 2, 3, 6, 7, 8 and 9 remain open exactly as listed in section 6.
- Newly eligible but **not authorized**: G-06 (tile hierarchy/LOD) and G-07 (production adapter), plus G-03c (labels, markers and routes) and G-04a/b/c. Their production implications need separate authorization.

## 11. Final branch validation

**Decision unchanged: `CONDITIONAL_GO`.** The branch gates pass, but this is not an unconditional go and does not authorize merge, Phase 2, G-07 or production migration.

- `pnpm check` on `39c05f0e`: exit 0, 541 s, all 22 steps passed. Workspace tests: 1,143 files, 12,228 passed, 1 skipped; Playwright e2e 39/39; `test:scripts` 410/410. Complete log: `evidence/final-gates/pnpm-check-39c05f0e.txt`.
- `pnpm test:scripts` on `39c05f0e`: exit 0, 12 s, 410 passed, 0 failed, 0 skipped. Complete log: `evidence/final-gates/pnpm-test-scripts-39c05f0e.txt`.
- No gate failed and no branch-introduced defect was found. Only documentation changed in this pass. Final worktree state: clean.
- N-12 is **passed**. G-03a is **passed-with-limitations**. G-04d and G-04e are **complete (done)**: G-04d passed-with-limitations, G-04e passed, recorded in ADR-0323 and ADR-0324.
- ADR-0323 and ADR-0324 remain accepted for the Phase 0/1 investigation spike only. They do not authorize production migration, Phase 2, G-07, a default renderer switch, or any use of investigation geometry as authoritative simulation topology. The legal and data-quality limitations are preserved.
- Area labels, markers and routes remain runtime GeoJSON under **G-03c**. G-06 and G-07 were not started. Phase 2 was not started. The production Overview renderer remains the default.
- The historical ~67 ms zoom-out hitch **reproduced and was not eliminated** (accepted G-03a run: runtime 83.4 ms, baked 50.9 ms). The performance criterion is not passed.
- Cross-OS determinism and cross-GPU behaviour remain **unverified**.
- Nothing was pushed or merged.

## 12. Authorized engineering sequence: G-03c, G-06 and G-07

**Decision unchanged: `CONDITIONAL_GO`.** This sequence implements the authorized engineering
foundation. It does not make the globe the default, replace the Overview renderer, enable the
adapter for production, authorize Phase 2, merge, push or release.

- **G-03c passed-with-limitations.** Area-label anchors and stable ids are baked as the
  `area_labels` layer (manifest v3, pack 5,678,007 bytes, 16,969 tiles, SHA-256 `2b7b264e...`).
  Markers and routes are dynamic by ownership and now flow through a renderer-neutral incremental
  overlay store: one marker update is one change, route replacement diffs only routes, and
  selection/hidden state uses feature state rather than geometry rebuilds. The historical ~67 ms
  zoom-out hitch remains unresolved and is not claimed fixed.
- **G-06 passed-with-limitations.** The versioned tile policy keeps the z7 source ceiling
  explicit, separates pyramid level, display zoom, source resolution and overscaling, makes tile
  selection deterministic for a fixed camera, and versions the cache by the pack hash. Globe and
  Mercator modes consume the same logical pack. Cross-OS and cross-GPU behavior remain unverified.
- **G-07 passed-with-limitations.** A production-shaped adapter consumes the overlay, tile,
  camera and visibility contracts behind `VITE_BLUEWAVE_GLOBE_ADAPTER`, off by default. The
  default build aliases the adapter to an inert stub; the current Overview renderer remains the
  default and the failure fallback. The packaged adapter smoke passes 41/41, including forced,
  missing and corrupt initialization failure.
- **N-08 resolved for G-07:** rendered hits plus horizon classification; the 14 near-side
  `project()` misses in the 1,440-marker fixture are excluded. **N-11 resolved for G-07:**
  hysteresis at the horizon and no pixel-readback authority. **N-09 adapter portion resolved:**
  five open-close cycles are flat after the first close; the legacy spike's +27 listeners/+97
  nodes finding is unchanged and still reported.
- **Gates:** `pnpm check` exit 0 (642 s; 12,267 workspace tests passed, 1 skipped; e2e 39/39) and
  `pnpm test:scripts` exit 0 (410/410). Default, spike and adapter package guards pass; default
  smoke 23/23, spike smoke 28 PASS / 2 known N-09 FAIL, adapter smoke 41/41.
- **Still open:** the 67 ms hitch, cross-GPU evidence, Windows/Linux packaged validation, legal
  ODbL/GSHHG decisions, Fleet the Waves 3 observation, full Overview interaction-parity review
  and production enablement. These are deferred release blockers, not waived evidence.
- Commits: `c2b218cc` (baked labels), `cdf09309` (overlay and hierarchy contracts), `d6c6e78c`
  (disabled adapter), followed by this documentation commit. Nothing was pushed or merged.
