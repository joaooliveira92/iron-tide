# Globe adapter performance notes (interaction-parity branch)

**No new frame-time measurement is claimed on this branch.**

The audit's accepted benchmark protocol remains
`apps/desktop/scripts/globe-audit-benchmark.mjs`. It needs a packaged adapter build
with the baked Natural Earth tile pack; that pack and the packaged artifacts are not
present in this checkout (`apps/desktop/public/map-data` is absent). Running the
protocol without them would not be valid evidence.

## What the parity branch changes in the frame path

- Hover work is coalesced into one animation frame and performs one rendered-feature
  query per frame; no timer or per-pointer-event query loop was added.
- Layer toggles change source filters or layout visibility, not geometry.
- Fleet drag disables `dragPan` only while a draggable fleet is held.
- New listeners and the hover frame are registered in the existing disposal
  registry, so repeated open/close retains the audited bounded lifecycle.

## Evidence still required (#342)

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
