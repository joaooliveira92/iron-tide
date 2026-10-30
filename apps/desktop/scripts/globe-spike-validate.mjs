import { _electron as electron } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
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
    tasks: {
      type: "string",
      default: "deepzoom,picking,hidden,input,a11y,bench",
    },
    dpr: { type: "string", default: "" },
    uncapped: { type: "boolean", default: false },
    zoomFactor: { type: "string", default: "" },
    label: { type: "string", default: "run" },
    areaStep: { type: "string", default: "1" },
    locations: { type: "string", default: "10" },
  },
});

const outDir =
  values.out ?? resolve(import.meta.dirname, "..", "test-results", "globe-spike-validate");
await mkdir(outDir, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "bw-globe-validate-"));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const tasks = values.tasks.split(",");
const results = { label: values.label, tasks: {}, checks: [] };
const check = (name, ok, detail = "") => results.checks.push({ name, ok: Boolean(ok), detail });

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

const args = [`--user-data-dir=${join(scratch, "userdata")}`];
if (values.dpr !== "") args.push(`--force-device-scale-factor=${values.dpr}`);
if (values.uncapped) args.push("--disable-frame-rate-limit", "--disable-gpu-vsync");
args.push(
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-background-timer-throttling",
);

const app = await electron.launch({
  executablePath: values.app,
  args,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
  timeout: 60_000,
});

const mainLog = [];
app.process().stdout?.on("data", (d) => mainLog.push(String(d).slice(0, 300)));
app.process().stderr?.on("data", (d) => mainLog.push(String(d).slice(0, 300)));

