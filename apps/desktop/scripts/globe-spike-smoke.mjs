import { _electron as electron } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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
    cycles: { type: "string", default: "10" },
  },
});

const outDir = values.out ?? resolve(import.meta.dirname, "..", "test-results", "globe-spike");
await mkdir(outDir, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "bw-globe-spike-"));

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });
const consoleMessages = [];
const pageErrors = [];
const requests = [];
const measurements = {};

const app = await electron.launch({
  executablePath: values.app,
  args: [`--user-data-dir=${join(scratch, "userdata")}`],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
  timeout: 60_000,
});

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

try {
  const page = await app.firstWindow();
  page.on("console", (message) =>
    consoleMessages.push({ type: message.type(), text: message.text().slice(0, 500) }),
  );
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 500)));
  page.on("request", (request) => requests.push(request.url()));
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: /open campaign/i }).waitFor({ timeout: 30_000 });

  const isPackaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged);
  check("running the packaged build", isPackaged === true);

  const guard = runPackageGuard("spike", values.app);
  check(
    "the spike package holds only the allow-listed spike assets",
    guard.ok,
    guard.ok ? "" : guard.output.slice(0, 1500),
  );

  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const [win] = BrowserWindow.getAllWindows();
    const p = win.webContents.getLastWebPreferences();
    return {
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
      sandbox: p.sandbox,
      webSecurity: p.webSecurity,
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
      remoteFetchBlocked: false,
      protocol: location.protocol,
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
  const pagePosture = await page.evaluate(() => window.__globeSpikePosture ?? null);
  measurements.pagePosture = pagePosture;
  check("eval is blocked by CSP (page-resident probe)", pagePosture?.evalBlocked === true);
  check("remote fetch is blocked", posture.remoteFetchBlocked);
  check("served from file:", posture.protocol === "file:");

  const defaultPaint = await page.evaluate(() => typeof window.__globeSpike);
  check("spike inactive by default", defaultPaint === "undefined");
  await page.screenshot({ path: join(outDir, "01-default-title.png") });

  const cdp = await app.context().newCDPSession(page);
  await cdp.send("Target.setDiscoverTargets", { discover: true });
  const counters = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
    const dom = await cdp.send("Memory.getDOMCounters");
    const targets = await cdp.send("Target.getTargets");
    const heap = await cdp.send("Runtime.getHeapUsage");
    return {
      nodes: dom.nodes,
      listeners: dom.jsEventListeners,
      documents: dom.documents,
      workers: targets.targetInfos.filter((t) => t.type === "worker").length,
      heapMB: Number((heap.usedSize / 1048576).toFixed(1)),
    };
  };
  const baseline = await counters();
  measurements.baselineCounters = baseline;

  const openSpike = async () => {
    await page.evaluate(() => {
      window.location.hash = "#globe-spike";
    });
    await page.waitForFunction(() => window.__globeSpike !== undefined, null, { timeout: 60_000 });
    await page.waitForFunction(() => window.__globeSpike?.status().idle === true, null, {
      timeout: 60_000,
    });
  };
  const closeSpike = async () => {
    await page.evaluate(() => {
      window.location.hash = "";
    });
    await page.waitForFunction(() => window.__globeSpike === undefined, null, { timeout: 15_000 });
  };

  const messagesBeforeOpen = consoleMessages.length;
  const t0 = Date.now();
  await openSpike();
  measurements.timeToIdleMs = Date.now() - t0;
  const painted = await page.evaluate(() => window.__globeSpike.canvasPaintedPixels());
  measurements.paintedPixels = painted;
  check("globe canvas painted", painted > 100, `painted=${painted}`);
  await page.screenshot({ path: join(outDir, "02-globe.png") });

  const workersOpen = (await counters()).workers;
  check(
    "map worker started",
    workersOpen > baseline.workers,
    `workers ${baseline.workers} -> ${workersOpen}`,
  );

  const sweep = [];
  for (const zoom of [1.4, 5, 10, 11.5, 12.5, 14]) {
    await page.evaluate((z) => window.__globeSpike.jumpTo(-5.35, 36.14, z), zoom);
    await page.waitForFunction(() => window.__globeSpike?.status().idle === true, null, {
      timeout: 30_000,
    });
    await sleep(300);
    const status = await page.evaluate(() => window.__globeSpike.status());
    const hit = await page.evaluate(() => window.__globeSpike.hitMarker("spike-gibraltar"));
    sweep.push({ zoom, globeness: status.globeness, hit });
    await page.screenshot({ path: join(outDir, `03-zoom-${String(zoom).replace(".", "_")}.png`) });
  }
  measurements.sweep = sweep;
  await page.evaluate(() => window.__globeSpike.jumpTo(-5.35, 36.14, 5));
  await page.waitForFunction(() => window.__globeSpike?.status().idle === true, null, {
    timeout: 30_000,
  });
  await sleep(500);
  const labels = await page.evaluate(() => window.__globeSpike.labelsRendered());
  measurements.labelsRenderedAtZ5 = labels;
  check("bundled glyphs load and symbol labels are placed", labels > 0, `labels=${labels}`);
  const mapErrors = await page.evaluate(() => window.__globeSpike.errors());
  measurements.mapErrors = mapErrors;
  check("map reported no resource errors", mapErrors.length === 0, mapErrors.join("|"));
  check(
    "marker pick succeeds at every swept zoom",
    sweep.every((row) => row.hit === true),
  );
  check(
    "blend reaches planar after z12",
    sweep.find((row) => row.zoom === 12.5)?.globeness === 0,
    JSON.stringify(sweep),
  );

  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, -300);
  await page.mouse.down();
  await page.mouse.move(700, 450, { steps: 5 });
  await page.mouse.up();
  await sleep(500);
  check("real wheel and drag input did not throw", pageErrors.length === 0, pageErrors.join("|"));

  const violationsOpen = await page.evaluate(() => window.__globeSpikeViolations ?? []);
  const openUnexpected = violationsOpen.filter((entry) => !/example\.invalid/.test(entry));
  check(
    "no CSP violations while the globe is open",
    openUnexpected.length === 0,
    openUnexpected.join("|"),
  );

  await closeSpike();
  await sleep(500);
  const afterClose = await counters();
  measurements.afterFirstClose = afterClose;

  const cycles = Number(values.cycles);
  const perCycle = [];
  for (let index = 0; index < cycles; index++) {
    await openSpike();
    await closeSpike();
    await sleep(300);
    perCycle.push(await counters());
  }
  measurements.perCycle = perCycle;
  const last = perCycle[perCycle.length - 1] ?? afterClose;
  const first = perCycle[0] ?? afterClose;
  check(
    "listeners after GC return to baseline after reopen cycles",
    last.listeners <= baseline.listeners + 20 && last.listeners <= first.listeners + 5,
    `baseline ${baseline.listeners}, first ${first.listeners}, last ${last.listeners}`,
  );
  check(
    "DOM nodes after GC return to baseline after reopen cycles",
    last.nodes <= baseline.nodes + 20 && last.nodes <= first.nodes + 5,
    `baseline ${baseline.nodes}, first ${first.nodes}, last ${last.nodes}`,
  );
  check(
    "heap after GC does not grow across reopen cycles",
    last.heapMB <= first.heapMB + 10,
    `${first.heapMB} -> ${last.heapMB} MB`,
  );
  check(
    "workers do not grow across reopen cycles",
    last.workers <= first.workers,
    `${first.workers} -> ${last.workers}`,
  );
  const canvases = await page.evaluate(() => document.querySelectorAll("canvas").length);
  measurements.canvasesAfterClose = canvases;

  await page.evaluate(() => {
    window.location.hash = "#globe-spike-fail";
  });
  await sleep(2000);
  const failure = await page.evaluate(() => ({
    failures: window.__globeSpikeFailures ?? [],
    hash: window.location.hash,
    spike: typeof window.__globeSpike,
  }));
  measurements.failSafe = failure;
  check(
    "forced failure is reported",
    failure.failures.some((entry) => /forced spike failure/.test(entry)),
  );
  check(
    "forced failure returns to the current app",
    failure.hash === "" && failure.spike === "undefined",
  );
  const appStillUp = await page.getByRole("button", { name: /open campaign/i }).isVisible();
  check("current renderer still usable after failure", appStillUp);
  await page.screenshot({ path: join(outDir, "04-after-failure.png") });

  const remote = requests.filter((url) => !/^(file:|devtools:|data:|blob:)/.test(url));
  measurements.remoteRequests = remote;
  check("no non-local requests", remote.length === 0, remote.join(" "));

  const violationsAll = await page.evaluate(() => window.__globeSpikeViolations ?? []);
  const probeViolations = violationsAll.filter((entry) => /example\.invalid/.test(entry));
  const unexpected = violationsAll.filter((entry) => !/example\.invalid/.test(entry));
  measurements.cspViolationsExpectedProbe = probeViolations;
  check("no unexpected CSP violations", unexpected.length === 0, unexpected.join("|"));

  const errors = consoleMessages.filter(
    (message, index) =>
      message.type === "error" &&
      !/example\.invalid/.test(message.text) &&
      !/forced spike failure/.test(message.text) &&
      !(index < messagesBeforeOpen && /unsafe-eval/.test(message.text)),
  );
  measurements.consoleErrors = errors;
  check("no unexpected console errors", errors.length === 0, JSON.stringify(errors));
  check("no page errors", pageErrors.length === 0, pageErrors.join("|"));
} catch (error) {
  check("smoke script completed", false, String(error));
} finally {
  await writeFile(
    join(outDir, "result.json"),
    JSON.stringify({ checks, measurements, consoleMessages, pageErrors, requests }, null, 2),
  );
  await app.close();
}

for (const entry of checks) {
  process.stdout.write(
    `${entry.ok ? "PASS" : "FAIL"}  ${entry.name}${entry.detail ? `  (${entry.detail})` : ""}\n`,
  );
}
process.exit(checks.every((entry) => entry.ok) ? 0 : 1);
