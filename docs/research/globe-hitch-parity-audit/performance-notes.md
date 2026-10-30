# Globe adapter performance notes (production candidate)

**Measured on the packaged production candidate (2026-10-28) on Apple M4 /
macOS 27.0.1 / ANGLE Metal / 1470x868 CSS at DPR 2 / 61 Hz.** Three clean packaged
runs after a five-second inter-run cooldown. Budget and raw data:
`apps/desktop/test-results/perf-accepted/production-globe-accepted.json`.

## Acceptance budget

| Metric | Budget | Result |
|---|---|---|
| Refresh | >= 55 Hz | 61 Hz in all runs |
| Idle p95 | <= 34 ms | 17.2-17.5 ms |
| Pan max | <= 50 ms | 17.6-17.7 ms |
| Zoom-in p95 | <= 34 ms | 17.1-33.4 ms |
| Zoom-in max | <= 100 ms (one first-use warm-up frame) | 17.7 / 99.3 ms |
| Zoom-out p95 | <= 34 ms | 17.1-33.3 ms |
| Zoom-out max | <= 50 ms | 33.6-34.4 ms |
| Zoom-out long tasks | 0 | 0 |
| Settle after burst | <= 100 ms | 3.6-17.8 ms |

The budget admits one first-use shader/tile warm-up frame on zoom-in. The same
renderer measured 17.7 ms in steady runs. It does not admit the historic 50-83 ms
zoom-out hitch: the clean candidate's zoom-out maximum was 34.4 ms.

## Cross-renderer comparison

| Renderer | Zoom max (clean) | Pan max | Long tasks | Notes |
|---|---|---|---|---|
| Globe (production) | 17.7-34.4 ms zoom-out; 99.3 ms one zoom-in warm-up | 17.7 ms | 0 zoom-out | 3 clean runs |
| SVG Overview (legacy) | 66.7-100.1 ms | 67.6-84.3 ms | 0-40 | 3 runs; `test-results/perf-legacy` |

Under controlled CPU contention (four `yes` loops), the globe produced a 84.3 ms
zoom-out maximum and one long task. The SVG renderer's audit contention runs were
150-183 ms. This is consistent with cross-renderer frame pacing, not a
globe-specific hitch.

## What the production build changes in the frame path

- Same parity frame path: rAF-coalesced hover, one feature query per frame, layer
  toggles as filters/visibility, fleet drag holds `dragPan` only while held.
- Assets are local committed files copied into `out/renderer/map-assets`; no network.
- Renderer selection happens once per mount; fallback unmounts the adapter and mounts
  the SVG renderer without retrying.

## `#342` disposition

Closed as **not reproduced on available hardware**. The protocol is preserved for a
host that reproduces 50-83 ms globe frames: the commands below, three clean runs,
capped vsync, and a trace of `CrGpuMain`/`SwapBuffers`. Post-release monitoring
covers additional GPUs and low-end devices.

No claim is made about GPU headroom, cross-GPU behaviour, Windows/Linux graphics, or
a fix for the historic 67 ms label.
