# Globe adapter performance notes (interaction-parity branch)

**Measured on the parity build at `49cf9690`:** three clean packaged adapter runs
held 61 rAF/s with a 17.7 ms zoom-out maximum, zero frames over 33.4 ms and zero
long tasks. That is the same window as the audit's clean adapter runs (17.6-17.8 ms)
and shows no repeatable parity regression. It is not GPU headroom and it is not a
cross-GPU claim.

The audit's accepted benchmark protocol remains
`apps/desktop/scripts/globe-audit-benchmark.mjs`. The packaged adapter build used
the baked Natural Earth pack (`2b7b264e...`).

## What the parity branch changes in the frame path

- Hover work is coalesced into one animation frame and performs one rendered-feature
  query per frame; no timer or per-pointer-event query loop was added.
- Layer toggles change source filters or layout visibility, not geometry.
- Fleet drag disables `dragPan` only while a draggable fleet is held.
- New listeners and the hover frame are registered in the existing disposal
  registry, so repeated open/close retains the audited bounded lifecycle.

## Measurements

| Run | Refresh | Zoom-out p95 | Zoom-out max | >33.4 ms | Long tasks |
|---|---|---|---|---|---|
| 1 | 61 Hz | 17.6 ms | 17.7 ms | 0 | 0 |
| 2 | 61 Hz | 17.6 ms | 17.7 ms | 0 | 0 |
| 3 | 61 Hz | 17.7 ms | 17.7 ms | 0 | 0 |

Raw data: `evidence/parity/adapter-parity.json`.

The historic 50-83 ms hitch still cannot be reproduced on this machine. #342 keeps
the protocol for a reproducing host:

1. Run on a host that reproduces 50-83 ms globe frames.
2. Build with `pnpm run build:globe-adapter` and package with
   `electron-builder --mac --dir --config electron-builder.yml`.
3. Run `node scripts/globe-audit-benchmark.mjs --runs 3 --label after --app <app>`
   with the same viewport, DPR, refresh rate, power mode and warm-up as the audit.
4. Capture `--trace` and compare `CrGpuMain`/`SkiaOutputSurfaceImplOnGpu::SwapBuffers`
   and `IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn` against
   `evidence/adapter/trace-summary.json`.
5. Record median, p95 and maximum rAF gaps plus long tasks; keep capped-vsync runs
   only.

No claim is made about GPU headroom, cross-GPU behaviour, Windows/Linux, or a fix
for the historic 67 ms label.
