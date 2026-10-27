import { _electron as electron } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    app: {
      type: "string",
      default: "dist-electron/mac-arm64/Bluewave.app/Contents/MacOS/Bluewave",
    },
    out: { type: "string" },
    tasks: { type: "string", default: "modes,protected,horizon,bench" },
    runs: { type: "string", default: "3" },
    label: { type: "string", default: "land" },
    dpr: { type: "string", default: "" },
    appWrapper: { type: "string", default: "" },
    horizonStep: { type: "string", default: "5" },
  },
});

const root = resolve(import.meta.dirname, "..");
const outDir = values.out ?? resolve(root, "test-results", "globe-spike-land");
await mkdir(outDir, { recursive: true });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const tasks = values.tasks.split(",");
const results = { label: values.label, tasks: {}, checks: [] };
const check = (name, ok, detail = "") => results.checks.push({ name, ok: Boolean(ok), detail });
const HASH = {
  baked: "#globe-spike",
  runtime: "#globe-spike-runtime",
  missing: "#globe-spike-missing",
  corrupt: "#globe-spike-corrupt",
};
const LOCAL = /^(file|devtools|data|blob|chrome-extension):/;

function stats(list) {
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return {
    n: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

async function launch(label) {
  const scratch = await mkdtemp(join(tmpdir(), "bw-globe-land-"));
  const args = [
    `--user-data-dir=${join(scratch, "userdata")}`,
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-background-timer-throttling",
  ];
  if (values.dpr !== "") args.push(`--force-device-scale-factor=${values.dpr}`);
  const app = await electron.launch({
    executablePath: values.app,
    args,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
    timeout: 60_000,
  });
  await app.evaluate(
    ({ BrowserWindow }, size) =>
      BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height),
    { width: 1470, height: 868 },
  );
  const page = await app.firstWindow();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
  });
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: /open campaign/i }).waitFor({ timeout: 30_000 });
  const cdp = await app.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return Number(((await cdp.send("Runtime.getHeapUsage")).usedSize / 1048576).toFixed(1));
  };
  return { app, page, cdp, heap, requests, consoleErrors, label };
}

async function openMode(page, mode) {
  await page.evaluate(() => {
    window.location.hash = "";
  });
  await page.waitForFunction(() => window.__globeSpike === undefined, null, { timeout: 30_000 });
  await sleep(200);
  return page.evaluate(async (hash) => {
    const t0 = performance.now();
    window.location.hash = hash;
    while (window.__globeSpike === undefined) await new Promise((r) => requestAnimationFrame(r));
    const apiMs = performance.now() - t0;
    while (window.__globeSpike.canvasPaintedPixels() <= 0)
      await new Promise((r) => requestAnimationFrame(r));
    const firstPaintMs = performance.now() - t0;
    await window.__globeSpike.whenIdle();
    return { apiMs, firstPaintMs, idleMs: performance.now() - t0 };
  }, HASH[mode]);
}

const resolution = JSON.parse(
  await readFile(
    resolve(root, "src/renderer/public/map-spike/land-tiles/protected-resolution.json"),
    "utf8",
  ),
);
const catalogue = JSON.parse(
  await readFile(resolve(root, "map-data/protected-features.v1.json"), "utf8"),
);
const nonLocal = (requests) => requests.filter((url) => !LOCAL.test(url));

