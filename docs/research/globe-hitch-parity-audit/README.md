# Globe hitch isolation and Overview interaction-parity audit

**Status: interaction-parity engineering complete on `feat/globe-interaction-parity`
(commit `67a7a18f`), pushed for review. The adapter remains off by default and the current
Overview renderer remains the default and the failure fallback. Nothing was merged or
released. The historic hitch is still unreproduced on the tested machine; #342 remains
hardware-blocked.**

Branch: `perf/globe-hitch-parity-audit`, created from `5aaf7182` on `feat/globe-phase-0-1`.
Work was done at `5aaf7182ba2878a8531a15cf9b03d6447b12b725`. The Phase 0/1 decision remains
**`CONDITIONAL_GO`**; this audit does not upgrade it.

| Question | Verdict |
|---|---|
| Historical ~67 ms zoom-out hitch | **Not reproduced** in 22 clean globe launches. Candidate phase is GPU/compositor sync. No fix. Child #342. |
| Current-renderer comparison | Reproduced a **51 ms** zoom-out with 54/61 ms main-thread long tasks; 150-183 ms under contention. The "~67 ms" label is not globe-specific. |
| Interaction parity | **71 rows**: 58 pass, 0 fail, 0 blocked, 13 not-applicable after `67a7a18f`. Implementation evidence: `interaction-implementation-report.md`. |
| Lifecycle N-09 | Adapter flat at 497 listeners / 272 nodes after first close; legacy spike unchanged at +27 / +97. New parity listeners are in the disposal registry. |
| Adapter off by default; current renderer default and fallback | Proven by default package guard and 23/23 packaged smoke, and by the adapter smoke's "adapter inactive by default" check. |

## Findings ledger

| ID | Kind | Surface / phase | Reproduction | Evidence | Root cause | Disposition | Status |
|---|---|---|---|---|---|---|---|
| H-01 | hitch | zoom-out | Not reproduced in 22 clean launches: 18 spike (9 baked + 9 runtime) and 4 adapter launches at 61 rAF/s | `hitch-report.md`; `evidence/spike/`; `evidence/adapter/` | Bounded to GPU/compositor sync; main-thread JS and synchronous tile prep excluded for the adapter trace | Child #342; no code fix | closed-unreproduced, follow-up open |
| H-02 | hitch | cold-start zoom-in | One 66.6 ms frame with a 70 ms main-thread task in adapter launch 1; clean in launches 2-4 | `evidence/adapter/adapter-bench.json` run 1 | First-use main-thread setup (shader/glyph/tile warm-up candidate); not proven | Recorded only | open-low |
| P-01 | parity | shift-click route reading | Code path present but unreachable: MapLibre boxZoom suppresses the click; no route readout | `interaction-parity-matrix.md` P-05, C-23 | MapLibre `boxZoom` default plus missing readout UI | Child #343 | open |
| P-02 | parity | marker selection and fleet orders | Fleet click selects the area; no drag/drop ordering | Matrix P-06, P-16 | `onSelectFleet`/orders never wired to markers | Child #344 | open |
| P-03 | parity | area hover | No hover paint or tooltip; store hover has no consumer | Matrix P-08, P-09 | Hover state recorded but no layer or query | Child #345 | open |
| P-04 | parity | layer toggles | 5 of 7 toggles have no effect; borders and graticule absent | Matrix C-06 to C-10, C-13 | Layer state not mapped; missing layers | Child #346 | open |
| P-05 | parity | chrome, panels, layout, initial focus | No minimap/legend/scale/inspector/route readout/area tree/centre/meter/panel sizing/dock; home focus dropped | Matrix C-14 to C-27, C-33 | Presentation and layout were never built into the adapter | Child #347 | open |
| P-06 | parity | projection, reset, centre | Projection is local-only; reset clears bearing only; no centre slider | Matrix C-03, C-04, C-14 | State semantics were never mapped | Child #348 | open |
| P-07 | parity | keyboard and screen-reader area access | No per-area nodes, focus, activation, aria-pressed or area SR table | Matrix K-07, K-08, A-02, A-03, A-04, A-08 | Canvas-only rendering with a port/fleet-only DOM mirror | Child #349 | open |
| L-01 | lifecycle | open/close | Adapter 471/139 baseline -> 497/272 flat; spike 473/135 -> 500/232 unchanged | `lifecycle-findings.md`; `evidence/adapter/globe-adapter-smoke.json`; `evidence/spike/result.json` | Adapter disposal registry works; spike retention is bounded throwaway state | No fix | adapter resolved; spike unchanged |

