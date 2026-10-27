# Phase 0 / Phase 1 execution report and ledger

## 1. Repository and branch baseline

- Repository: `<repo>` (`origin` https://github.com/joaooliveira92/iron-tide.git), main checkout on `dev` at `b77d6b30`, clean at start and clean at end (untouched).
- Work done in worktree `.worktrees/globe-phase-0-1` on branch `feat/globe-phase-0-1`, created with `pnpm worktrees new globe-phase-0-1` per ADR-0237 (the tool names the branch `feat/...`, not `spike/...`). Worktrees in use: 2 of 5.
- Instructions read: `AGENTS.md`, `apps/desktop/AGENTS.md`, `docs/agents/desktop-snap.md`, ADR-0237, ADR-0320 (CSP), `csp.ts`, `index.ts`, `shellGuards.ts`, `electron-builder.yml`, `electron.vite.config.ts`, `packaged-smoke.mjs`, `check-renderer-bundle.mjs`.
- Nothing was merged, pushed, or published. No `src/main` file changed. No save-format, simulation, or coordinate change.

## 2. Prior investigation inventory

`globe-hybrid-investigation.zip`: 2,782,964 bytes, SHA-256 `dca9f6e6fd5390592d44ae6c13b9c41df99c22259b594a860b1b065dd502cfcb`, 33 files (38 entries with directories). Extracted copy matches for the files compared (`poc/main.mjs`, `poc/public/app.js`, `numerics/model.mjs`, `tickets.md`). Prior claims were not accepted on trust; the ones re-measured here: camera mapping (re-derived and tested), pure-sphere error (previously measured, not re-run), probes and 110-row deep-zoom sweeps (re-run in the packaged app), CSP/offline (re-run packaged), coastline quantisation and canals (re-measured on the repo blob and on official source data).

## 3. Execution order and status

| Order | Ticket | Status | Commit |
|---|---|---|---|
| 1 | G-00 packaged CSP | **passed-with-limitations** | `def63359` |
| 2 | G-01 data licence/size | **passed-with-limitations** (`requires-legal-review` for z > 8) | none (reports + scripts in the bundle) |
| 3 | G-02 geo-math | **passed** | `64d9d9e9` |
| 4 | G-08 densify tests | **passed-with-limitations** | `f03967d2` |
| 5 | Validation harness, baseline, deep zoom, picking, hidden markers, input, a11y | **done; defects found** | `a646d1ab` |
| - | G-03, G-04, G-06, G-07, G-10, G-11, G-13, G-14, G-16, G-17 | not-started or in-progress (spike only) | see ticket plan |
| - | G-12 cross-GPU | **blocked-external** | protocol written |
| - | G-18-G-20 | **out-of-scope** (not authorized) | |

Not every eligible Phase 1 ticket was completed; the unfinished list is in `phase-0-1-decision.md` section 5.

## 4. Commits (all passed the full `pnpm preflight`, 53/53 gates, on commit)

1. `def63359` build(map): bundle MapLibre worker behind a spike flag for the packaged CSP gate
2. `64d9d9e9` feat(map): add tested geo-math for the sphere-to-plane camera model
3. `f03967d2` feat(map): add deterministic edge densification and horizon helpers with tests
4. `a646d1ab` test(map): add packaged validation and baseline harnesses for the globe spike

A fifth commit adds these reports under `docs/research/globe-map-phase-0-1/`.

## 5. Files changed (b77d6b30..a646d1ab; 21 files, +3,090/-1)

`.gitignore` (+1: git-ignore the generated glyph PBFs); `apps/desktop/package.json` (+2: `maplibre-gl` 6.16.0, `build:globe-spike`); `pnpm-lock.yaml` (+154); `apps/desktop/electron.vite.config.ts` (+3: `__GLOBE_SPIKE__` define); `apps/desktop/src/renderer/main.tsx` (wrapper); scripts `globe-spike-smoke.mjs`, `globe-spike-validate.mjs`, `map-baseline.mjs`; and `components/globe-spike/`: `GlobeSpike.tsx`, `GlobeSpikeHost.tsx`, `MapEntityList.tsx`, `densify.ts` (+test), `geo-math.ts` (+test), `horizon.ts` (+test), `spike-areas.ts`, `globe-spike-scene.ts`, `globe-spike-errors.ts`, `globe-spike-flag.ts`.

## 6. Gates and commands run

- `pnpm --filter @bluewave/desktop lint` and `typecheck`: clean on every commit.
- `pnpm --filter @bluewave/desktop exec vp test run src/renderer/components/globe-spike/`: 34/34 tests (geo-math 18, densify 8, horizon 8).
- `pnpm preflight` (53 gates) via the pre-commit hook on all four commits: pass.
- `pnpm --filter @bluewave/desktop build` (default and `build:globe-spike`), `electron-builder --mac --dir`.
- Packaged smoke: `globe-spike-smoke.mjs` (29/29 on the G-00 build; 27/29 on the extended build, see below), under OS-level network denial (29/29); `pnpm smoke:packaged` on the default build (22/22 on final code).
- `globe-spike-validate.mjs` runs: main, DPR 1, browser zoom 1.5, capped bench (the uncapped bench is recorded as invalid), hidden/input/a11y re-run.
- `pnpm test:scripts` and the repo's full `pnpm check` were **not** run: the work adds no script under `scripts/` and `check` is the once-per-branch gate for a deliverable; run both before any merge.
- Working tree at the end: clean on the branch after commit 4.

## 7. Failures and retries (all recorded, none hidden)

| What | Cause | Resolution |
|---|---|---|
| Hook blocked first G-00 commit: `git add` of a `.d.ts` | repo `.gitignore` ignores `apps/*/src/**/*.d.ts` | the declaration was unnecessary; removed |
| Hook: format | three files unformatted | `vp fmt` on those files only |
| Hook: `assert-presentation-formatting` | ad-hoc `.toFixed` | use `formatFixed` |
| Hook: `verify-no-unknown-casts` | `as unknown as` in the spike | typed narrowing |
| Hook: `assert-tagged-errors --scope surface` | plain `throw new Error` | tagged `GlobeSpikeError`/`GeoMathError` |
| Three gates exit 137 | siblings cancelled after the first failure; once also my concurrent 12 GB job | reran alone |
| `sandbox-exec` run: Chromium sandbox aborts | seatbelt cannot nest | `--no-sandbox` for that run only, documented |
| First `sandbox-exec` profile leaked an external connection | `local ip` rule matched outbound sockets | profile rewritten, controls re-verified before use |
| Tile-size measurement wrong at z7+ | `geojson-vt` lists only generated tiles | breadth-first enumeration |
| Island/strait probes wrong | probe coordinates outside loaded regions | probes and regions corrected |
| `ELECTRON_RUN_AS_NODE=1` in the user's shell | Electron ran as Node | `env -u ELECTRON_RUN_AS_NODE` |
| Spike window black / harness stalls / 2.05 px "precision error" | my rewrite gave the map container zero height (MapLibre CSS overrode `absolute inset-0`); the step-by-step harness was also slow because of CDP round trips | fixed layout with inline style; in-page sweep loops; re-measured (0.066 px) |
| Wheel-zoom and keyboard checks failed | my test assumed globe zoom is pan-invariant; `easeTo({around})` is imprecise off-centre | pure-zoom reversal test; iterative anchor correction; tolerances documented |
| Hidden-marker checks failed | formula vs render mismatch (real) | recorded as defects; tests now measure margins |
| Extended-build smoke 27/29 | constant retained +27 listeners/+97 nodes after close vs pre-open baseline (flat across 10 cycles) | recorded as limitation N-09; threshold left strict so it keeps failing |
| Uncapped benchmark | unbounded rAF queue, multi-second stalls | not used |

## 8. External blockers

Legal review (ODbL scope, GSHHG licence), second GPU class hardware, Windows/Linux machines, Fleet the Waves 3 observation. All are `blocked-external`; nothing else is waiting on them except Phase 2 exit.

## 9. Ledger

| Ticket | In scope | Actions | Evidence | Commands | Remaining uncertainty | Final |
|---|---|---|---|---|---|---|
| G-00 | yes | spike flag, worker via `?url`, smoke script, packaged runs, OS-level offline | `evidence/g00-final`, `g00-offline-os` | build:globe-spike, electron-builder --dir, smoke | Windows/Linux, packaging footprint | passed-with-limitations |
| G-01 | yes | licence fetches, downloads with hashes, 5 datasets measured, OSM full-res region tiles | `g01/results*.json`, report | measure scripts | ODbL/GSHHG legal; global z12 size is an estimate | passed-with-limitations |
| G-02 | yes | geo-math + 18 tests | commit `64d9d9e9` | vp test | none | passed |
| G-08 | yes | densify + 8 tests | `f03967d2` | vp test | neighbour cracks | passed-with-limitations |
| Validation | yes | harness, runs | `evidence/validate*`, report | validate script | single GPU; black-window cause probable only | done, defects |
| G-12 | yes | protocol | `cross-gpu-protocol.md` | - | needs hardware | blocked-external |
