# G-04: protected maritime features

**Status: passed-with-limitations.** The schema, pipeline and validation are complete and every catalogue feature is represented and validated. Production use stays blocked on the limitations in section 7. Evidence is under `evidence/g03-g04/`; commit `65fdd20e` (catalogue, pipeline, validator) and `2644391a` (rendering harness).

Labels: **[F]** repository fact, **[M]** measured, **[U]** unverified.

## 1. What exists

| Piece | Where |
|---|---|
| Versioned catalogue (13 features) | `apps/desktop/map-data/protected-features.v1.json` |
| Strict schema (Effect Schema, excess properties rejected) and semantic checks | `apps/desktop/scripts/map-data/catalogue.ts` |
| Resolution (overlay injection, sealing detection, vertex pinning) | `scripts/map-data/bake.ts` |
| Validator (decodes the generated pack, checks every feature at every required level) | `scripts/map-data/validate.ts` |
| Edge semantics and densification | `scripts/map-data/geodesy.ts`, `globe-spike/densify.ts` |
| Tests | `catalogue.test.ts` (8), `bake.test.ts` (8), `geodesy.test.ts` (7), `area-cracks.test.ts` (4) |

The catalogue has no dependency on MapLibre. It is rendering geometry only: `simulationNavigabilityImplicated` is false for every feature and `displayOnly` true. Simulation lanes stay in `content/production/1880/routes.yaml` and are untouched **[F]** (`git diff b77d6b30 -- apps/desktop/src/main content` is empty).

## 2. Catalogue

Each feature carries identifier, name, type, representation, edge semantics, a gameplay reason traced to 1880 content, `requiredFromZoom`, tolerances (`maxDisplacementMetres`, `maxNarrowingFraction`), `visualContinuityRequired`, provenance (method, source, accuracy class, positional accuracy, retrieved date), licence status and validation notes.

| Feature | Type | Representation | Geometry source | Accuracy class | From z | Opens | Gameplay reason (content) |
|---|---|---|---|---|---|---|---|
| suez-canal | canal | overlay line | Natural Earth rivers layer, public domain | dataset | 3 | 1869 | route `r_suez_canal` |
| panama-canal | canal | overlay line | Natural Earth rivers layer | dataset | 4 | 1914 | later-era scenarios, display only in 1880 |
| corinth-canal | canal | overlay line | **Bluewave-authored** two-point line | **schematic** (3 km) | 6 | 1893 | eastern Mediterranean coastal movement |
| kiel-canal | canal | overlay line | **Bluewave-authored** five-vertex line | **schematic** (6 km) | 5 | 1895 | port `ger_kiel`, route `r_north_baltic` |
| bosporus | strait | base-water passage, fallback overlay | Natural Earth land | dataset | 5 | | area `ott_marmara_coast`, route `r_med_black` |
| dardanelles | strait | base-water passage, fallback overlay | Natural Earth land | dataset | 5 | | route `r_med_black` |
| strait-of-gibraltar | strait | base-water passage | Natural Earth land | dataset | 4 | | area `med_gibraltar`, four routes |
| strait-of-hormuz | strait | base-water passage | Natural Earth land | dataset | 4 | | **no 1880 route**; mandated validation only |
| bab-el-mandeb | strait | base-water passage | Natural Earth land | dataset | 4 | | route `r_redsea_adden` |
| strait-of-malacca | strait | base-water passage | Natural Earth land | dataset | 3 | | routes via Singapore |
| dover-strait (English Channel) | strait | base-water passage | Natural Earth land | dataset | 4 | | area `sea_english_channel` |
| oresund (Danish straits) | strait | base-water passage | Natural Earth land | dataset | 5 | | route `r_north_baltic` |
| great-belt (Danish straits) | strait | base-water passage | Natural Earth land | dataset | 4 | | route `r_north_baltic` |

Straits are validated with **transects**: a land-to-land probe whose endpoints I chose from general geographic knowledge and then checked by script against the pinned Natural Earth land. They are validation probes, not traced geometry. `referenceWidthMetres` is the water width measured on the unsimplified source along the transect **[M]**, not a survey value.

