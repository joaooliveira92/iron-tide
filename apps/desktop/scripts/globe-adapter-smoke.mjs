import { _electron as electron } from "@playwright/test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { runPackageGuard } from "./package-guard/run.mjs";

const { values } = parseArgs({
  options: {
    app: {
      type: "string",
      default: "dist-electron/mac-arm64/Bluewave.app/Contents/MacOS/Bluewave",
    },
    out: { type: "string" },
    cycles: { type: "string", default: "5" },
  },
});

const outDir = values.out ?? resolve(import.meta.dirname, "..", "test-results", "globe-adapter");
await mkdir(outDir, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "bw-globe-adapter-"));
const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });
const requests = [];
const pageErrors = [];
const measurements = {};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const app = await electron.launch({
  executablePath: values.app,
  args: [`--user-data-dir=${join(scratch, "userdata")}`],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
  timeout: 60_000,
});

try {
  const page = await app.firstWindow();
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 500)));
  page.on("request", (request) => requests.push(request.url()));
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: /open campaign/i }).waitFor({ timeout: 30_000 });

  const isPackaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged);
  check("running the packaged experimental adapter build", isPackaged === true);
  const guard = runPackageGuard("default", values.app);
  check(
    "the package holds only the allow-listed production globe assets",
    guard.ok,
    guard.ok ? "" : guard.output.slice(0, 1500),
  );

  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const [win] = BrowserWindow.getAllWindows();
    const web = win.webContents.getLastWebPreferences();
    return {
      contextIsolation: web.contextIsolation,
      nodeIntegration: web.nodeIntegration,
      sandbox: web.sandbox,
      webSecurity: web.webSecurity,
    };
  });
  measurements.webPreferences = prefs;
  check("contextIsolation on", prefs.contextIsolation === true);
  check("nodeIntegration off", prefs.nodeIntegration === false);
  check("sandbox on", prefs.sandbox === true);
  check("webSecurity not disabled", prefs.webSecurity !== false);

  const posture = await page.evaluate(async () => {
    const result = {
      hasRequire: typeof require !== "undefined",
      hasProcess: typeof process !== "undefined",
      protocol: location.protocol,
      remoteFetchBlocked: false,
    };
    try {
      await fetch("https://example.invalid/probe");
    } catch {
      result.remoteFetchBlocked = true;
    }
    return result;
  });
  measurements.posture = posture;
  check("renderer has no require/process", !posture.hasRequire && !posture.hasProcess);
  check("remote fetch is blocked", posture.remoteFetchBlocked);
  check("served from file:", posture.protocol === "file:");

  const cdp = await app.context().newCDPSession(page);
  await cdp.send("Target.setDiscoverTargets", { discover: true });
  const counters = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
    const dom = await cdp.send("Memory.getDOMCounters");
    const targets = await cdp.send("Target.getTargets");
    const heap = await cdp.send("Runtime.getHeapUsage");
    const live = await page.evaluate(() => document.body.querySelectorAll("*").length);
    return {
      nodes: dom.nodes,
      live,
      listeners: dom.jsEventListeners,
      documents: dom.documents,
      workers: targets.targetInfos.filter((target) => target.type === "worker").length,
      heapMB: Number((heap.usedSize / 1048576).toFixed(1)),
    };
  };
  const baselineCounters = await counters();
  measurements.baselineCounters = baselineCounters;

  const before = await page.evaluate(() => typeof window.__globeAdapter);
  check("the validation host is inactive until its explicit hash", before === "undefined");

  await page.evaluate(() => {
    window.location.hash = "#globe-adapter-demo";
  });
  await page.waitForFunction(() => window.__globeAdapter !== undefined, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__globeAdapter?.diagnostics().zoom > 0, null, {
    timeout: 60_000,
  });
  await page.waitForFunction(() => window.__globeAdapter?.whenIdle !== undefined, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => window.__globeAdapter.whenIdle());
  await sleep(500);
  const first = await page.evaluate(() => window.__globeAdapter.diagnostics());
  measurements.first = first;
  check("adapter renders markers", first.markerCount >= 6, JSON.stringify(first));
  check("adapter renders routes", first.routeCount >= 1, JSON.stringify(first));
  check(
    "adapter uses the z7 source hierarchy",
    first.sourceLevel <= 7 && first.overscaled === false,
    JSON.stringify(first),
  );
  check(
    "adapter cache is versioned by the pack",
    /natural-earth-10m-v1:[0-9a-f]{12}/.test(first.cache.version),
    first.cache.version,
  );
  check("adapter opens without renderer errors", first.errors.length === 0, first.errors.join("|"));
  const labels = await page.evaluate(() => window.__globeAdapter.areaLabelsRendered());
  measurements.areaLabelsRendered = labels;
  check("baked area labels render from the pack", labels > 0, `labels=${labels}`);
  check(
    "keyboard surface is present",
    (await page.getByRole("application", { name: /experimental globe adapter/i }).count()) === 1,
  );
  check(
    "entity list is present",
    (await page.getByRole("navigation", { name: "Ports and fleets" }).count()) === 1,
  );
  const areaButtons = await page
    .getByRole("navigation", { name: "Map areas" })
    .getByRole("button")
    .count();
  measurements.areaButtons = areaButtons;
  check("area mirror renders every area", areaButtons >= 36, `buttons=${areaButtons}`);
  const areaTableRows = await page
    .getByTestId("globe-adapter-area-table")
    .locator("tbody tr")
    .count();
  measurements.areaTableRows = areaTableRows;
  check(
    "screen-reader area table mirrors the area set",
    areaTableRows >= 36,
    `rows=${areaTableRows}`,
  );
  check("minimap is present", (await page.getByTestId("globe-adapter-minimap").count()) === 1);
  check(
    "frame meter is present",
    (await page.getByTestId("globe-adapter-frame-meter").count()) === 1,
  );
  check(
    "layers and areas control is present",
    (await page.getByRole("button", { name: "Layers & areas" }).count()) === 1,
  );

  const beforeUpdate = first.storeVersion;
  const updated = await page.evaluate(() =>
    window.__globeAdapter.updateMarker("port:demo-port-1", 20, 55),
  );
  await sleep(100);
  const afterUpdate = await page.evaluate(() => window.__globeAdapter.diagnostics());
  measurements.afterUpdate = afterUpdate;
  check(
    "one marker update is applied",
    updated === true && afterUpdate.storeVersion === beforeUpdate + 1,
    `${beforeUpdate}->${afterUpdate.storeVersion}`,
  );
  check(
    "one marker update keeps the marker set stable",
    afterUpdate.markerCount === first.markerCount,
    `${first.markerCount}->${afterUpdate.markerCount}`,
  );
  check(
    "marker visibility toggles without rebuilding",
    (await page.evaluate(() =>
      window.__globeAdapter.setMarkerVisible("port:demo-port-1", false),
    )) === true,
  );
  check(
    "hidable marker remains in the stable set",
    (await page.evaluate(() => window.__globeAdapter.diagnostics())).markerCount ===
      first.markerCount,
  );

  await page.evaluate(() => window.__globeAdapter.setProjection("mercator"));
  await page.evaluate(() => window.__globeAdapter.jumpTo(10, 30, 12.5));
  await page.evaluate(() => window.__globeAdapter.whenIdle());
  await sleep(300);
  const deep = await page.evaluate(() => window.__globeAdapter.diagnostics());
  measurements.deepPlanar = deep;
  check(
    "deep planar zoom stays on the z7 source ceiling",
    deep.sourceLevel === 7 && deep.overscaled === true,
    JSON.stringify(deep),
  );
  check("deep planar zoom still selects tiles", deep.visibleTiles > 0, `${deep.visibleTiles}`);
  await page.evaluate(() => window.__globeAdapter.setProjection("globe"));
  await page.evaluate(() => window.__globeAdapter.jumpTo(10, 30, 1.4));
  await page.evaluate(() => window.__globeAdapter.whenIdle());

  const bench = await page.evaluate(() => window.__globeAdapter.benchmarkMarkers(1000));
  measurements.benchmarkMarkers = bench;
  check(
    "1,000-marker scene applies incrementally",
    bench.applied === 1000 && bench.markerCount >= 1006,
    JSON.stringify(bench),
  );
  const one = await page.evaluate(() => {
    const started = performance.now();
    const ok = window.__globeAdapter.updateMarker("bench-marker-0", 12.5, 41.9);
    return { ok, ms: Number((performance.now() - started).toFixed(3)) };
  });
  measurements.oneMarkerUpdate = one;
  check(
    "one marker update changes one feature",
    one.ok === true && one.ms < 50,
    JSON.stringify(one),
  );
  const batch = await page.evaluate(() => window.__globeAdapter.benchmarkBatch(100));
  measurements.batchUpdate = batch;
  check("100-marker batch applies 100 changes", batch.applied === 100, JSON.stringify(batch));

  const openCounters = await counters();
  measurements.openCounters = openCounters;
  check(
    "adapter starts a map worker",
    openCounters.workers > baselineCounters.workers,
    `${baselineCounters.workers}->${openCounters.workers}`,
  );
  await page.screenshot({ path: join(outDir, "01-adapter.png") });

  const remote = requests.filter(
    (url) => !/^(file|data|blob):/.test(url) && !url.startsWith("devtools:"),
  );
  measurements.remoteRequests = remote;
  check("no remote runtime request", remote.length === 0, remote.slice(0, 5).join("|"));

  await page.evaluate(() => {
    window.location.hash = "";
  });
  await page.waitForFunction(() => window.__globeAdapter === undefined, null, { timeout: 15_000 });
  check(
    "adapter closes and removes its API",
    (await page.evaluate(() => typeof window.__globeAdapter)) === "undefined",
  );
  await sleep(500);
  const afterFirstClose = await counters();
  measurements.afterFirstClose = afterFirstClose;
  check("no page errors", pageErrors.length === 0, pageErrors.join("|"));

  for (const [hash, label] of [
    ["#globe-adapter-demo-fail", "forced initialization failure"],
    ["#globe-adapter-demo-missing", "missing tile pack"],
    ["#globe-adapter-demo-corrupt", "corrupt tile pack"],
  ]) {
    await page.evaluate((next) => {
      window.location.hash = next;
    }, hash);
    await sleep(1200);
    const active = await page.evaluate(() => typeof window.__globeAdapter);
    const overlay = await page.evaluate(() => document.querySelectorAll("#globe-adapter").length);
    check(
      `${label} falls back to the current renderer`,
      active === "undefined" && overlay === 0,
      `${active} overlay=${overlay}`,
    );
  }
  await page.evaluate(() => {
    window.location.hash = "";
  });
  await sleep(500);

  const cycles = Number(values.cycles);
  const perCycle = [];
  for (let index = 0; index < cycles; index++) {
    await page.evaluate(() => {
      window.location.hash = "#globe-adapter-demo";
    });
    await page.waitForFunction(() => window.__globeAdapter !== undefined, null, {
      timeout: 60_000,
    });
    await page.evaluate(() => {
      window.location.hash = "";
    });
    await page.waitForFunction(() => window.__globeAdapter === undefined, null, {
      timeout: 15_000,
    });
    await sleep(300);
    perCycle.push(await counters());
  }
  const lastCounters = perCycle[perCycle.length - 1] ?? afterFirstClose;
  const firstCycle = perCycle[0] ?? afterFirstClose;
  measurements.perCycle = perCycle;
  check(
    "repeated open and close leaves no adapter API",
    (await page.evaluate(() => typeof window.__globeAdapter)) === "undefined",
  );
  check(
    "listeners do not grow across open-close cycles",
    lastCounters.listeners <= firstCycle.listeners + 5,
    `first ${firstCycle.listeners}, last ${lastCounters.listeners}`,
  );
  check(
    "retained listeners stay under the 600-listener production ceiling",
    lastCounters.listeners <= 600,
    `baseline ${baselineCounters.listeners}, last ${lastCounters.listeners}`,
  );
  check(
    "DOM nodes do not grow across open-close cycles",
    lastCounters.nodes <= firstCycle.nodes + 5,
    `first ${firstCycle.nodes}, last ${lastCounters.nodes}`,
  );
  check(
    "retained detached nodes stay under the 900-node production ceiling",
    lastCounters.nodes <= 900,
    `baseline ${baselineCounters.nodes}, last ${lastCounters.nodes}`,
  );
  check(
    "live DOM returns to baseline after close",
    lastCounters.live <= baselineCounters.live + 2,
    `baseline ${baselineCounters.live}, last ${lastCounters.live}`,
  );
  check(
    "heap does not grow across open-close cycles",
    lastCounters.heapMB <= firstCycle.heapMB + 10,
    `${firstCycle.heapMB}->${lastCounters.heapMB} MB`,
  );
  check(
    "heap stays under the 32 MB production ceiling",
    lastCounters.heapMB <= 32,
    `${lastCounters.heapMB} MB`,
  );
  check(
    "workers do not grow across open-close cycles",
    lastCounters.workers <= firstCycle.workers,
    `${firstCycle.workers}->${lastCounters.workers}`,
  );

  const passed = checks.filter((entry) => entry.ok).length;
  const report = {
    passed,
    total: checks.length,
    checks,
    measurements,
    generatedAt: new Date().toISOString(),
  };
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(outDir, "globe-adapter-smoke.json"), `${JSON.stringify(report, null, 2)}\n`);
  for (const entry of checks) {
    console.log(
      `${entry.ok ? "PASS" : "FAIL"} ${entry.name}${entry.detail === "" ? "" : ` — ${entry.detail}`}`,
    );
  }
  console.log(`${passed}/${checks.length} adapter checks passed`);
  process.exitCode = passed === checks.length ? 0 : 1;
} finally {
  await app.close();
}
