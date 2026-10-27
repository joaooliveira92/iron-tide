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