Provenance of authored coordinates: Corinth and Kiel are authored from general public knowledge of the published end points and course. They are **not** traced from imagery or from any dataset, and they are **not** verified against an approved source **[U]**. Corinth's length checks at about 6.3 km, consistent with the published length. They are labelled schematic and fail no gate for that reason; they need replacement (follow-up G-04a).

Natural Earth carries only Suez and Panama among the canals **[M]** (rivers layer; Kiel and Corinth are absent).

## 3. Edge semantics (resolves defect 4)

- **Policy:** every vertex is WGS84 longitude/latitude; consecutive vertices are joined by straight lon/lat segments (`lonlat-linear`). The schema accepts no other value and rejects `great-circle`, `rhumb` and `mercator-linear` with a named error **[M]** (`catalogue.test.ts`).
- Before tiling, every edge is densified so that Mercator, great-circle and rhumb readings agree to 25 m for the bake (10 m for the sea-area outlines). The earlier finding stands: without this, 34 of 36 area outlines move by up to about 191 km.
- Densification preserves endpoints, takes the short way across the antimeridian, orders each edge canonically so an edge and its reverse produce identical vertices, is idempotent, and is bounded **[M]** (`geodesy.test.ts`).
- Runtime adapter: the spike builds area outlines with the same helper.

## 4. How the pipeline protects features

1. Resolve each feature before simplification: canals become overlay lines (Natural Earth centreline or authored line); straits are measured on the unsimplified source.
2. **Sealing detection:** if a strait's longest water interval is below half its reference, the base data seals it. The pipeline then injects the catalogue's fallback overlay, or fails with `MapDataError` if none exists. No real feature triggered this today (Natural Earth keeps all nine straits open) **[M]**; the path is covered by a synthetic test.
3. **Pinning:** land vertices within a corridor around each open passage are never removed by per-level simplification.
4. Per-level simplification is Douglas-Peucker in Web Mercator at 0.35 px per level.
5. Overlays are written as a `protected` layer in the same tiles with stable feature ids at every level from `requiredFromZoom`.
6. Water overlays draw at `renderedWidthPixels` (2.5 px) regardless of physical width. **This is a deliberate exaggeration**: the Suez Canal is under 300 m wide and the Corinth Canal about 25 m.

**Pinning is not shown to be necessary at the shipped tolerance.** With 0.35 px simplification, validation passes with pinning on and off **[M]**. At 2 px and 4 px it fails without pinning (Dardanelles narrowing, Bab-el-Mandeb, Malacca and Hormuz displacement) and passes with it (`evidence/g03-g04/ablation-pinning.txt`). So the validator detects the failure it is meant to detect, and pinning is insurance for coarser levels, not a demonstrated fix at the current one.

## 5. Validation results [M]

Run on the real pack (13,241 tiles, z0 to z7). `validation.json`: 56 checks, 0 findings.

| Check | Result |
|---|---|
| Presence, stable id, duplicate overlay, orphan segment, displacement, sealed-land, continuity, per feature per level | 0 findings; for canals the worst overlay-to-authored deviation was 632 m at z3 (quantisation), 40 m at z7, against limits of 1.5 to 6 km |
| Strait passage narrowing and displacement per level | 0 findings; for example Bosporus 1,094 m at source, 1,090 m at z7 |
| Tile-edge continuity of the land layer, all levels | 0 mismatches over 626,544 shared-edge samples (18,404 tile pairs at z7); 6 samples ambiguous within 1.5 units and excluded |
| Probe endpoints and reference widths | 1 probe finding on the first run (Bab-el-Mandeb transect ended in water); fixed and recorded in `first-bake-with-probe-finding.log` |

**Negative tests** (`bake.test.ts`): a sealed strait without fallback fails explicitly; a missing overlay reports `closure` with feature id and level; a dropped tile reports `tile-edge-continuity`; shifted overlays report `orphan-segment` and `max-displacement`; a canal overlay passes through a sealed isthmus and a dropped tile at z6 is reported against it.

