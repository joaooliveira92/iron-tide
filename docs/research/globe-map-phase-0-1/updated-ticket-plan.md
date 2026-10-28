# Updated ticket plan (G-00 to G-20)

Status vocabulary as in the execution ledger. "Next phase" = authorized to start in Phase 2 given the conditional decision.

| Ticket | Corrected status | Depends on | Evidence | Revised priority | Next phase |
|---|---|---|---|---|---|
| G-00 CSP and worker, packaged | **passed-with-limitations** | - | `g-00-packaged-csp-report.md`; commits def63359 | P0 done; add N-05 (Windows/Linux) | yes (done) |
| G-01 licence and data | **passed-with-limitations**, `requires-legal-review` z > 8 | - | `g-01-...-report.md` | split into G-01a legal, G-01b GSHHG licence, G-01c pinned snapshot + attribution design | G-01a/b yes |
| G-02 geo-math | **passed** | - | 18 tests, commit 64d9d9e9 | done | yes |
| G-03 deterministic coast tile bake | **passed-with-limitations** (hitch removal unverified; z7 ceiling) | G-01 (NE only), G-02 | `g-03-offline-tile-bake-report.md`; commits 65fdd20e, 2644391a, 0cef07c3 | done for NE; G-03a below | yes |
| G-03a bake area outlines into the pack | **passed-with-limitations** (area outlines baked; labels, markers and routes remain runtime GeoJSON; hitch criterion still unverified) | G-03, G-04 | `g-03-offline-tile-bake-report.md` section 12; ADR-0324; commit 0cef07c3 | done | yes |
| G-04 protected-feature layer | **passed-with-limitations** (schematic Corinth/Kiel; narrow straits unresolved) | G-03 | `g-04-protected-features-report.md`; commit 65fdd20e | done; G-04a to G-04e below | yes |
| G-04d larger-scale canal source decision | **passed-with-limitations** (decision recorded: above z7 needs an approved larger-scale source; selection blocked on G-01a) | G-04, G-01a | ADR-0323 section 5; `g-04-protected-features-report.md` section 7 | decision done | blocked-external for the source |
| G-04e ADR for catalogue, edge semantics and pack | **passed** (ADR-0323, ADR-0324; accepted for the spike only) | G-03a, G-04d | ADR-0323, ADR-0324 | done | yes |
| N-12 default-package contamination guard | **passed** | N-03, packaging fix 92508f73 | `n-12-default-package-guard-report.md`; `evidence/n12/`, `evidence/g03a/`; commit f995399e | done | yes |
| G-05 glyph pre-bake, OFL font | **in-progress** | - | script + Inter-derived PBFs (untracked); repo lacks Inter licence file | P2; needs licence file | yes |
| G-06 tile hierarchy and LOD | **eligible, not started** (dependencies now met; the bake defines levels z0 to z7) | G-03, G-04 | | P1 | yes |
| G-07 flagged adapter | **eligible; in-progress as a throwaway spike only** | G-00, G-03 (met) | spike component | P1 | yes |
| G-08 subdivision tests | **passed-with-limitations** | G-02 | `densify.test.ts` 8 tests; 34/36 area outlines differ up to 191 km | P1; crack/neighbour test still open | yes |
| G-09 markers, labels, back-side policy | **in-progress, defects found** | G-07 | GL markers remove ghosts; `project()` hit tests and horizon formula unreliable | **P0** | yes |
| G-10 camera controller | **in-progress** (intent adapter prototype) | G-02, G-07 | replay bit-identical; anchor drift 0.0099 px; globe panning changes zoom | P1 | yes |
| G-11 routes and overlays | **not-started** | G-07 | rhumb vs great-circle visibly differ over 12,000 km | P1; needs a decision | yes |
| G-12 cross-GPU harness | **blocked-external** | hardware | `cross-gpu-protocol.md` | P0 | blocks Phase 2 exit |
| G-13 picking and hit testing | **in-progress** (spike point-queries pass) | G-07, G-09 | 756+864 cases, 0 hard failures | P1 | yes |
| G-14 accessibility mirror | **in-progress** (foundation viable) | G-07 | keyboard, live region, axe 0 | P1 | yes |
| G-15 precision hardening | **not-needed so far** | G-12 | deep zoom <= 0.076 px; blend ends z12 | P2 (only if another GPU fails) | conditional |
| G-16 performance budget tests | **not-started** | G-07 | baseline + candidate numbers; GPU headroom unmeasured | P1 | yes |
| G-17 visual regression | **not-started** | G-07 | | P1 | yes |
| G-18 Overview integration behind flag | **out-of-scope** (production) | G-07, G-09, G-10, G-11, G-13, G-14 | | P1 | **no** |
| G-19 default on | **out-of-scope** | G-18 | | P2 | **no** |
| G-20 legacy removal | **out-of-scope** | G-19 | | P2 | **no** |

