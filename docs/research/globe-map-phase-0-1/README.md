# Globe map, Phase 0 and Phase 1 validation

Start with `phase-0-1-decision.md` (CONDITIONAL_GO), then `phase-0-1-execution-report.md`.

| File | Contents |
|---|---|
| phase-0-1-decision.md | decision, gates, conditions before Phase 2 |
| phase-0-1-execution-report.md | baseline, ordering, commits, failures, ledger |
| g-00-packaged-csp-report.md | packaged CSP gate |
| g-01-data-license-and-size-report.md | datasets, licences, measured sizes |
| g-03-offline-tile-bake-report.md | deterministic Natural Earth tile bake, sizes, offline, benchmark |
| g-04-protected-features-report.md | protected maritime feature catalogue, validation, limits |
| baseline-and-benchmark-report.md | current renderer vs hybrid spike, deep zoom, picking |
| updated-ticket-plan.md | G-00..G-20 corrected status plus new tickets |
| cross-gpu-protocol.md | how to collect the missing hardware evidence |
| ftw3-observation-checklist.md | observation checklist for Fleet the Waves 3 (unverified) |
| evidence/ | raw JSON and logs behind every number |
| offline/deny-net.sb | macOS `sandbox-exec` profile used for the OS-level network denial |

Commands: see the reports. The spike is flag-gated: build with `pnpm --filter @bluewave/desktop run build:globe-spike`, package with `electron-builder --dir`, run `apps/desktop/scripts/globe-spike-smoke.mjs`, `globe-spike-validate.mjs` and `map-baseline.mjs`. Unset `ELECTRON_RUN_AS_NODE` when launching Electron. Source-data scripts (`numerics/`, `g01/`, `poc/`) are in the reproducibility bundle `phase01-reproducibility-bundle.zip` kept outside the repository because they download and process third-party data.

No third-party map data is committed. Generated glyph PBFs are git-ignored.