**Neighbour-crack test** (`area-cracks.test.ts`, the test previously missing): the 36 sea-area outlines contain 201 edges. They share no exactly identical edge; the only shared boundaries are **10 partially overlapping collinear edge pairs**. Over 436 densified vertices on those spans the worst crack is 4.6e-10 m, well inside the 10 m tolerance. Shared-edge identity for exactly shared and oblique edges is proved synthetically (`geodesy.test.ts`).

**Rendered check in the packaged app** (`globe-spike-land.mjs`, task `protected`): 19 canal views and 31 strait views across globe, transition and planar projection. Every canal reads as water along its visible centreline and every strait stays open where at least 1.5 px wide; the legacy runtime coastline renders Suez and Panama as sealed land (water fraction 0.00 to 0.05), so the test can detect the defect it guards against. These thresholds were adjusted after first-run failures, all of which were test artefacts: the one-pixel sea-area outline drawn over the canal read as land, overscaled zooms needed a quantisation tolerance, and coast outlines eat part of a narrow gap. The changes are in the script history and the final criteria are stated in the check names.

## 6. Defects touching G-04

- **Edge ambiguity:** resolved (section 3).
- **Zero-height container:** regression covered (see the G-03 report): `map-container.test.ts` and non-zero container checks in every packaged mode. The historical cause of the black window remains probable, not proven.

## 7. Limitations and follow-up tickets

| Ticket | Gap |
|---|---|
| G-04a | Replace the authored Corinth and Kiel lines (and the Bosporus and Dardanelles fallback lines, which are unexercised) with a centreline from an approved source |
| G-04b | The Hormuz and Malacca transects cross the wide parts (109 km and 152 km) and do not resolve the true narrows; the Singapore Strait and Little Belt are not assessed |
| G-04c | At zoom above 7 the overlay keeps its z7 quantisation (about 3 px at z12.5); acceptable against 1.5 to 6 km accuracy classes, not for a surveyed canal |
| G-04d | **passed-with-limitations**: ADR-0323 records that canal geometry above z7 needs an approved larger-scale source; Natural Earth cannot supply it and source selection stays blocked on G-01a |
| G-04e | **passed**: ADR-0323 (geographic sources and protected overlays) and ADR-0324 (edge semantics, offline tiling and renderer boundaries), accepted for the spike only |

No unapproved data is committed: catalogue coordinates are Natural Earth derived or Bluewave-authored, and no OSM or GSHHG data was used.

## 8. Re-validation after G-03a

The area outlines are now baked into the same pack as the protected overlays (G-03a). The
protected catalogue, the resolution and every probe are unchanged. The combined validation on
the new pack is 126 checks with 0 findings: 56 protected checks and 70 area-outline checks. All
13 features remain evaluable, the six canal/passage features are not sealed, and the nine
straits keep their documented probes. The schematic Corinth/Kiel and wide-probe Hormuz/Malacca
limitations, the unassessed Singapore Strait and Little Belt, and the pinned-only-at-coarser-
tolerances result are all unchanged. ADR-0323 records the source and overlay decisions;
ADR-0324 records the edge semantics and tiling decisions.

## 9. Final branch validation

`pnpm check` and `pnpm test:scripts` were run sequentially and alone on `39c05f0e`; both exited 0
(541 s and 12 s; workspace 12,228 tests passed with 1 skipped, e2e 39/39, scripts 410/410).
Evidence: `evidence/final-gates/`. No code changed in that pass.

G-04d and G-04e are **complete (done)**: G-04d passed-with-limitations per ADR-0323 (canal
geometry above z7 needs an approved larger-scale source, blocked on G-01a), and G-04e passed.
ADR-0323 and ADR-0324 remain accepted for the Phase 0/1 investigation spike only; they do not
authorize production migration, Phase 2 or G-07, and they keep the legal and data-quality
limitations. Investigation geometry is not authoritative simulation topology. No OSM, GSHHG or
other unapproved geographic data entered the repository or package in this pass.