## 1. Hitch isolation

Full protocol, numbers, attribution and limitations: [`hitch-report.md`](hitch-report.md).

- The accepted G-03a benchmark's 50.8/50/50.9 ms baked and 34.3/83.4/66.7 ms runtime zoom-out
  observations did not reproduce. The spike produced 17.7 ms in all 18 launches.
- The adapter produced 17.6-17.8 ms in three launches and one 33.7 ms two-frame miss.
- The current SVG Overview renderer produced 51 ms in one of three clean launches, with 54 ms
  and 61 ms main-thread long tasks. This is a different mechanism and a larger effect than the
  globe path measured here.
- The traced adapter gap: `CrGpuMain` `SwapBuffers` 14.43 ms plus
  `IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn` 13.68 ms; renderer main thread max
  8.62 ms; tile worker max 61.5 ms off-main.
- No narrow application fix is authorized. The remaining work is a trace on a machine that still
  reproduces 50-83 ms globe frames (child #342), not a code change on this branch.

## 2. Interaction parity

Full matrix: [`interaction-parity-matrix.md`](interaction-parity-matrix.md) and
[`interaction-parity-matrix.csv`](interaction-parity-matrix.csv). Implementation
report: [`interaction-implementation-report.md`](interaction-implementation-report.md).
Accessibility findings: [`accessibility-findings.md`](accessibility-findings.md).

The matrix covers pointer, keyboard, controls, layers, panels, layout, state, accessibility and
the flag/fallback surface. The audit's source-level comparison is preserved in the note column;
the verdict column and implementation-evidence section record the parity commit
`67a7a18f` and its regression tests. Every area, port and fleet now has a keyboard
path, every layer toggle maps to its own layer, shift-click reaches the route
reader, and the Overview chrome is hosted behind the existing adapter flag.

The adapter still has **no packaged interaction smoke that drives pointer or key
gestures**; component tests cover the adapter and chrome against a fake MapLibre
map. A packaged pointer/key pass belongs to the pre-enablement evidence set.

## 3. Lifecycle

Full method and numbers: [`lifecycle-findings.md`](lifecycle-findings.md).

- Adapter: 471 listeners / 139 nodes baseline, 497 / 272 after the first close and after the
  fifth; workers 0 -> 0; heap 14.7 -> 15.0 MB. CDP attribution: 13 Playwright window listeners,
  one MapLibre `visibilitychange`, detached harness/library nodes.
- Legacy spike: 473 / 135 baseline, 500 / 232 after the first and fifth close; +27 listeners,
  +97 nodes; heap 15.7 -> 16.5 MB. The two strict N-09 checks still fail, unchanged.
- No fix; the adapter disposal behaviour is already correct and the spike is throwaway.

## 4. Renderer status proof

- Default package guard: **PASS**, mode `default`, 16,207 files, 0 allowed map assets,
  0 violations, `app.asar` 195,959,497 bytes. `evidence/default/guard.json`.
- Default packaged smoke: **23/23 PASS**, including "the package holds no globe-spike, map-data
  or investigation assets" and "home map: 36 keyboard-reachable areas".
  `evidence/default/packaged-smoke.txt`.
- Adapter packaged smoke: **41/41 PASS**, including "adapter inactive by default" and the
  forced/missing/corrupt fallback checks. `evidence/adapter/globe-adapter-smoke.json`.
- Spike packaged smoke: 28 PASS / 2 known N-09 FAIL, as before. `evidence/spike/result.json`.
- The adapter is still gated by `VITE_BLUEWAVE_GLOBE_ADAPTER` plus an explicit hash; the default
  build aliases it to an inert stub (`globe-adapter-flag.ts`, `MapSurface.tsx`, electron-vite
  config).

## 5. Recommendation

**Do not promote the globe adapter and do not change the default renderer.** The
interaction-parity backlog is now implemented, but promotion still needs the
evidence below, not another parity pass:

1. **Interaction parity is implemented behind the flag.** The 37 failing rows and
   the blocked shift-click row now have implementation and component-test evidence.
   The remaining parity risk is packaged pointer/key coverage, which is absent.
2. **The "~67 ms zoom-out hitch" should stay re-scoped.** It did not reproduce on
   the current build; the current renderer produced comparable and larger hitches;
   the one traced globe gap is GPU/compositor sync. Treat it as cross-renderer
   frame pacing until a reproducing trace exists (child #342), and keep the
   cross-GPU/Windows/Linux evidence gaps open.
3. **Lifecycle is not a release blocker for the adapter.** It is flat after the first
   close and attributable; the parity listeners are in the disposal registry. The
   legacy spike finding is unchanged and irrelevant to the default package.
4. **Production enablement, merge and release remain not authorized.** Legal
   ODbL/GSHHG, cross-GPU, Windows/Linux packaged validation, Fleet the Waves 3
   observation and cross-OS determinism are untouched.

### Evidence this audit did not produce

- Cross-GPU or low-end GPU evidence; only Apple M4 / Metal.
- Windows or Linux packaged runs.
- GPU hardware timer queries or a direct trace of a 50-83 ms globe frame.
- A legal decision on ODbL/GSHHG or data above z8.
- A Fleet the Waves 3 observation or a tactical-zoom product decision.
- Cross-OS determinism.
- A full accessibility audit (axe, manual screen-reader pass) of the adapter; the matrix is
  source-level.
- A default-renderer replacement or any production enablement.

## 6. Evidence index

```
docs/research/globe-hitch-parity-audit/
  README.md
  hitch-report.md
  interaction-parity-matrix.md
  interaction-parity-matrix.csv
  lifecycle-findings.md
  interaction-implementation-report.md
  accessibility-findings.md
  performance-notes.md
  evidence/
    environment.txt
    adapter/
      adapter-bench.json
      adapter-trace.json
      globe-adapter-smoke.json
      trace-summary.json
    spike/
      spike-bench.json
      spike-bench-2.json
      result.json
    default/
      baseline.json
      guard.json
      packaged-smoke.txt
    default-contended/
      baseline.json
```

The raw 35 MB CDP trace is not committed. Regenerate it with
`apps/desktop/scripts/globe-audit-benchmark.mjs --runs 1 --trace`; the committed
`trace-summary.json` contains the full thread maxima and the events around the largest rAF gap.
The contended default runs in `default-contended/` are recorded for transparency and excluded
from every conclusion.

## 7. Reproduction commands

From the audit worktree, with the untracked map cache and `map-spike-assets` present:

```sh
pnpm install --offline
pnpm build
cd apps/desktop
pnpm run build:globe-spike
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --dir --config electron-builder.yml
node scripts/globe-spike-land.mjs --tasks bench --runs 9 --label spike-bench --app <spike-app>
node scripts/globe-spike-smoke.mjs --app <spike-app> --out <out>

pnpm run build:globe-adapter
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --dir --config electron-builder.yml
node scripts/globe-audit-benchmark.mjs --runs 3 --label adapter-bench --app <adapter-app> --out <out>
node scripts/globe-audit-benchmark.mjs --runs 1 --label adapter-trace --trace --app <adapter-app> --out <out>
node scripts/globe-adapter-smoke.mjs --cycles 5 --app <adapter-app> --out <out>

pnpm run build
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --dir --config electron-builder.yml
node scripts/map-baseline.mjs --runs 3 --app <default-app> --out <out>
node scripts/packaged-smoke.mjs --app <default-app>
node scripts/package-guard/cli.ts --mode default --package <default-resources-dir>
```

The new audit benchmark is `apps/desktop/scripts/globe-audit-benchmark.mjs`; it records rAF
deltas, long tasks, CDP task/script time, memory, diagnostics and an optional trace. It does not
change production code.