## Newly discovered tickets

| ID | Title | Priority | Notes |
|---|---|---|---|
| N-01 | Area edge semantics: densify at bake, decide rhumb vs lon/lat | P0 | **resolved for the catalogue, the bake and the spike adapter** (lon/lat-linear, schema-enforced); sea-area outlines are not yet baked into tiles |
| N-02 | Retest the black-window report under automation | P1 | cause probable (zero-height layout in an interim spike build), not proven |
| N-03 | Pre-baked tiles to remove runtime GeoJSON tiling (zoom-out hitch, startup, vertex-limit warning) | P1 | **coastline done by G-03**: startup -33%, heap -52%; the hitch did not reproduce so removal is unproven; vertex-limit warning not rechecked |
| N-04 | Keep `maplibre-gl` out of shipped `node_modules` (29 MB, 789 files, shipped even with the flag off) | P1 | verify moving to devDependencies |
| N-05 | Windows/Linux packaged CSP and file:// worker smoke | P0 | blocked-external |
| N-06 | Inter OFL licence file and reserved-name check before committing glyph PBFs | P2 | |
| N-07 | OSM ODbL / GSHHG legal review (G-01a/b) | P0 | requires-legal-review |
| N-08 | Hit-test and indicator authority: pointer-pixel queries + rendered visibility with hysteresis | P0 | replaces `project()` and horizon formula |
| N-09 | Lifecycle: constant +27 listeners / +97 nodes retained after close | P2 | no growth across 10 cycles |
| P-01 | GPU headroom measurement (timer queries or tracing) | P1 | uncapped flags are invalid |
| N-10 | Missing-asset behaviour (worker/glyph/tile removed) | P2 | |

## Tickets added by the G-03 and G-04 session

| ID | Title | Priority | Notes |
|---|---|---|---|
| G-03a | Bake sea-area outlines into the pack and remove runtime outline tiling | **passed-with-limitations** | area outlines done; labels, markers and routes remain runtime GeoJSON (G-03c) |
| G-03b | Range-readable pack for datasets above a few MB (the pack is read whole into memory) | P2 | only if a larger approved source is chosen |
| G-03c | Bake area labels, markers and routes into the pack or a sibling pack | P2 | remains runtime GeoJSON after G-03a |
| G-04a | Replace the authored Corinth and Kiel lines and the Bosporus and Dardanelles fallback lines with a centreline from an approved source | P1 | blocked on a cleared source |
| G-04b | Validate the true narrows: Hormuz, Malacca (Singapore and Phillip channels), Little Belt | P1 | needs finer cleared data |
| G-04c | Overlay fidelity above z7 (z7 quantisation, about 3 px at z12.5) | P2 | tied to G-01a |
| G-04d | Decide whether canal geometry above z7 needs a larger-scale source | **passed-with-limitations** | decision in ADR-0323: yes; selection blocked on G-01a |
| G-04e | ADR for catalogue, edge semantics and tile pack format | **passed** | ADR-0323 and ADR-0324 |
| N-11 | Deterministic render-truth method for marker visibility and horizon agreement | P1 | the isolated-marker readback is not repeatable |
| N-12 | Guard that the default package never contains spike assets or build-time map inputs | **passed** | permanent guard plus packaged smokes |
| N-13 | Reproduce or retire the 67 ms zoom-out hitch observation | P2 | a valid capped run reproduced hitches in both baked and runtime modes (max 50.9 / 83.4 ms); not eliminated |

G-06 (tile hierarchy/LOD) and G-07 (production adapter) are technically eligible after G-03a but
remain **not authorized**. Their production implications need a separate decision after the
legal, cross-GPU, platform, hit-testing and visibility evidence. The same applies to G-03c
(labels, markers and routes) and G-04a/b/c.

## Stop conditions that remain armed

Any new network dependency; any CSP loosening beyond a documented, narrow, reviewed directive; any authoritative-coordinate change; any dataset whose licence cannot be satisfied; a cross-GPU run that shows > 0.3 px sphere error at z12 or sustained > 20 ms frames on the lowest supported GPU.
