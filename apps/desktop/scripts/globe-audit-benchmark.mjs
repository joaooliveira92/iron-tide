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
    label: { type: "string", default: "adapter" },
    hash: { type: "string", default: "#globe-adapter-demo" },
    width: { type: "string", default: "1470" },
    height: { type: "string", default: "868" },
    trace: { type: "boolean", default: false },
    enforce: { type: "boolean", default: false },
    cooldown: { type: "string", default: "3000" },
  },
});

const outDir = values.out ?? resolve(import.meta.dirname, "..", "test-results", "globe-audit");
await mkdir(outDir, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "bw-globe-audit-"));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

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

async function runOnce(runIndex) {
  const app = await electron.launch({
    executablePath: values.app,
    args: [
      `--user-data-dir=${join(scratch, `userdata-${runIndex}`)}`,
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-background-timer-throttling",
    ],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
    timeout: 60_000,
  });
  const result = { run: runIndex, hash: values.hash };
  try {
    await app.evaluate(
      ({ BrowserWindow }, size) => {
        const [win] = BrowserWindow.getAllWindows();
        win.setContentSize(size.width, size.height);
      },
      { width: Number(values.width), height: Number(values.height) },
    );
    const page = await app.firstWindow();
    const pageErrors = [];
    const requests = [];
    page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 500)));
    page.on("request", (request) => requests.push(request.url()));
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("button", { name: /open campaign/i }).waitFor({ timeout: 60_000 });
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, values.hash);
    await page.waitForFunction(() => window.__globeAdapter !== undefined, null, {
      timeout: 60_000,
    });
    await page.waitForFunction(() => window.__globeAdapter?.diagnostics().zoom > 0, null, {
      timeout: 60_000,
    });
    await page.evaluate(() => window.__globeAdapter.whenIdle());
    await sleep(1000);

    const cdp = await app.context().newCDPSession(page);
    const metrics = async () =>
      (await cdp.send("Performance.getMetrics")).metrics.reduce((out, entry) => {
        out[entry.name] = entry.value;
        return out;
      }, {});
    await cdp.send("Performance.enable");

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
    result.refreshHz = await page.evaluate(
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

    await page.evaluate(() => {
      window.__audit = { longTasks: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__audit.longTasks.push(entry.duration);
      }).observe({ entryTypes: ["longtask"] });
    });

    const sample = async (action) => {
      await page.evaluate(() => {
        window.__s = { dt: [], on: true };
        window.__audit.longTasks.length = 0;
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
      const settleMs = await page.evaluate(async () => {
        const started = performance.now();
        await window.__globeAdapter.whenIdle();
        return performance.now() - started;
      });
      const after = await metrics();
      const out = await page.evaluate(() => {
        window.__s.on = false;
        return { dt: window.__s.dt.slice(1), longTasks: [...window.__audit.longTasks] };
      });
      return {
        frames: stats(out.dt),
        framesOver33: out.dt.filter((duration) => duration > 33.4).length,
        longTasks: out.longTasks.length,
        longTaskTotalMs: out.longTasks.reduce((total, duration) => total + duration, 0),
        settleMsAfterBurst: settleMs,
        mainThreadTaskMs: (after.TaskDuration - before.TaskDuration) * 1000,
        mainThreadScriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
        rawSamples: out.dt,
      };
    };

    const target = page.getByRole("application", { name: /experimental globe adapter/i });
    const box = await target.boundingBox();
    if (box === null) throw new Error("adapter surface has no bounding box");
    const cx = box.x + box.width * 0.55;
    const cy = box.y + box.height * 0.4;
    await page.mouse.move(cx, cy);

    result.idle = await sample(() => sleep(3000));
    result.pan = await sample(async () => {
      for (let rep = 0; rep < 2; rep++) {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        for (let step = 1; step <= 40; step++) await page.mouse.move(cx - step * 6, cy + step * 2);
        for (let step = 40; step >= 0; step--) await page.mouse.move(cx - step * 6, cy + step * 2);
        await page.mouse.up();
      }
    });
    await page.mouse.move(cx, cy);
    result.zoomIn = await sample(async () => {
      for (let tick = 0; tick < 40; tick++) {
        await page.mouse.wheel(0, -200);
        await sleep(80);
      }
      await sleep(400);
    });
    result.zoomInDiagnostics = await page.evaluate(() => window.__globeAdapter.diagnostics());
    let tracePath = null;
    if (values.trace) {
      tracePath = join(outDir, `run${runIndex}-zoom-out-trace.json`);
      await cdp.send("Tracing.start", {
        categories:
          "toplevel,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,gpu,viz,blink.user_timing,loading",
        transferMode: "ReturnAsStream",
      });
    }
    result.zoomOut = await sample(async () => {
      for (let tick = 0; tick < 40; tick++) {
        await page.mouse.wheel(0, 200);
        await sleep(80);
      }
      await sleep(400);
    });
    if (values.trace) {
      const completed = new Promise((done) => cdp.once("Tracing.tracingComplete", done));
      await cdp.send("Tracing.end");
      const { stream } = await completed;
      const chunks = [];
      for (;;) {
        const chunk = await cdp.send("IO.read", { handle: stream });
        if (chunk.data)
          chunks.push(
            chunk.base64Encoded ? Buffer.from(chunk.data, "base64") : Buffer.from(chunk.data),
          );
        if (chunk.eof) break;
      }
      await writeFile(tracePath, Buffer.concat(chunks));
      result.trace = tracePath;
    }
    result.zoomOutDiagnostics = await page.evaluate(() => window.__globeAdapter.diagnostics());
    result.memoryAfter = await heap();
    result.pageErrors = pageErrors;
    result.remoteRequests = requests.filter((url) => !/^(file|data|blob|devtools):/.test(url));
    result.cpu = await page.evaluate(() => navigator.hardwareConcurrency);
    result.graphics = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (context === null) return { api: "none" };
      const debug = context.getExtension("WEBGL_debug_renderer_info");
      return {
        api: canvas.getContext("webgl2") === null ? "webgl" : "webgl2",
        vendor: debug === null ? "unavailable" : context.getParameter(debug.UNMASKED_VENDOR_WEBGL),
        renderer:
          debug === null ? "unavailable" : context.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      };
    });
    result.platform = {
      os: process.platform,
      arch: process.arch,
      electron: await app.evaluate(({ app: electronApp }) => electronApp.getVersion()),
      version: await app.evaluate(({ app: electronApp }) => electronApp.getVersion()),
    };
  } finally {
    await app.close();
  }
  return result;
}

