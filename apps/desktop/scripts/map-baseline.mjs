import { _electron as electron } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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
    runs: { type: "string", default: "3" },
    width: { type: "string", default: "1470" },
    height: { type: "string", default: "868" },
    uncapped: { type: "boolean", default: false },
  },
});

const outDir = values.out ?? resolve(import.meta.dirname, "..", "test-results", "map-baseline");
await mkdir(outDir, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "bw-map-baseline-"));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function stats(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
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

async function runOnce(runIndex) {
  const app = await electron.launch({
    executablePath: values.app,
    args: [
      `--user-data-dir=${join(scratch, `userdata-${runIndex}`)}`,
      ...(values.uncapped ? ["--disable-frame-rate-limit", "--disable-gpu-vsync"] : []),
    ],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
    timeout: 60_000,
  });
  const result = { run: runIndex };
  try {
    await app.evaluate(
      ({ dialog }, dir) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: dir });
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
      },
      join(scratch, `save-${runIndex}`),
    );
    await app.evaluate(
      ({ BrowserWindow }, size) => {
        const [win] = BrowserWindow.getAllWindows();
        win.setContentSize(size.width, size.height);
      },
      { width: Number(values.width), height: Number(values.height) },
    );
    const page = await app.firstWindow();
    await page.waitForLoadState("load");
    await page.getByText("Bluewave Naval Staff").waitFor({ timeout: 20_000 });
    const click = (name) => page.getByRole("button", { name }).first().click();
    await click("New Campaign");
    await page.getByRole("option", { name: "United Kingdom" }).click();
    await page.getByRole("listbox", { name: "Playable nations" }).press("Enter");
    await click("Next: Choose Archetype");
    const deck = page.getByRole("listbox", { name: "Archetype presets" });
    const target = await page.getByRole("option", { name: "Shipyard Baron" }).getAttribute("id");
    for (let step = 0; step < 4; step++) {
      if ((await deck.getAttribute("aria-activedescendant")) === target) break;
      await deck.press("ArrowRight");
    }
    await deck.press("Enter");
    await click("Choose Nation");
    await page.getByLabel("Admiral name").fill("John Fisher");
    await page.getByLabel("Campaign name").fill("Map Baseline");
    await click("Next");
    await click("Next: Review Campaign");
    await click("Begin Commission");
    for (const label of [
      "Review Naval Estimates",
      "Continue to Treasury Position",
      "Continue to Foreign Intelligence",
      "Continue to Immediate Concerns",
    ]) {
      await click(label);
    }

    await page.evaluate(() => {
      window.__bl = { longtasks: [], firstPaintMs: null };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__bl.longtasks.push(entry.duration);
      }).observe({ entryTypes: ["longtask"] });
    });
    const tTake = Date.now();
    await click("Take command");
    await page.getByRole("heading", { name: "Campaign Overview" }).waitFor({ timeout: 30_000 });
    const homeApp = page.getByRole("application", { name: /World map/ });
    await homeApp.waitFor({ timeout: 15_000 });
    const homeMap = homeApp.locator("xpath=..");
    const painted = () =>
      homeMap.evaluate((container) => {
        const canvas = container.querySelector("canvas");
        if (!canvas || canvas.width === 0) return false;
        const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
        return false;
      });
    for (;;) {
      if (await painted()) break;
      if (Date.now() - tTake > 30_000) throw new Error("map never painted");
      await sleep(50);
    }
    result.overviewToFirstPaintedMapMs = Date.now() - tTake;
    await sleep(1500);

    const cdp = await app.context().newCDPSession(page);
    const heap = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      const usage = await cdp.send("Runtime.getHeapUsage");
      const dom = await cdp.send("Memory.getDOMCounters");
      return {
        heapMB: Number((usage.usedSize / 1048576).toFixed(1)),
        nodes: dom.nodes,
        listeners: dom.jsEventListeners,
      };
    };
    result.memoryAtRest = await heap();
    result.refresh = await page.evaluate(
      () =>
        new Promise((resolveRate) => {
          let count = 0;
          const start = performance.now();
          const tick = () => {
            count++;
            if (performance.now() - start >= 1000) resolveRate(count);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    result.viewport = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
    result.scene = await homeMap.evaluate((container) => ({
      svgElements: container.querySelectorAll("svg *").length,
      areaButtons: container.querySelectorAll('path[role="button"]').length,
      fleetMarkers: container.querySelectorAll("[data-map-fleet]").length,
      canvasPx: (() => {
        const canvas = container.querySelector("canvas");
        return canvas ? [canvas.width, canvas.height] : null;
      })(),
    }));

    const startSampler = (label) =>
      page.evaluate((name) => {
        window.__samples = { name, dt: [], on: true };
        let previous = performance.now();
        const tick = (now) => {
          if (!window.__samples.on) return;
          window.__samples.dt.push(now - previous);
          previous = now;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        window.__bl.longtasks.length = 0;
      }, label);
    const stopSampler = () =>
      page.evaluate(() => {
        window.__samples.on = false;
        return { dt: window.__samples.dt.slice(1), longtasks: [...window.__bl.longtasks] };
      });

    const box = await homeMap.boundingBox();
    const cx = box.x + box.width * 0.55;
    const cy = box.y + box.height * 0.4;

    await startSampler("idle");
    await sleep(3000);
    const idle = await stopSampler();
    result.idle = { frames: stats(idle.dt), longTasksMs: idle.longtasks };

    await page.mouse.move(cx, cy);
    await startSampler("pan");
    for (let rep = 0; rep < 2; rep++) {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let step = 1; step <= 40; step++) await page.mouse.move(cx - step * 6, cy + step * 2);
      for (let step = 40; step >= 0; step--) await page.mouse.move(cx - step * 6, cy + step * 2);
      await page.mouse.up();
    }
    const pan = await stopSampler();
    result.pan = { frames: stats(pan.dt), longTasksMs: pan.longtasks, rawSamples: pan.dt };

    const readScale = async () =>
      homeMap.evaluate((container) => {
        const text = container.innerText;
        const match = /(\d[\d,.]*)\s*nm/.exec(text);
        return match ? match[1] : null;
      });
    await page.mouse.move(cx, cy);
    await startSampler("zoom-in");
    const ladder = [];
    for (let tick = 0; tick < 40; tick++) {
      await page.mouse.wheel(0, -200);
      await sleep(80);
      if (tick % 4 === 3) ladder.push({ tick: tick + 1, scaleBarNm: await readScale() });
    }
    await sleep(400);
    const zoomIn = await stopSampler();
    result.zoomIn = {
      frames: stats(zoomIn.dt),
      longTasksMs: zoomIn.longtasks,
      rawSamples: zoomIn.dt,
    };
    result.zoomLadder = ladder;
    result.maxZoomScaleBarNm = await readScale();
    result.memoryAtMaxZoom = await heap();
    result.sceneAtMaxZoom = await homeMap.evaluate((container) => ({
      svgElements: container.querySelectorAll("svg *").length,
    }));
    await page.screenshot({ path: join(outDir, `run${runIndex}-max-zoom.png`) });

    await startSampler("zoom-out");
    for (let tick = 0; tick < 40; tick++) {
      await page.mouse.wheel(0, 200);
      await sleep(80);
    }
    await sleep(400);
    const zoomOut = await stopSampler();
    result.zoomOut = {
      frames: stats(zoomOut.dt),
      longTasksMs: zoomOut.longtasks,
      rawSamples: zoomOut.dt,
    };
    result.memoryAfter = await heap();
  } finally {
    await app.close();
  }
  return result;
}

const runs = [];
for (let index = 1; index <= Number(values.runs); index++) {
  runs.push(await runOnce(index));
  await writeFile(join(outDir, "baseline.json"), JSON.stringify({ runs }, null, 2));
}
const summary = runs.map((run) => ({
  run: run.run,
  refreshFps: run.refresh,
  firstPaintedMapMs: run.overviewToFirstPaintedMapMs,
  idleP95: run.idle.frames?.p95,
  panP50: run.pan.frames?.p50,
  panP95: run.pan.frames?.p95,
  panMax: run.pan.frames?.max,
  zoomP50: run.zoomIn.frames?.p50,
  zoomP95: run.zoomIn.frames?.p95,
  zoomMax: run.zoomIn.frames?.max,
  longTasksZoom: run.zoomIn.longTasksMs.length,
  maxZoomScaleBarNm: run.maxZoomScaleBarNm,
  svgElements: run.scene.svgElements,
}));
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
