# Globe Overview production enablement

Date: 2026-10-28. Decision: ADR-0327. Parent tracker: #341. Hitch issue: #342.

## Classification

**Production enabled on `dev`.** The globe adapter is the default Overview renderer.
The SVG Overview renderer remains a supported, tested rollback fallback. The separate
Strategic Map screen keeps the SVG renderer in this release; it has different order-panel
and drag workflows and was not part of the Overview enablement scope. No P0/P1
production-readiness defect remains. Windows/Linux graphical validation and native
screen-reader/high-contrast combinations are post-release validation, not enablement
blockers, because packaging/guards/fallback are covered and macOS graphical evidence
is complete.

## Scope

- Dataset: Natural Earth 10m land, minor islands and canal centrelines, baked at
  z0-z7. Pack SHA-256 `2b7b264e928124d314c577b9bb112c1e79b9db8c85329030eeae931e12952b16`,
  5,678,007 bytes.
- No OSM-derived data. No GSHHG. No raw source archive, cache, bake input or evidence
  ships in the production package.
- Fonts: three Inter SDF ranges (ASCII, Latin-1 supplement, general punctuation) under
  the SIL OFL, with the licence text shipped in `map-assets/glyphs/OFL.txt`.
- Overscaling beyond z7 is disclosed in the status/legend; the UI does not claim
  higher-resolution source geometry.

## Environment

- Apple M4, 10 cores, macOS 27.0.1, Electron 44.9.2 packaging, app version 4.0.0.
- ANGLE Metal Renderer: Apple M4 (WebGL2), 1470x868 CSS viewport, DPR 2, 61 Hz.
- Packaged `--dir` build from `dist-electron/mac-arm64/Bluewave.app`.

## Evidence summary

| Gate | Result | Artifact |
|---|---|---|
| Parity matrix | 58 pass, 0 fail, 13 not-applicable with rationale | `docs/research/globe-hitch-parity-audit/interaction-parity-matrix.md` |
| Packaged pointer/keyboard | 15/15 | `apps/desktop/test-results/globe-interactions/` |
| Packaged adapter smoke | 48/48 | `apps/desktop/test-results/globe-adapter/` |
| Default packaged smoke | 29/29 | `apps/desktop/test-results/packaged-smoke.png` |
| Default package guard | PASS, 15 allowed assets, 0 violations | this report |
| Performance budget | PASS in 3 clean runs | `apps/desktop/test-results/perf-accepted/` |
| Lifecycle | Flat 548 listeners / 813 nodes; ceilings enforced | `globe-adapter-smoke.json` |
| Axe (chrome) | PASS | `GlobeAdapterChrome.a11y.test.tsx` |
| ARIA tree | Application, 36 area buttons, 36-row area table, entity table | `.dev-data/globe-snap/aria.yaml` |
| Reduced motion | PASS in packaged interaction pass | `globe-interactions.json` |
| Offline | `file:` only; zero remote requests in every smoke | smoke reports |
| Rollback | `localStorage`/query/hash to SVG; packaged smoke + 36 SVG areas | `packaged-smoke.mjs` |

## Performance

Budget: refresh >= 55 Hz, idle p95 <= 34 ms, pan max <= 50 ms, zoom-in p95 <= 34 ms
and max <= 100 ms (one first-use warm-up frame), zoom-out p95 <= 34 ms and max
<= 50 ms, zero zoom-out long tasks, settle <= 100 ms.

Clean runs: zoom-out max 33.6 / 34.4 / 34.1 ms, p95 17.1-33.3 ms, zero long tasks;
zoom-in max 17.7 / 17.6 / 99.3 ms with p95 17.1-33.4 ms. The SVG renderer measured
66.7-100.1 ms zoom frames, 67.6-84.3 ms pan and up to 40 long tasks in the same session. Under controlled CPU
contention the globe reached 84.3 ms once; the SVG renderer's audit contention runs
were 150-183 ms. The historic 50-83 ms zoom-out hitch is therefore cross-renderer frame
pacing, not a globe-specific regression.

#342 is closed as not reproduced on available hardware. The protocol is preserved in
`docs/research/globe-hitch-parity-audit/performance-notes.md`.

## Accessibility

- axe-core: no violations in the production chrome/accessibility mirror.
- Packaged keyboard: zoom, pan, reset, return north, area activation, layers,
  projections, reset view.
- ARIA snapshot: `Strategic world map, ...` application with key hints; `Map areas`
  navigation with 36 buttons named by ownership and fleet count; `Area control` table
  with 36 rows and `aria-selected`; `Globe adapter entities` table.
- Reduced motion enabled for the packaged interaction pass.
- Not run: native NVDA/JAWS/VoiceOver and Windows forced-colors. These remain
  post-release validation; no universal-accessibility claim is made.

## Platforms and fallback

- macOS: graphical packaged validation complete.
- Windows and Linux: supported release targets (release workflow builds both). CI adds
  packaged build, asset inclusion, default guard and startup/fallback checks; graphical
  interaction on those hosts remains post-release.
- Capability detection: WebGL2 then WebGL; no context, initialization error, missing
  pack, corrupt pack, forced failure and unsupported container all fall back to the SVG
  renderer with a structured reason and no retry loop.

## Rollback

1. Set `localStorage["bluewave.overviewRenderer"] = "legacy"` (or open with
   `?renderer=legacy` / `#legacy-renderer`).
2. The next Overview mount renders the SVG map. No save migration, map-data change or
   reinstall is required.
3. Remove the key (or use `"globe"`) to return to the globe. `#globe-renderer` forces
   the globe for development.

## Explicitly out of scope

- OSM/ODbL and GSHHG. These are not used and are not approved by this decision.
- Higher-resolution geography beyond the Natural Earth z7 pack; a separate legal,
  licensing and pack-size decision is required.
- Fleet the Waves 3 direct-equivalence observation; competitive research only.
- Additional GPUs and native screen-reader/high-contrast combinations; post-release.
