# Globe hitch isolation

**Finding H-01: the historical ~67 ms zoom-out hitch did not reproduce on the current build.**
No globe-specific defect was proven, so no production fix was made. The surviving candidate is a
GPU/compositor synchronisation stall, not main-thread tile preparation. The current default
renderer produced comparable and larger frame gaps under the same protocol, including the only
51 ms zoom-out in the clean runs.

## 1. Protocol

All runs used one machine and one build of `5aaf7182` (branch
`perf/globe-hitch-parity-audit`, base `feat/globe-phase-0-1`). Frame times were sampled with
`requestAnimationFrame` deltas; long tasks with `PerformanceObserver`; main-thread work with CDP
`Performance.getMetrics` (`TaskDuration`, `ScriptDuration`); memory with `Memory.getDOMCounters`
and `Runtime.getHeapUsage`; attribution with CDP tracing (`devtools.timeline`, `gpu`, `viz`,
`loading`). No uncapped flag was used. Every run recorded 61 rAF/s.

Scripted input, identical for the spike through `globe-spike-land.mjs --tasks bench` and for the
adapter through the new `globe-audit-benchmark.mjs`:

1. open the packaged app with a fresh `--user-data-dir`, content size 1470 x 868;
2. wait for the map to become idle;
3. sample 3 s idle;
4. two pan sweeps: 40 pointer moves left/down, then 40 back, twice;
5. move the pointer to 55% width, 40% height;
6. 40 wheel steps of -200 with 80 ms between steps, then 400 ms;
7. 40 wheel steps of +200 with 80 ms between steps, then 400 ms;
8. wait for the adapter/spike `whenIdle()` and record settle time.

The current renderer was driven with `map-baseline.mjs` using its campaign flow and the same
wheel cadence. That script also records the same rAF and long-task instrumentation.

### Machine and build record

| Item | Value |
|---|---|
| Machine | Apple M4, 8-core GPU, 10 logical CPUs |
| OS | macOS 27.0.1 (26A434) |
| Display | built-in Liquid Retina, 60 Hz; second display 1360 x 768 @ 60 Hz |
| Node / pnpm / Electron | 24.18.0 / 11.21.0 / 44.9.2 |
| Commit | `5aaf7182ba2878a8531a15cf9b03d6447b12b725` |
| Pack SHA-256 | `2b7b264e928124d314c577b9bb112c1e79b9db8c85329030eeae931e12952b16` |
| Pack cache version | `natural-earth-10m-v1:2b7b264e9281` |
| Spike build | `VITE_BLUEWAVE_GLOBE_SPIKE=true`, `#globe-spike` and `#globe-spike-runtime` |
| Adapter build | `VITE_BLUEWAVE_GLOBE_ADAPTER=true`, `#globe-adapter-demo` |
| Default build | neither flag; current Overview renderer |
| Load averages | 3.6-4.3 for clean runs; 9.7-17.3 for explicitly contended diagnostics |
| Frame cap | vsync, 61 rAF/s; no `--disable-frame-rate-limit` or `--disable-gpu-vsync` |

The machine was not idle in the strict sense: the agent host itself used CPU. It is recorded as a
limitation. All clean runs held 61 Hz, so no run used for a conclusion was display-contended.
The high-load runs are labelled and excluded from the conclusions.

## 2. Runs

`evidence/spike/` contains 9 launches per mode (18 app launches). `evidence/adapter/` contains
4 clean launches plus 2 excluded contended launches. `evidence/default/` contains 3 clean
launches; `evidence/default-contended/` contains 5 excluded launches.

| Path | Launches used | Zoom-out max (ms) | Frames > 33.4 ms | Long tasks | Result |
|---|---|---|---|---|---|
| Spike, baked pack | 9 | 17.7 in all 9 | 0 | 0 | no hitch |
| Spike, runtime GeoJSON | 9 | 17.7 in all 9 | 0 | 0 | no hitch |
| Adapter, baked pack | 3 | 17.8 / 17.6 / 17.7 | 0 | 0 | no hitch |
| Adapter, traced run | 1 | 33.7 | 2 | 0 | one two-frame miss |
| Adapter, load 9.7 (excluded) | 2 | 17.8 / 17.7 | 0 | 0 | no hitch |
| Default Overview, clean | 3 | 17.7 / **51.0** / 17.8 | 0 / 29 / 0 | 0 / 2 / 0 | reproduced a 51 ms zoom-out |
| Default Overview, load 9.7-17.3 (excluded) | 5 | 183.4 / 151 / 149.9 / 150 / 166.7 | many | 40 per zoom | CPU-contended |