try {
  const session = await launch("session");
  const { page } = session;
  try {
    if (tasks.includes("modes")) {
      const rows = {};
      for (const mode of ["baked", "runtime", "missing", "corrupt"]) {
        const timing = await openMode(page, mode);
        const info = await page.evaluate(() => ({
          land: window.__globeSpike.status().land,
          diagnostics: window.__globeSpike.bakedDiagnostics(),
          errors: window.__globeSpike.errors(),
          painted: window.__globeSpike.canvasPaintedPixels(),
          container: [
            document.querySelector("[role=application]").clientWidth,
            document.querySelector("[role=application]").clientHeight,
          ],
          violations: window.__globeSpikeViolations ?? [],
        }));
        const noticeNode = page.getByTestId("globe-spike-notice");
        const notice = (await noticeNode.count()) > 0 ? await noticeNode.textContent() : null;
        rows[mode] = { timing, ...info, notice };
      }
      rows.nonLocalRequests = nonLocal(session.requests);
      results.tasks.modes = rows;
      check(
        "baked mode serves tiles from the pack with a verified hash and no notice",
        rows.baked.land.source === "baked" &&
          rows.baked.diagnostics.packVerified === true &&
          rows.baked.diagnostics.served > 0 &&
          rows.baked.diagnostics.failures.length === 0 &&
          rows.baked.notice === null,
        JSON.stringify({
          served: rows.baked.diagnostics?.served,
          empty: rows.baked.diagnostics?.empty,
          loadMs: rows.baked.diagnostics?.loadMs,
        }),
      );
      check(
        "runtime mode uses runtime GeoJSON tiling with no notice",
        rows.runtime.land.source === "runtime" &&
          rows.runtime.land.fallbackReason === null &&
          rows.runtime.notice === null,
      );
      check(
        "a missing pack falls back visibly with an actionable reason",
        rows.missing.land.source === "runtime" &&
          /cannot read .*land-tiles-missing\/manifest\.json/.test(
            rows.missing.land.fallbackReason ?? "",
          ) &&
          /Offline tile pack unavailable/.test(rows.missing.notice ?? ""),
        rows.missing.land.fallbackReason ?? "none",
      );
      check(
        "a corrupt pack is rejected by hash and falls back visibly",
        rows.corrupt.land.source === "runtime" &&
          /hash does not match/.test(rows.corrupt.land.fallbackReason ?? "") &&
          /Offline tile pack unavailable/.test(rows.corrupt.notice ?? ""),
        rows.corrupt.land.fallbackReason ?? "none",
      );
      for (const mode of ["baked", "runtime", "missing", "corrupt"]) {
        check(
          `${mode} mode has a non-zero map container`,
          rows[mode].container[0] > 0 && rows[mode].container[1] > 0,
          rows[mode].container.join("x"),
        );
        check(
          `${mode} mode renders a non-blank canvas`,
          rows[mode].painted > 100,
          String(rows[mode].painted),
        );
        check(
          `${mode} mode raises no content-security-policy violation`,
          rows[mode].violations.length === 0,
          rows[mode].violations.slice(0, 2).join(" | "),
        );
      }
      check(
        "no non-local request during any mode",
        rows.nonLocalRequests.length === 0,
        rows.nonLocalRequests.slice(0, 3).join(" | "),
      );
    }

    if (tasks.includes("protected")) {
      const runMode = async (mode) => {
        await openMode(page, mode);
        return page.evaluate(
          async ({ overlays, passages, zooms }) => {
            const api = window.__globeSpike;
            const container = document.querySelector("[role=application]");
            const width = container.clientWidth;
            const height = container.clientHeight;
            const rows = [];
            const isWater = (rgb) => rgb[2] - rgb[0] >= 45;
            const tileMax = api.status().land.tileMaxZoom ?? 99;
            const along = (line, count) => {
              const out = [];
              for (let i = 0; i + 1 < line.length; i++) {
                for (let k = 0; k < count; k++) {
                  const t = k / count;
                  out.push([
                    line[i][0] + (line[i + 1][0] - line[i][0]) * t,
                    line[i][1] + (line[i + 1][1] - line[i][1]) * t,
                  ]);
                }
              }
              out.push(line[line.length - 1]);
              return out;
            };
            for (const overlay of overlays) {
              for (const zoom of zooms) {
                if (zoom < overlay.requiredFromZoom) continue;
                const mid = overlay.lines[0][Math.floor(overlay.lines[0].length / 2)];
                api.setView({ lon: mid[0], lat: mid[1], zoom });
                await api.whenIdle();
                const points = [];
                for (const line of overlay.lines) for (const p of along(line, 300)) points.push(p);
                const px = points.map((p) => api.projectLonLat(p[0], p[1]));
                const onScreen = px.filter(
                  (p) => p[0] >= 2 && p[1] >= 2 && p[0] <= width - 2 && p[1] <= height - 2,
                );
                if (onScreen.length < 10) {
                  rows.push({
                    featureId: overlay.featureId,
                    zoom,
                    kind: "overlay",
                    skipped: "centreline off screen",
                  });
                  continue;
                }
                const latRad = (mid[1] * Math.PI) / 180;
                const mppNow = (2 * Math.PI * 6371008.8 * Math.cos(latRad)) / (512 * 2 ** zoom);
                const unitMetres =
                  (2 * Math.PI * 6371008.8 * Math.cos(latRad)) / (512 * 2 ** tileMax);
                const tolerancePx = zoom > tileMax ? Math.ceil((0.5 * unitMetres) / mppNow) + 1 : 0;
                const offsets = [[0, 0]];
                if (tolerancePx > 0) {
                  for (let i = 1; i <= tolerancePx * 2; i++)
                    offsets.push([i, 0], [-i, 0], [0, i], [0, -i]);
                }
                const probe = [];
                for (const p of onScreen)
                  for (const [dx, dy] of offsets)
                    probe.push([
                      Math.min(width - 1, Math.max(0, p[0] + dx)),
                      Math.min(height - 1, Math.max(0, p[1] + dy)),
                    ]);
                const colours = api.samplePixels(probe);
                let water = 0;
                for (let i = 0; i < onScreen.length; i++) {
                  let found = false;
                  for (let k = 0; k < offsets.length; k++)
                    if (isWater(colours[i * offsets.length + k])) found = true;
                  if (found) water++;
                }
                rows.push({
                  featureId: overlay.featureId,
                  zoom,
                  kind: "overlay",
                  samples: onScreen.length,
                  waterFraction: water / onScreen.length,
                  tolerancePx,
                  globeness: api.status().globeness,
                });
              }
            }
            for (const passage of passages) {
              for (const zoom of zooms) {
                if (zoom < passage.requiredFromZoom) continue;
                const midLon = (passage.from[0] + passage.to[0]) / 2;
                const midLat = (passage.from[1] + passage.to[1]) / 2;
                api.setView({ lon: midLon, lat: midLat, zoom });
                await api.whenIdle();
                const a = api.projectLonLat(passage.from[0], passage.from[1]);
                const b = api.projectLonLat(passage.to[0], passage.to[1]);
                const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
                const count = Math.max(8, Math.ceil(length * 2));
                const line = [];
                for (let k = 0; k <= count; k++)
                  line.push([
                    a[0] + ((b[0] - a[0]) * k) / count,
                    a[1] + ((b[1] - a[1]) * k) / count,
                  ]);
                const inside = line.filter(
                  (p) => p[0] >= 1 && p[1] >= 1 && p[0] <= width - 1 && p[1] <= height - 1,
                );
                if (inside.length < line.length) {
                  rows.push({
                    featureId: passage.featureId,
                    zoom,
                    kind: "transect",
                    skipped: "transect extends beyond the viewport",
                  });
                  continue;
                }
                const colours = api.samplePixels(line);
                let run = 0;
                let best = 0;
                for (const rgb of colours) {
                  run = isWater(rgb) ? run + 1 : 0;
                  best = Math.max(best, run);
                }
                const step = length / count;
                rows.push({
                  featureId: passage.featureId,
                  zoom,
                  kind: "transect",
                  longestWaterRunPx: best * step,
                  transectPx: length,
                  sourceWidthMetres: passage.sourceWidthMetres,
                  globeness: api.status().globeness,
                });
              }
            }
            return rows;
          },
          {
            overlays: resolution.overlays.map((o) => ({
              featureId: o.featureId,
              requiredFromZoom: o.requiredFromZoom,
              lines: o.lines,
            })),
            passages: resolution.passages.map((p) => ({
              featureId: p.featureId,
              from: p.from,
              to: p.to,
              sourceWidthMetres: p.source.longestWaterMetres,
              requiredFromZoom: catalogue.features.find((f) => f.id === p.featureId)
                .requiredFromZoom,
            })),
            zooms: [5, 7, 9, 11.5, 12.5],
          },
        );
      };
      const baked = await runMode("baked");
      const control = await runMode("runtime");
      results.tasks.protected = { baked, control };
      const overlayRows = baked.filter((r) => r.kind === "overlay" && !r.skipped);
      const failing = overlayRows.filter((r) => r.waterFraction < 0.97);
      check(
        "every protected canal reads as water along its whole visible centreline in globe, transition and planar views",
        overlayRows.length > 15 && failing.length === 0,
        `${overlayRows.length} views, ${failing.length} failing${
          failing.length
            ? ": " +
              failing
                .slice(0, 3)
                .map((r) => `${r.featureId}@z${r.zoom}=${r.waterFraction.toFixed(2)}`)
                .join(", ")
            : ""
        }`,
      );
      const modesSeen = new Set(
        overlayRows.map((r) =>
          r.globeness === null
            ? "unknown"
            : r.globeness > 0.99
              ? "globe"
              : r.globeness < 0.01
                ? "planar"
                : "transition",
        ),
      );
      check(
        "the canal views cover globe, transition and planar projection",
        modesSeen.has("globe") && modesSeen.has("planar") && modesSeen.has("transition"),
        [...modesSeen].join(","),
      );
      const transectRows = baked.filter((r) => r.kind === "transect" && !r.skipped);
      const mpp = (zoom, lat) =>
        (2 * Math.PI * 6371008.8 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
      const strait = transectRows.map((r) => {
        const p = resolution.passages.find((x) => x.featureId === r.featureId);
        const expectedPx = r.sourceWidthMetres / mpp(r.zoom, (p.from[1] + p.to[1]) / 2);
        return {
          ...r,
          expectedPx,
          ok: expectedPx < 1.5 || r.longestWaterRunPx >= 0.8 * expectedPx - 1.5,
        };
      });
      results.tasks.protected.straits = strait;
      const badStraits = strait.filter((r) => !r.ok);
      check(
        "every strait passage stays open in the rendered pixels wherever it is at least 1.5 px wide (at least 80% of the geometric width minus 1.5 px of coast outline and anti-aliasing)",
        strait.length > 20 && badStraits.length === 0,
        `${strait.length} views, ${badStraits.length} failing${
          badStraits.length
            ? ": " +
              badStraits
                .slice(0, 3)
                .map((r) => `${r.featureId}@z${r.zoom}`)
                .join(", ")
            : ""
        }`,
      );
      const controlSuez = control.filter(
        (r) =>
          r.kind === "overlay" &&
          !r.skipped &&
          (r.featureId === "suez-canal" || r.featureId === "panama-canal") &&
          r.zoom <= 9,
      );
      check(
        "control: the legacy runtime coastline renders the same canals as sealed land",
        controlSuez.length > 0 && controlSuez.every((r) => r.waterFraction < 0.5),
        controlSuez
          .map((r) => `${r.featureId}@z${r.zoom}=${r.waterFraction.toFixed(2)}`)
          .join(", "),
      );
    }

    if (tasks.includes("horizon")) {
      await openMode(page, "baked");
      const step = Number(values.horizonStep);
      const rows = await page.evaluate(async (lonStep) => {
        const api = window.__globeSpike;
        const container = document.querySelector("[role=application]");
        const out = [];
        const combos = [
          { pitch: 0, bearing: 0 },
          { pitch: 45, bearing: 0 },
          { pitch: 45, bearing: 135 },
          { pitch: 60, bearing: 270 },
        ];
        for (const combo of combos) {
          for (const zoom of [1.4, 3]) {
            for (const lat of [20, 60]) {
              for (let lon = -180; lon < 180; lon += lonStep) {
                api.setView({ lon, lat, zoom, pitch: combo.pitch, bearing: combo.bearing });
                await api.whenIdle();
                const predictions = api.horizonPrediction();
                for (const entry of predictions) {
                  const px = api.project(entry.id);
                  const onScreen =
                    px !== null &&
                    px[0] >= 8 &&
                    px[1] >= 8 &&
                    px[0] <= container.clientWidth - 8 &&
                    px[1] <= container.clientHeight - 8;
                  const rendered = (await api.markerRenderedPixels(entry.id)) >= 2;
                  out.push({
                    ...combo,
                    zoom,
                    lat,
                    lon,
                    id: entry.id,
                    cls: entry.horizonClass,
                    margin: entry.marginDegrees,
                    onScreen,
                    rendered,
                  });
                }
              }
            }
          }
        }
        return out;
      }, step);
      const front = rows.filter((r) => r.cls === "front");
      const back = rows.filter((r) => r.cls === "back");
      const limb = rows.filter((r) => r.cls === "horizon");
      const backRendered = back.filter((r) => r.rendered);
      const frontInBounds = front.filter((r) => r.onScreen);
      const frontInBoundsMissing = frontInBounds.filter((r) => !r.rendered);
      const byCombo = {};
      for (const r of rows) {
        const key = `p${r.pitch}b${r.bearing}`;
        byCombo[key] ??= {
          samples: 0,
          back: 0,
          backRendered: 0,
          frontInBounds: 0,
          frontInBoundsMissing: 0,
        };
        byCombo[key].samples++;
        if (r.cls === "back") byCombo[key].back++;
        if (r.cls === "back" && r.rendered) byCombo[key].backRendered++;
        if (r.cls === "front" && r.onScreen) byCombo[key].frontInBounds++;
        if (r.cls === "front" && r.onScreen && !r.rendered) byCombo[key].frontInBoundsMissing++;
      }
      results.tasks.horizon = {
        rows,
        samples: rows.length,
        front: front.length,
        back: back.length,
        limb: limb.length,
        limbRendered: limb.filter((r) => r.rendered).length,
        backRendered: backRendered.length,
        frontInBounds: frontInBounds.length,
        frontInBoundsMissing: frontInBoundsMissing.length,
        byCombo,
        backRenderedSamples: backRendered.slice(0, 12),
        frontMissingSamples: frontInBoundsMissing.slice(0, 12),
        minMarginBackRendered: backRendered.length
          ? Math.min(...backRendered.map((r) => r.margin))
          : null,
      };
      check(
        "no marker classified back-side is rendered anywhere on the canvas (isolated-marker readback, independent of project())",
        backRendered.length === 0,
        `${backRendered.length}/${back.length} (min margin ${results.tasks.horizon.minMarginBackRendered})`,
      );
      check(
        "every marker classified front-side whose project() position is in the viewport is rendered",
        frontInBoundsMissing.length === 0,
        `${frontInBoundsMissing.length}/${frontInBounds.length}`,
      );
    }

    results.consoleErrors = session.consoleErrors;
  } finally {
    await session.app.close();
  }

  if (tasks.includes("bench")) {
    const runs = Number(values.runs);
    const rowsOut = [];
    for (let run = 0; run < runs; run++) {
      const order = run % 2 === 0 ? ["runtime", "baked"] : ["baked", "runtime"];
      for (const mode of order) {
        const s = await launch(`bench-${mode}-${run}`);
        try {
          const timing = await openMode(s.page, mode);
          await sleep(1500);
          await s.page.evaluate(() => window.__globeSpike.setView({ lon: 10, lat: 40, zoom: 2 }));
          await s.page.evaluate(() => window.__globeSpike.whenIdle());
          await s.page.evaluate(() => {
            window.__lt = [];
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) window.__lt.push(e.duration);
            }).observe({ entryTypes: ["longtask"] });
          });
          const metrics = async () =>
            Object.fromEntries(
              (await s.cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]),
            );
          await s.cdp.send("Performance.enable");
          const refreshHz = await s.page.evaluate(
            () =>
              new Promise((done) => {
                let count = 0;
                const start = performance.now();
                const tick = () => {
                  count++;
                  if (performance.now() - start >= 1000) done(count);
                  else requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
              }),
          );
          const sample = async (action) => {
            await s.page.evaluate(() => {
              window.__s = { dt: [], on: true };
              window.__lt.length = 0;
              let last = performance.now();
              const tick = (now) => {
                if (!window.__s.on) return;
                window.__s.dt.push(now - last);
                last = now;
                requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            });
            const before = await metrics();
            await action();
            const settleMs = await s.page.evaluate(async () => {
              const t = performance.now();
              await window.__globeSpike.whenIdle();
              return performance.now() - t;
            });
            const after = await metrics();
            const out = await s.page.evaluate(() => {
              window.__s.on = false;
              return { dt: window.__s.dt.slice(1), lt: [...window.__lt] };
            });
            return {
              frames: stats(out.dt),
              framesOver33: out.dt.filter((d) => d > 33.4).length,
              longTasks: out.lt.length,
              longTaskTotalMs: out.lt.reduce((a, b) => a + b, 0),
              settleMsAfterBurst: settleMs,
              mainThreadTaskMs: (after.TaskDuration - before.TaskDuration) * 1000,
              mainThreadScriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
            };
          };
          const cx = 1470 * 0.55;
          const cy = 868 * 0.4;
          await s.page.mouse.move(cx, cy);
          const idle = await sample(() => sleep(3000));
          const pan = await sample(async () => {
            for (let rep = 0; rep < 2; rep++) {
              await s.page.mouse.move(cx, cy);
              await s.page.mouse.down();
              for (let step = 1; step <= 40; step++)
                await s.page.mouse.move(cx - step * 6, cy + step * 2);
              for (let step = 40; step >= 0; step--)
                await s.page.mouse.move(cx - step * 6, cy + step * 2);
              await s.page.mouse.up();
            }
          });
          await s.page.mouse.move(cx, cy);
          const zoomIn = await sample(async () => {
            for (let tick = 0; tick < 40; tick++) {
              await s.page.mouse.wheel(0, -200);
              await sleep(80);
            }
            await sleep(400);
          });
          const finalZoom = await s.page.evaluate(() => window.__globeSpike.status().zoom);
          const zoomOut = await sample(async () => {
            for (let tick = 0; tick < 40; tick++) {
              await s.page.mouse.wheel(0, 200);
              await sleep(80);
            }
            await sleep(400);
          });
          const diagnostics = await s.page.evaluate(() => window.__globeSpike.bakedDiagnostics());
          rowsOut.push({
            mode,
            run,
            order: order.join(">"),
            timing,
            refreshHz,
            finalZoom,
            idle,
            pan,
            zoomIn,
            zoomOut,
            heapMB: await s.heap(),
            diagnostics,
            nonLocal: nonLocal(s.requests).length,
          });
        } finally {
          await s.app.close();
        }
      }
    }
    results.tasks.bench = rowsOut;
    const hitch = (mode) => rowsOut.filter((r) => r.mode === mode).map((r) => r.zoomOut.frames.max);
    check(
      "benchmark ran for both modes",
      hitch("baked").length === runs && hitch("runtime").length === runs,
      `baked zoom-out max ${hitch("baked").join("/")} ms, runtime ${hitch("runtime").join("/")} ms`,
    );
    check(
      "no non-local request during the benchmark",
      rowsOut.every((r) => r.nonLocal === 0),
    );
  }
} catch (error) {
  check("validation completed", false, String(error).slice(0, 300));
} finally {
  await writeFile(join(outDir, `${values.label}.json`), JSON.stringify(results, null, 2));
}

for (const entry of results.checks)
  process.stdout.write(
    `${entry.ok ? "PASS" : "FAIL"}  ${entry.name}${entry.detail ? `  (${entry.detail})` : ""}\n`,
  );
process.exit(results.checks.every((entry) => entry.ok) ? 0 : 1);