const runs = [];
for (let index = 1; index <= Number(values.runs); index++) {
  if (index > 1) await sleep(Number(values.cooldown));
  runs.push(await runOnce(index));
}
const summary = runs.map((run) => ({
  run: run.run,
  refreshHz: run.refreshHz,
  idleP95: run.idle.frames?.p95,
  panMax: run.pan.frames?.max,
  zoomInP95: run.zoomIn.frames?.p95,
  zoomInMax: run.zoomIn.frames?.max,
  zoomOutP95: run.zoomOut.frames?.p95,
  zoomOutMax: run.zoomOut.frames?.max,
  zoomOutOver33: run.zoomOut.framesOver33,
  zoomOutLongTasks: run.zoomOut.longTasks,
  settleMs: run.zoomOut.settleMsAfterBurst,
}));

const PRODUCTION_FRAME_BUDGET = {
  refreshHzMin: 55,
  idleP95MaxMs: 34,
  panMaxMs: 50,
  zoomInP95MaxMs: 34,
  zoomInMaxMs: 100,
  zoomOutP95MaxMs: 34,
  zoomOutMaxMs: 50,
  zoomOutLongTasksMax: 0,
  settleMaxMs: 100,
};

const budgetResults = runs.map((run) => {
  const checks = {
    refreshHz: run.refreshHz >= PRODUCTION_FRAME_BUDGET.refreshHzMin,
    idleP95: (run.idle.frames?.p95 ?? Infinity) <= PRODUCTION_FRAME_BUDGET.idleP95MaxMs,
    panMax: (run.pan.frames?.max ?? Infinity) <= PRODUCTION_FRAME_BUDGET.panMaxMs,
    zoomInP95: (run.zoomIn.frames?.p95 ?? Infinity) <= PRODUCTION_FRAME_BUDGET.zoomInP95MaxMs,
    zoomInMax: (run.zoomIn.frames?.max ?? Infinity) <= PRODUCTION_FRAME_BUDGET.zoomInMaxMs,
    zoomOutP95: (run.zoomOut.frames?.p95 ?? Infinity) <= PRODUCTION_FRAME_BUDGET.zoomOutP95MaxMs,
    zoomOutMax: (run.zoomOut.frames?.max ?? Infinity) <= PRODUCTION_FRAME_BUDGET.zoomOutMaxMs,
    zoomOutLongTasks: run.zoomOut.longTasks <= PRODUCTION_FRAME_BUDGET.zoomOutLongTasksMax,
    settle: run.zoomOut.settleMsAfterBurst <= PRODUCTION_FRAME_BUDGET.settleMaxMs,
  };
  return { run: run.run, checks, passed: Object.values(checks).every(Boolean) };
});

const accepted = budgetResults.every((entry) => entry.passed);
const report = {
  label: values.label,
  budget: PRODUCTION_FRAME_BUDGET,
  budgetResults,
  accepted,
  environment: {
    os: runs[0]?.platform.os,
    arch: runs[0]?.platform.arch,
    electron: runs[0]?.platform.electron,
    graphics: runs[0]?.graphics,
    viewport: runs[0]?.viewport,
    cpu: runs[0]?.cpu,
    refreshHz: runs[0]?.refreshHz,
  },
  runs,
};
await writeFile(join(outDir, `${values.label}.json`), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify({ ...report, runs: summary }, null, 2)}\n`);
if (values.enforce && !accepted) process.exitCode = 1;