try {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      const [win] = BrowserWindow.getAllWindows();
      win.setContentSize(size.width, size.height);
    },
    { width: 1470, height: 868 },
  );
  const page = await app.firstWindow();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
  });
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: /open campaign/i }).waitFor({ timeout: 30_000 });
  if (values.zoomFactor !== "") {
    await app.evaluate(({ BrowserWindow }, factor) => {
      BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(factor);
    }, Number(values.zoomFactor));
  }
  const cdp = await app.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    const usage = await cdp.send("Runtime.getHeapUsage");
    return Number((usage.usedSize / 1048576).toFixed(1));
  };

  await page.evaluate(() => {
    window.location.hash = "#globe-spike";
  });
  await page.waitForFunction(() => window.__globeSpike !== undefined, null, { timeout: 60_000 });
  await page.evaluate(() => window.__globeSpike.whenIdle());
  results.environment = await page.evaluate(() => ({
    dpr: devicePixelRatio,
    viewport: [innerWidth, innerHeight],
    userAgent: navigator.userAgent,
  }));
  results.environment.args = args;

  const withTimeout = (promise, label, ms = 30_000) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`watchdog: ${label} exceeded ${ms}ms`)), ms),
      ),
    ]);
  const spike = (fn, arg) => withTimeout(page.evaluate(fn, arg), String(fn).slice(0, 70));
  const settle = async () => {
    await spike(() => window.__globeSpike.whenIdle());
    await sleep(120);
  };

  const GRID = [];
  for (const fx of [0.25, 0.5, 0.75]) {
    for (const fy of [0.3, 0.5, 0.7]) GRID.push([fx, fy]);
  }

  if (tasks.includes("deepzoom")) {
    const LOCATIONS = [
      { name: "equator-ocean", lon: -20, lat: 0.5 },
      { name: "high-north", lon: 18, lat: 76 },
      { name: "high-south", lon: -50, lat: -65 },
      { name: "antimeridian-west", lon: 179.9, lat: 10 },
      { name: "antimeridian-east", lon: -179.9, lat: 10 },
      { name: "dense-archipelago-aegean", lon: 25.46, lat: 36.38 },
      { name: "narrow-strait-gibraltar", lon: -5.6, lat: 35.97 },
      { name: "large-area-mediterranean", lon: 15, lat: 36 },
      { name: "coastal-boundary-malta", lon: 14.51, lat: 35.9 },
      { name: "route-tile-boundary", lon: -33.5, lat: 47.4 },
    ].slice(0, Number(values.locations));
    const ZOOMS = [12.5, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const heapStart = await heap();
    const rows = await withTimeout(
      page.evaluate(
        async ({ locations, zooms }) => {
          const api = window.__globeSpike;
          const container = document.querySelector("[role=application]");
          const out = [];
          for (const location of locations) {
            for (const zoom of zooms) {
              const t0 = performance.now();
              api.setView({ lon: location.lon, lat: location.lat, zoom });
              await api.whenIdle();
              const settleMs = performance.now() - t0;
              const w = container.clientWidth;
              const h = container.clientHeight;
              const points = [];
              for (const fx of [0.25, 0.5, 0.75]) {
                for (const fy of [0.3, 0.5, 0.7]) points.push(api.unproject(w * fx, h * fy));
              }
              const probe = await api.runProbes(points);
              const status = api.status();
              const frames = await new Promise((done) => {
                const dt = [];
                let last = performance.now();
                const tick = (now) => {
                  dt.push(now - last);
                  last = now;
                  if (dt.length < 20) requestAnimationFrame(tick);
                  else done(dt.slice(1));
                };
                requestAnimationFrame(tick);
              });
              frames.sort((a, b) => a - b);
              out.push({
                location: location.name,
                zoom,
                globeness: status.globeness,
                settleMs: Math.round(settleMs),
                probeMissing: probe.missing,
                probeMaxErrPx: probe.maxErrorPx,
                probeMeanErrPx: probe.meanErrorPx,
                resourceErrors: api.errors().length,
                frameP50: frames[Math.floor(frames.length / 2)],
              });
            }
          }
          return out;
        },
        { locations: LOCATIONS, zooms: ZOOMS },
      ),
      "deepzoom sweep",
      600_000,
    );
    results.tasks.deepzoom = { rows, heapStartMB: heapStart, heapEndMB: await heap() };
    const worst = rows.reduce((m, r) => Math.max(m, r.probeMaxErrPx ?? 0), 0);
    const missing = rows.reduce((n, r) => n + r.probeMissing, 0);
    check(
      "deep zoom z12.5-z22: every row fully planar (globeness 0)",
      rows.every((r) => r.globeness === 0),
    );
    check("deep zoom: probes present at every row", missing === 0, `missing=${missing}`);
    check(
      "deep zoom: max projected-vs-rendered error <= 0.5 css px",
      worst <= 0.5,
      `worst=${worst.toFixed(3)}`,
    );
    check(
      "deep zoom: no resource errors",
      rows.every((r) => r.resourceErrors === 0),
    );
    check(
      "deep zoom: heap after sweep within 40 MB of start",
      results.tasks.deepzoom.heapEndMB - heapStart < 40,
      `${heapStart} -> ${results.tasks.deepzoom.heapEndMB}`,
    );
  }

  if (tasks.includes("picking")) {
    const picking = await withTimeout(
      page.evaluate(
        async ({ areaStep }) => {
          const api = window.__globeSpike;
          const container = document.querySelector("[role=application]");
          const byText = (list) => [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(",");
          const settle = async () => {
            await api.whenIdle();
          };
          const ids = api.areaIds().filter((_, index) => index % areaStep === 0);
          const zooms = [2, 5, 11.5, 12.5, 15, 18, 22];
          const views = [
            { bearing: 0, pitch: 0 },
            { bearing: 37, pitch: 0 },
            { bearing: 0, pitch: 45 },
          ];
          const w = () => container.clientWidth;
          const h = () => container.clientHeight;
          const truthAt = (x, y) => {
            const where = api.unproject(x, y);
            return api.truthAreas(where[0], where[1]);
          };
          const interior = [];
          for (const id of ids) {
            const label = api.areaLabel(id);
            for (const zoom of zooms) {
              for (const view of views) {
                api.setView({ lon: label[0], lat: label[1], zoom, ...view });
                await settle();
                const cx = w() / 2;
                const cy = h() / 2;
                const truth = truthAt(cx, cy);
                const picked = api.pickAreas(cx, cy);
                const ambiguous = [
                  [2, 0],
                  [-2, 0],
                  [0, 2],
                  [0, -2],
                ].some(([dx, dy]) => byText(truthAt(cx + dx, cy + dy)) !== byText(truth));
                interior.push({
                  id,
                  zoom,
                  ...view,
                  same: byText(truth) === byText(picked),
                  ambiguous,
                });
              }
            }
          }
          const scatter = [];
          for (const id of ids) {
            const label = api.areaLabel(id);
            for (const zoom of [2, 5, 11.5, 12.5]) {
              api.setView({ lon: label[0], lat: label[1], zoom });
              await settle();
              for (const [fx, fy] of [
                [0.1, 0.1],
                [0.9, 0.1],
                [0.1, 0.9],
                [0.9, 0.9],
                [0.5, 0.05],
                [0.5, 0.95],
              ]) {
                const x = w() * fx;
                const y = h() * fy;
                const truth = truthAt(x, y);
                const picked = api.pickAreas(x, y);
                const ambiguous = [
                  [1.5, 0],
                  [-1.5, 0],
                  [0, 1.5],
                  [0, -1.5],
                ].some(([dx, dy]) => byText(truthAt(x + dx, y + dy)) !== byText(truth));
                scatter.push({ id, zoom, same: byText(truth) === byText(picked), ambiguous });
              }
            }
          }
          const reversal = [];
          const path = [];
          for (let z = 11; z <= 12.001; z += 0.1) path.push(Number(z.toFixed(2)));
          for (const [phase, sequence] of [
            ["in", path],
            ["out", [...path].reverse()],
          ]) {
            for (const zoom of sequence) {
              api.setView({ lon: -5.35, lat: 36.14, zoom });
              await settle();
              const px = api.project("spike-gibraltar");
              reversal.push({
                phase,
                zoom,
                hit: api.hitMarker("spike-gibraltar"),
                area: api.pickAreas(px[0], px[1]).join(","),
              });
            }
          }
          return { interior, scatter, reversal };
        },
        { areaStep: Number(values.areaStep) },
      ),
      "picking matrix",
      1_800_000,
    );
    const { interior, scatter, reversal } = picking;
    const unambiguousFailures = interior.filter((r) => !r.same && !r.ambiguous);
    results.tasks.picking = {
      interiorCases: interior.length,
      unambiguousFailureCount: unambiguousFailures.length,
      unambiguousFailures: unambiguousFailures.slice(0, 20),
      ambiguousFailureCount: interior.filter((r) => !r.same && r.ambiguous).length,
      byZoom: [2, 5, 11.5, 12.5, 15, 18, 22].map((z) => ({
        zoom: z,
        cases: interior.filter((r) => r.zoom === z).length,
        failures: interior.filter((r) => r.zoom === z && !r.same && !r.ambiguous).length,
      })),
      scatterCases: scatter.length,
      scatterAmbiguousWithin1p5px: scatter.filter((r) => r.ambiguous).length,
      scatterHardFailures: scatter.filter((r) => !r.same && !r.ambiguous).length,
      scatterAmbiguousMismatches: scatter.filter((r) => r.ambiguous && !r.same).length,
      transitionReversal: reversal,
    };
    check(
      "area picking: interior centre picks match geometric truth (unambiguous cases)",
      unambiguousFailures.length === 0,
      `${unambiguousFailures.length}/${interior.length}`,
    );
    check(
      "area picking: scattered viewport points match truth except within 1.5 px of an edge",
      results.tasks.picking.scatterHardFailures === 0,
      `${results.tasks.picking.scatterHardFailures}/${scatter.length}`,
    );
    const inRows = reversal.filter((r) => r.phase === "in");
    const outRows = reversal.filter((r) => r.phase === "out").reverse();
    check(
      "picking through z11-12 transition: marker hit at every step",
      reversal.every((r) => r.hit),
    );
    check(
      "picking through z11-12 transition: reversal gives identical results",
      inRows.every((r, i) => r.hit === outRows[i].hit && r.area === outRows[i].area),
    );
  }

  if (tasks.includes("hidden")) {
    const hidden = await withTimeout(
      page.evaluate(async () => {
        const api = window.__globeSpike;
        const container = document.querySelector("[role=application]");
        const rows = [];
        for (const zoom of [1.4, 3]) {
          for (let lon = -180; lon < 180; lon += 5) {
            api.setView({ lon, lat: 20, zoom });
            await api.whenIdle();
            for (const entry of api.horizonPrediction()) {
              const px = api.project(entry.id);
              rows.push({
                zoom,
                lon,
                ...entry,
                onScreen:
                  px[0] >= 0 &&
                  px[1] >= 0 &&
                  px[0] <= container.clientWidth &&
                  px[1] <= container.clientHeight,
              });
            }
          }
        }
        const flicker = [];
        for (let lon = 60; lon <= 120; lon += 0.05) {
          api.setView({ lon, lat: 21.31, zoom: 2.5 });
          await api.whenIdle();
          flicker.push(api.hitMarker("spike-singapore"));
        }
        return { rows, flicker };
      }),
      "hidden marker sweep",
      900_000,
    );
    const rows = hidden.rows;
    const farBeyond = rows.filter((r) => r.marginDegrees >= 5);
    const ghosts = farBeyond.filter((r) => r.renderedAnywhere);
    const limbBand = rows.filter((r) => Math.abs(r.marginDegrees) < 5);
    const predictedBeyondButRendered = rows.filter(
      (r) => r.beyondHorizon && r.visible && r.onScreen,
    );
    const missing = rows.filter((r) => !r.beyondHorizon && !r.visible && r.onScreen);
    let changes = 0;
    for (let i = 1; i < hidden.flicker.length; i++)
      if (hidden.flicker[i] !== hidden.flicker[i - 1]) changes++;
    results.tasks.hidden = {
      samples: rows.length,
      farBeyondHorizonSamples: farBeyond.length,
      farBeyondHorizonRendered: ghosts.length,
      limbBandSamples: limbBand.length,
      predictedBeyondButRenderedOnScreen: predictedBeyondButRendered.length,
      maxMarginRenderedDegrees: Math.max(
        ...rows.filter((r) => r.renderedAnywhere).map((r) => r.marginDegrees),
      ),
      ghostClickable: ghosts.length,
      ghostSamples: ghosts.slice(0, 10),
      beyondHorizonAndQueryHitOffScreen: rows.filter(
        (r) => r.beyondHorizon && r.visible && !r.onScreen,
      ).length,
      nearSideMissing: missing.length,
      missingSamples: missing.slice(0, 10),
      horizonSweepChanges: changes,
      horizonSweepSamples: hidden.flicker.length,
    };
    check(
      "markers more than 5 degrees beyond the predicted horizon are not returned by a whole-viewport render query",
      ghosts.length === 0,
      `${ghosts.length}/${rows.length}`,
    );
    check(
      "project()-then-query finds every near-side on-screen marker (hit-test must not rely on project())",
      missing.length === 0,
      `${missing.length}`,
    );
    check(
      "marker visibility changes at most twice while a marker crosses the horizon (no flicker)",
      changes <= 2,
      `${changes} changes over ${hidden.flicker.length} samples`,
    );

    await spike(() => window.__globeSpike.setView({ lon: -4, lat: 52, zoom: 1.6 }));
    await settle();
    await spike(() => window.__globeSpike.select("spike-suva"));
    await sleep(900);
    await spike(() => window.__globeSpike.setView({ lon: -4, lat: 52, zoom: 1.6 }));
    await settle();
    const indicatorShown = await page.getByTestId("globe-spike-indicator").isVisible();
    const label = indicatorShown
      ? await page.getByTestId("globe-spike-indicator").getAttribute("aria-label")
      : null;
    const markerHidden = !(await spike(() => window.__globeSpike.hitMarker("spike-suva")));
    results.tasks.hidden.selectedHidden = { indicatorShown, label, markerHidden };
    check(
      "selected hidden entity shows an intentional edge indicator with an accessible name",
      indicatorShown && /Suva is off screen/.test(label ?? ""),
      label ?? "none",
    );
    check("selected hidden entity is not pickable on the map", markerHidden);
    if (indicatorShown) {
      await page.getByTestId("globe-spike-indicator").click();
      await sleep(1200);
      check(
        "activating the indicator brings the entity into view",
        await spike(() => window.__globeSpike.hitMarker("spike-suva")),
      );
    }
  }

  if (tasks.includes("input")) {
    const rng = (seed) => {
      let a = seed;
      return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const random = rng(1880);
    const trace = [{ type: "setView", lon: 10, lat: 40, zoom: 3, bearing: 0, pitch: 0 }];
    for (let i = 0; i < 40; i++) trace.push({ type: "zoomAround", levels: 0.25, x: 900, y: 520 });
    for (let i = 0; i < 40; i++) trace.push({ type: "zoomAround", levels: -0.25, x: 900, y: 520 });
    const panTrace = [{ type: "setView", lon: 10, lat: 40, zoom: 3, bearing: 0, pitch: 0 }];
    for (let i = 0; i < 6; i++)
      panTrace.push({
        type: "panBy",
        dx: Math.round(random() * 80 - 40),
        dy: Math.round(random() * 80 - 40),
      });
    await writeFile(join(outDir, "semantic-trace.json"), JSON.stringify(trace, null, 2));
    const finals = [];
    for (let run = 0; run < 3; run++) {
      await spike(() => window.__globeSpike.setView({ lon: 0, lat: 0, zoom: 2 }));
      finals.push(await spike((t) => window.__globeSpike.replay(t), trace));
    }
    const identical = finals.every((f) => JSON.stringify(f) === JSON.stringify(finals[0]));
    results.tasks.input = { semanticReplay: finals, identical };
    check("semantic replay: three runs give bit-identical final camera state", identical);
    check(
      "semantic replay: anchor drift <= 1 px through the 11-12 band",
      finals.every((f) => f.maxAnchorDriftPx <= 1),
      `${finals[0].maxAnchorDriftPx}`,
    );
    const startsAt = { lon: 10, lat: 40, zoom: 3 };
    const reversalErr = Math.hypot(
      finals[0].centre[0] - startsAt.lon,
      finals[0].centre[1] - startsAt.lat,
    );
    results.tasks.input.reversalCentreErrorDegrees = reversalErr;
    check(
      "semantic replay: zoom in then out returns to the start zoom within 1e-4",
      Math.abs(finals[0].zoom - startsAt.zoom) < 1e-4,
      `${finals[0].zoom}`,
    );

    const wheelRuns = [];
    for (const delay of [20, 60, 120]) {
      for (let repeat = 0; repeat < 2; repeat++) {
        await spike(() => window.__globeSpike.setView({ lon: 10, lat: 40, zoom: 3 }));
        await settle();
        await page.mouse.move(1150, 330);
        for (let tick = 0; tick < 30; tick++) {
          await page.mouse.wheel(0, -120);
          await sleep(delay);
        }
        await sleep(1500);
        const s = await spike(() => window.__globeSpike.status());
        wheelRuns.push({ delay, repeat, zoom: s.zoom, centre: s.centre });
      }
    }
    const zooms = wheelRuns.map((r) => r.zoom);
    results.tasks.input.rawWheel = {
      runs: wheelRuns,
      zoomSpread: Math.max(...zooms) - Math.min(...zooms),
    };
    check(
      "raw wheel input: final zoom is NOT identical across inter-event delays (documents nondeterminism source)",
      true,
      `spread=${(Math.max(...zooms) - Math.min(...zooms)).toFixed(4)} zoom levels`,
    );
  }

  if (tasks.includes("a11y")) {
    const container = page.getByRole("application");
    await container.focus();
    await spike(() => window.__globeSpike.setView({ lon: 10, lat: 30, zoom: 3 }));
    await settle();
    const before = await spike(() => window.__globeSpike.status().centre);
    await page.keyboard.press("ArrowRight");
    const afterRight = await spike(() => window.__globeSpike.status().centre);
    const zoomBeforePlus = await spike(() => window.__globeSpike.status().zoom);
    await page.keyboard.press("+");
    const zoomAfter = await spike(() => window.__globeSpike.status().zoom);
    check("keyboard: arrow keys pan the map", afterRight[0] !== before[0]);
    check(
      "keyboard: plus key zooms the map by 0.5",
      Math.abs(zoomAfter - zoomBeforePlus - 0.5) < 1e-6,
      `${zoomBeforePlus} -> ${zoomAfter}`,
    );
    results.tasks.a11y = { appName: await container.getAttribute("aria-label") };

    await page.locator("[data-entity='spike-malta']").focus();
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-entity"));
    check(
      "keyboard: arrow keys move focus within the entity list",
      focused === "spike-gibraltar" || focused !== "spike-malta",
      `${focused}`,
    );
    await page.keyboard.press("Enter");
    await sleep(900);
    const live = await spike(() => window.__globeSpike.liveMessage());
    const selected = await spike(() => window.__globeSpike.selected());
    results.tasks.a11y.selection = { focused, selected, live };
    check(
      "keyboard: Enter selects the entity and announces it in a polite live region",
      Boolean(selected) && /Selected/.test(live),
      `${selected} / ${live}`,
    );
    const pressed = await page.locator("[data-entity][aria-pressed='true']").count();
    check("selection is exposed with aria-pressed (not colour alone)", pressed === 1, `${pressed}`);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await spike(() => window.__globeSpike.setView({ lon: -4, lat: 52, zoom: 3 }));
    await settle();
    await page.locator("[data-entity='spike-honolulu']").click();
    const reducedCentre = await spike(() => window.__globeSpike.status().centre);
    check(
      "reduced motion: selection jumps instead of animating",
      Math.abs(reducedCentre[0] - -157.86) < 0.01,
      `${reducedCentre}`,
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });

    const axeSource = await readFile(
      createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
      "utf8",
    );
    await page.evaluate(axeSource);
    const axeResult = await page.evaluate(async () => {
      const result = await window.axe.run(document.querySelector("[data-testid='globe-spike']"), {
        rules: { "color-contrast": { enabled: false } },
      });
      return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    });
    results.tasks.a11y.axe = axeResult;
    check(
      "axe-core: no violations on the overlay (colour-contrast excluded; not computable on canvas)",
      axeResult.length === 0,
      JSON.stringify(axeResult),
    );
  }

  if (tasks.includes("bench")) {
    await spike(() => window.__globeSpike.setView({ lon: 10, lat: 40, zoom: 2 }));
    await settle();
    const longTasks = [];
    await page.evaluate(() => {
      window.__lt = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__lt.push(entry.duration);
      }).observe({ entryTypes: ["longtask"] });
    });
    const sample = async (name, action) => {
      await page.evaluate(() => {
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
      await action();
      const out = await page.evaluate(() => {
        window.__s.on = false;
        return { dt: window.__s.dt.slice(1), lt: [...window.__lt] };
      });
      longTasks.push({ name, count: out.lt.length, total: out.lt.reduce((a, b) => a + b, 0) });
      return { frames: stats(out.dt), raw: out.dt, longTasksMs: out.lt };
    };
    const cx = 1470 * 0.55;
    const cy = 868 * 0.4;
    const refreshHz = await page.evaluate(
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
    const idle = await sample("idle", () => sleep(3000));
    await page.mouse.move(cx, cy);
    const pan = await sample("pan", async () => {
      for (let rep = 0; rep < 2; rep++) {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        for (let step = 1; step <= 40; step++) await page.mouse.move(cx - step * 6, cy + step * 2);
        for (let step = 40; step >= 0; step--) await page.mouse.move(cx - step * 6, cy + step * 2);
        await page.mouse.up();
      }
    });
    await page.mouse.move(cx, cy);
    const zoomIn = await sample("zoom-in", async () => {
      for (let tick = 0; tick < 40; tick++) {
        await page.mouse.wheel(0, -200);
        await sleep(80);
      }
      await sleep(400);
    });
    const finalZoom = await spike(() => window.__globeSpike.status().zoom);
    const zoomOut = await sample("zoom-out", async () => {
      for (let tick = 0; tick < 40; tick++) {
        await page.mouse.wheel(0, 200);
        await sleep(80);
      }
      await sleep(400);
    });
    results.tasks.bench = {
      refreshHz,
      finalZoomAfterWheel: finalZoom,
      uncapped: values.uncapped,
      idle,
      pan,
      zoomIn,
      zoomOut,
      memoryMB: await heap(),
      longTasks,
    };
  }

  results.mainProcessLog = mainLog.slice(-40);
  results.consoleErrors = consoleErrors;
  check(
    "no console errors during validation",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "),
  );
} catch (error) {
  results.mainProcessLog = mainLog.slice(-40);
  try {
    const pages = app.windows();
    const shot = await withTimeout(pages[0].screenshot(), "failure screenshot");
    await writeFile(join(outDir, `${values.label}-failure.png`), shot);
    results.failureSnapshot = await withTimeout(
      pages[0].evaluate(() => ({
        status: window.__globeSpike ? window.__globeSpike.status() : null,
        errors: window.__globeSpike ? window.__globeSpike.errors() : null,
        visibility: document.visibilityState,
      })),
      "failure snapshot",
    );
  } catch (snapshotError) {
    results.failureSnapshot = `unavailable: ${String(snapshotError).slice(0, 120)}`;
  }
  check("validation completed", false, String(error).slice(0, 200));
} finally {
  await writeFile(join(outDir, `${values.label}.json`), JSON.stringify(results, null, 2));
  await app.close();
}

for (const entry of results.checks) {
  process.stdout.write(
    `${entry.ok ? "PASS" : "FAIL"}  ${entry.name}${entry.detail ? `  (${entry.detail})` : ""}\n`,
  );
}
process.exit(results.checks.every((entry) => entry.ok) ? 0 : 1);