Clean globe total: **22 launches** (18 spike, 4 adapter), with one 33.7 ms frame gap and no
reproduction of the 50-83 ms observations. The spike's 18 launches are the direct re-test of the
G-03a path.

The default renderer under the same wheel cadence produced a **51 ms zoom-out frame** in run 2
of 3, with main-thread long tasks of **54 ms and 61 ms**, and a 66.7 ms zoom-in with 69 ms and
57 ms long tasks. Under CPU contention it produced 150-183 ms zoom-out frames and 40 long tasks
per burst. This is not a globe-only frame-pacing signature.

The adapter's first launch produced a **66.6 ms zoom-in** frame with a **70 ms long task**; runs
2 and 3 were clean. It is recorded as a cold-start observation (H-02), not as the historical
zoom-out hitch.

## 3. Historical comparison

| Source | Baked zoom-out max | Runtime zoom-out max | Long tasks |
|---|---|---|---|
| Accepted G-03a benchmark (`evidence/g03a/g03a-benchmark.json`) | 50.8 / 50 / 50.9 | 34.3 / 83.4 / 66.7 | 0 during zoom-out |
| Earlier G-03 runs (12 launches) | 17.7-18.8 | 17.7-18.7 | 0 |
| This audit, 22 clean globe launches | 17.7 (spike), 17.8 (adapter) | 17.7 (spike) | 0 |

The observation is variable, not stable. The G-03a accepted run is a real frame-time observation,
but it is not reproducible on the current build under the same wheel cadence, viewport, pack and
machine. The G-03a zero-long-task result also excludes main-thread JS for those frames.

## 4. Attribution

The traced adapter run is `evidence/adapter/trace-summary.json` (raw trace regenerates with
`--trace`; it is not committed because it is 35 MB). Its zoom-out burst contained 2 frames over
33.4 ms and a maximum of 33.7 ms.

- **Renderer main thread:** maximum task 8.62 ms (a `MajorGC` / `V8.GC_MARK_COMPACTOR`), not a
  long task. Around the largest 32.3 ms rAF gap the main thread ran only 3.19 ms of work before
  the gap and 2.52 ms at the next frame.
- **Tile worker:** largest worker task 61.5 ms. It is off the main thread and no main-thread
  long task coincides with it.
- **GPU/compositor:** the largest gap coincides with `SkiaOutputSurfaceImplOnGpu::SwapBuffers`
  (14.43 ms) and `IOSurfaceImageBacking::WaitForCommandsToBeScheduled::Dawn` (13.68 ms) on
  `CrGpuMain`, followed by a second 9.48 ms swap. GPU maximum in the trace is 20.10 ms.
- **Candidate phase:** GPU/compositor synchronisation (Metal via Dawn), not tile preparation or
  application JS. This is consistent with the G-03a data: 50-83 ms frames with zero long tasks.
- **Excluded for the globe path:** main-thread work, store apply, overlay rebuild and tile
  worker decode as the direct cause of the frame gap. The worker can still feed GPU work, so it
  is not excluded as an upstream contributor; it is excluded as a synchronous main-thread block.

The default renderer's 51 ms event has the opposite signature: 54/61 ms main-thread long tasks.
That is a different mechanism (SVG re-render/CPU) producing a similar frame duration. It makes
the historical "~67 ms" label ambiguous: the number alone does not identify one renderer defect.

## 5. Fix decision

No fix is authorized for H-01:

1. the ~67 ms zoom-out did not reproduce on the current globe build (22 clean launches);
2. the one observed gap is GPU/compositor-sync, not a narrow application defect;
3. no regression test can fail before and pass after because there is no failing behaviour to
   pin;
4. the current renderer remains default and fallback, untouched;
5. no CSP, IPC, simulation, save or licensing surface is involved.

The next step is a child issue: capture a trace on a machine that still reproduces 50-83 ms
frames, and compare the GPU/compositor phase against this 32 ms trace. The blocker should be
re-scoped from "globe zoom-out hitch" to "cross-renderer frame pacing under contention" until
that trace exists. Do not treat this audit as proof that the G-03a observation was false.

## 6. What this audit did not produce

- No cross-GPU or low-end GPU evidence; only Apple M4 / Metal.
- No Windows or Linux packaged run.
- No direct trace of a 50-83 ms globe frame; the phase attribution for those frames is bounded
  by the G-03a zero-long-task result and the 32 ms trace, not measured on a large event.
- No GPU timer queries; "GPU sync" is inferred from CDP trace events, not hardware timers.
- No conclusion about display-server or OS scheduling beyond the recorded load and frame
  cadence.
- No cross-OS determinism claim.
