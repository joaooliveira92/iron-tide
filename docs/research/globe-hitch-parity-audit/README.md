# Globe production enablement and interaction-parity audit

**Status: production enabled on `dev` (2026-10-28).** The globe adapter is the default
Overview renderer and the current SVG renderer remains a tested rollback fallback
(ADR-0327). The packaged production candidate passes 58/58 applicable parity rows with
13 documented not-applicable rows, 15/15 packaged pointer/keyboard checks, 48/48
packaged adapter checks, the default guard and the packaged smoke. #342 is closed as
not reproduced on the available hardware; its protocol is preserved for a reproducing
host.

Base: `perf/globe-hitch-parity-audit` at `a6b1fa3f` (from `5aaf7182` on
`feat/globe-phase-0-1`). The Phase 0/1 decision remains **`CONDITIONAL_GO`**; this
implementation does not upgrade it.

| Question | Verdict |
|---|---|
| Historical ~67 ms zoom-out hitch | **Not reproduced** in 22 clean globe launches. Candidate phase is GPU/compositor sync. No fix. Child #342. |
| Current-renderer comparison | Reproduced a **51 ms** zoom-out with 54/61 ms main-thread long tasks; 150-183 ms under contention. The "~67 ms" label is not globe-specific. |
| Interaction parity | **71 rows**: 58 pass, 0 fail, 0 blocked, 13 not-applicable after `49cf9690`. Implementation evidence: `interaction-implementation-report.md`. |
| Lifecycle N-09 | Parity adapter flat at 548 listeners / 813 detached nodes after first close; live DOM returns to baseline; legacy spike unchanged at +27 / +97. |
| Globe default; SVG rollback | Proven by the packaged smoke (globe mounts, diagnostic `globe`, legacy rollback via `#legacy-renderer` and 36 SVG area buttons) and the default guard. |

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

The packaged adapter smoke now exercises the chrome mirror, minimap, frame meter,
area table, layer/projection controls, fallback and lifecycle (48/48). Pointer and
keyboard gestures are covered by component tests against a fake MapLibre map; a
packaged pointer/key pass remains pre-enablement evidence.

## 3. Lifecycle

Full method and numbers: [`lifecycle-findings.md`](lifecycle-findings.md).

- Adapter: 471 listeners / 139 nodes baseline, 497 / 272 after the first close and after the
  fifth; workers 0 -> 0; heap 14.7 -> 15.0 MB. CDP attribution: 13 Playwright window listeners,
  one MapLibre `visibilitychange`, detached harness/library nodes.
- Legacy spike: 473 / 135 baseline, 500 / 232 after the first and fifth close; +27 listeners,
  +97 nodes; heap 15.7 -> 16.5 MB. The two strict N-09 checks still fail, unchanged.
- No fix; the adapter disposal behaviour is already correct and the spike is throwaway.

## 4. Renderer status proof

- Default package guard: **PASS**, mode `default`, 16,494 files, 15 allowed runtime map
  assets, 0 violations, `app.asar` 204,020,415 bytes (budget 216,000,000).
- Default packaged smoke: **29/29 PASS**, including the globe default, the renderer
  diagnostic, the legacy rollback and returning to the globe. `test-results/`.
- Adapter packaged smoke: **48/48 PASS**, including missing/corrupt/forced fallback and the
  lifecycle ceilings. `test-results/globe-adapter/globe-adapter-smoke.json`.
- Packaged interaction smoke: **15/15 PASS** (pointer, shift-click route, hover, drag/drop
  accept and reject, keyboard pan/zoom/reset/area, layers, projections, reduced motion).
- Spike packaged smoke: 28 PASS / 2 known N-09 FAIL, as before. `evidence/spike/result.json`.
- The production build includes the adapter by default (`__GLOBE_ADAPTER__ = true`); only an
  explicit `VITE_BLUEWAVE_GLOBE_ADAPTER=false` build omits it and aliases the inert stub.

## 5. Production decision

**The globe adapter is the default Overview renderer and the SVG renderer is the rollback
fallback (ADR-0327).** The evidence that originally gated promotion is now recorded:

1. **Interaction parity is packaged.** The packaged interaction smoke covers the pointer,
   keyboard, route, hover, drop and control surfaces; component tests cover cancellation,
   back-side and horizon cases.
2. **The historic hitch is cross-renderer.** It did not reproduce for the globe in clean
   runs; the SVG renderer produced 66.7-100.1 ms zoom frames and the globe produced 84.3 ms only
   under controlled CPU contention. #342 is closed as not reproduced with its protocol
   preserved.
3. **Lifecycle is bounded.** 548 listeners / 813 detached nodes, flat across five cycles,
   live DOM at baseline, zero workers, heap 20.1-20.4 MB; explicit ceilings are enforced.
4. **Production scope is Natural Earth z7.** OSM and GSHHG are excluded; higher-resolution
   data needs a separate legal and technical decision. The z7 ceiling and overscaling are
   disclosed in the UI.
5. **Platforms and fallback are defined.** macOS is the graphical validation host; Windows
   and Linux are supported release targets validated by the CI package matrix. WebGL and
   asset failures fall back to the SVG renderer.

### Evidence this audit still did not produce

- Cross-GPU or low-end GPU evidence; only Apple M4 / Metal.
- Native Windows/Linux graphical interaction runs (packaging/guard/asset checks are in CI).
- GPU hardware timer queries or a direct trace of a 50-83 ms globe frame.
- A legal decision on ODbL/GSHHG or data above z7.
- A Fleet the Waves 3 observation (kept as optional competitive research).
- Native NVDA/VoiceOver or Windows high-contrast runs; the axe and aria-tree evidence is
  recorded in the production report.

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
    parity/
      globe-adapter-smoke.json
      adapter-packaged-smoke.txt
      globeadapter-guard.json
      globeadapter-guard.txt
      packaged-smoke.txt
      default-guard.json
      adapter-parity.json
      environment.txt
```

The raw 35 MB CDP trace is not committed. Regenerate it with
`apps/desktop/scripts/globe-audit-benchmark.mjs --runs 1 --trace`; the committed
`trace-summary.json` contains the full thread maxima and the events around the largest rAF gap.
The contended default runs in `default-contended/` are recorded for transparency and excluded
from every conclusion.

## 7. Parity validation

- Adapter packaged smoke: **48/48 PASS**, including the area mirror (36 buttons),
  SR area table (36 rows), minimap, frame meter, layer controls, forced/missing/
  corrupt fallback, no remote request, worker return and bounded lifecycle.
- Packaged interaction smoke: **15/15 PASS**; see the matrix's packaged evidence section.
- Default package guard: **PASS**, 15 allowed runtime map assets, 0 violations,
  `app.asar` 204,020,415 bytes; default packaged smoke 29/29.
- Performance: three clean runs at 61 rAF/s, zoom-out p95 17.1-33.4 ms and max
  34.4 ms, zero zoom-out long tasks; see `performance-notes.md`.
- Focused tests: adapter/chrome/contract/axe tests pass (14 files).
- Accessibility: axe chrome pass; packaged aria snapshot contains the application, area
  navigation, area control table and entity table; native screen-reader combinations remain
  post-release.
- Offline: packaged app served from `file:`; no non-local request in any smoke.

## 8. Reproduction commands

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
