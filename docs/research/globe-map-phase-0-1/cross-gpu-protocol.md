# Cross-GPU and low-end validation protocol

Status: **blocked-external**. Only one machine was available: Apple M4 (8-core GPU), 16 GB, macOS 27.0.1, built-in display at 60 Hz, AC power, low-power mode off. No integrated Intel/AMD, discrete NVIDIA/AMD, Windows, or Linux hardware was available to this session. No result below was fabricated; the table at the end is intentionally empty.

## Machines required (minimum)

1. Windows 10/11 x64 with an Intel integrated GPU (the lowest supported class).
2. Windows 10/11 x64 with a discrete NVIDIA or AMD GPU.
3. Linux x64 with Mesa (Intel or AMD) running the AppImage.
4. One older Apple Silicon or Intel Mac with Metal, if available.

## Preparation (per machine)

1. Check out branch `feat/globe-phase-0-1` and run `pnpm install --frozen-lockfile`.
2. Build and package the spike variant for the OS:
   `pnpm --filter @bluewave/desktop run build:globe-spike`
   then `pnpm --filter @bluewave/desktop exec electron-builder --dir --config electron-builder.yml` (add `--win` / `--linux` as appropriate).
3. Record, in `environment.txt`: OS and build, CPU, RAM, GPU name, driver version, display resolution, scale factor, refresh rate, power mode (plugged in, high performance), and Electron/Chromium versions (`chrome://gpu` text copied from the app's DevTools).

## Runs (each must be run alone; close other applications)

Use `--app` for the packaged executable path.

```
node scripts/globe-spike-smoke.mjs --app <exe> --out results/<machine>/smoke
node scripts/globe-spike-validate.mjs --app <exe> --out results/<machine> --label main --tasks deepzoom,picking,hidden,input,a11y
node scripts/globe-spike-validate.mjs --app <exe> --out results/<machine> --label bench-capped --tasks bench
node scripts/globe-spike-validate.mjs --app <exe> --out results/<machine> --label bench-uncapped --tasks bench --uncapped
node scripts/map-baseline.mjs --app <default-build-exe> --out results/<machine>/baseline --runs 3
```

For the baseline, build the default (non-spike) variant first.

## Acceptance (to lift the cross-GPU gate)

- `smoke` and `main` pass on every machine.
- Deep-zoom `probeMaxErrPx` for z12.5-z22 is <= 0.5 css px on every machine.
- If any machine shows pure-sphere error above 0.3 px at z12 (run `poc/` bench, `precision` task, project `globe-hybrid-investigation.zip`), move the blend interval to 10.5-11.5 and repeat.
- `bench-uncapped`: p95 frame time <= 16.7 ms during pan and zoom on the lowest-tier GPU, or the gate fails and a lower-cost scene (fewer labels, simpler land) must be tried before any migration.
- Record vsync: `refreshHz` in the output; a capped 60 fps is never evidence of headroom.

## Results table (empty until collected)

| Machine | GPU / driver | OS | smoke | validate main | deep-zoom worst px | uncapped zoom p95 ms | uncapped pan p95 ms |
|---|---|---|---|---|---|---|---|
| (M4, this session) | Apple M4 / Metal | macOS 27.0.1 | pass | see benchmark report | see benchmark report | see benchmark report | see benchmark report |
| *pending* | | | | | | | |
