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
  },
});

const outDir =
  values.out ?? resolve(import.meta.dirname, "..", "test-results", "globe-interactions");
await mkdir(outDir, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "bw-globe-interactions-"));
const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });
const pageErrors = [];

const app = await electron.launch({
  executablePath: values.app,
  args: [`--user-data-dir=${join(scratch, "userdata")}`],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
  timeout: 60_000,
});

try {
  await app.evaluate(({ BrowserWindow }) => {
    const [win] = BrowserWindow.getAllWindows();
    win.setContentSize(1470, 868);
  });
  const page = await app.firstWindow();
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 500)));
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: /open campaign/i }).waitFor({ timeout: 30_000 });
  await page.evaluate(() => {
    window.location.hash = "#globe-adapter-demo";
  });
  await page.waitForFunction(() => window.__globeAdapter !== undefined, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__globeAdapter?.diagnostics().zoom > 0, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => window.__globeAdapter.whenIdle());
  await page.emulateMedia({ reducedMotion: "reduce" });

  const diagnostics = () => page.evaluate(() => window.__globeAdapter.diagnostics());
  const surface = page.getByRole("application", { name: /experimental globe adapter/i });
  await surface.focus();

  const zoomBefore = (await diagnostics()).zoom;
  await page.keyboard.press("+");
  await page.waitForFunction(
    (before) => window.__globeAdapter.diagnostics().zoom > before,
    zoomBefore,
    { timeout: 10_000 },
  );
  check("keyboard plus zooms the packaged globe", (await diagnostics()).zoom > zoomBefore);

  const centreBefore = (await diagnostics()).centre[0];
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    (before) => window.__globeAdapter.diagnostics().centre[0] !== before,
    centreBefore,
    { timeout: 10_000 },
  );
  check("keyboard arrow pans the packaged globe", (await diagnostics()).centre[0] !== centreBefore);

  await page.keyboard.press("0");
  await page.waitForFunction(() => window.__globeAdapter.diagnostics().zoom < 2, null, {
    timeout: 10_000,
  });
  check("keyboard zero resets the packaged globe to the world", (await diagnostics()).zoom < 2);

  const areaList = page.getByRole("navigation", { name: "Map areas" });
  const firstArea = areaList.getByRole("button").first();
  const areaName = await firstArea.innerText();
  await firstArea.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Map areas"] [aria-pressed="true"]') !== null,
    null,
    { timeout: 10_000 },
  );
  check(
    "keyboard area activation selects an area",
    (await firstArea.getAttribute("aria-pressed")) === "true",
    areaName,
  );

  const ownership = page.getByRole("button", { name: "Ownership" });
  const ownershipBefore = await ownership.evaluate((element) => element.style.background);
  await ownership.click();
  await page.waitForFunction(
    (before) => {
      const button = [...document.querySelectorAll("button")].find(
        (entry) => entry.textContent === "Ownership",
      );
      return button !== undefined && button.style.background !== before;
    },
    ownershipBefore,
    { timeout: 10_000 },
  );
  check(
    "layer toggle changes ownership state",
    (await ownership.evaluate((element) => element.style.background)) !== ownershipBefore,
  );
  await ownership.click();

  await page.getByRole("button", { name: "Equirectangular" }).click();
  await page.waitForFunction(
    () => window.__globeAdapter.diagnostics().projection === "mercator",
    null,
    {
      timeout: 10_000,
    },
  );
  check(
    "projection control switches to the planar projection",
    (await diagnostics()).projection === "mercator",
  );
  await page.getByRole("button", { name: "Miller cylindrical" }).click();
  await page.waitForFunction(
    () => window.__globeAdapter.diagnostics().projection === "globe",
    null,
    {
      timeout: 10_000,
    },
  );
  check(
    "projection control returns to the globe projection",
    (await diagnostics()).projection === "globe",
  );

  await page.getByRole("button", { name: "Reset view" }).click();
  await page.waitForFunction(() => window.__globeAdapter.diagnostics().zoom < 2, null, {
    timeout: 10_000,
  });
  check("reset view restores the world camera", (await diagnostics()).zoom < 2);

  await page.keyboard.press("n");
  check("return north keeps a zero bearing", (await diagnostics()).bearing === 0);

  const areas = await page.evaluate(() => [...window.__globeAdapterDemo.areas]);
  const fleetPoint = await page.evaluate(() =>
    window.__globeAdapter.featureScreenPoint("fleet:demo-fleet-1"),
  );
  await page.mouse.move(fleetPoint.x, fleetPoint.y);
  await page.mouse.click(fleetPoint.x, fleetPoint.y);
  await page.waitForFunction(
    () => document.documentElement.dataset.demoSelectedFleet === "demo-fleet-1",
    null,
    { timeout: 10_000 },
  );
  check("pointer selects a fleet marker", true, JSON.stringify(fleetPoint));

  const from = areas[0];
  const to = areas[1];
  for (const areaId of [from, to]) {
    const point = await page.evaluate((id) => window.__globeAdapter.areaScreenPoint(id), areaId);
    await page.keyboard.down("Shift");
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up("Shift");
  }
  await page.getByText(/nm\/hop/).waitFor({ timeout: 10_000 });
  check("shift-click reads a route between two areas", true, `${from} -> ${to}`);

  const hoverPoint = await page.evaluate(
    (id) => window.__globeAdapter.areaScreenPoint(id),
    areas[2],
  );
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  const tooltip = page.getByTestId("globe-adapter-tooltip");
  await tooltip.waitFor({ timeout: 10_000 });
  check("hover shows the area tooltip", (await tooltip.innerText()).length > 0);

  const legalArea = await page.evaluate(
    () => window.__globeAdapterDemo.legalDestinations["demo-fleet-1"],
  );
  const dropFleet = await page.evaluate(() =>
    window.__globeAdapter.featureScreenPoint("fleet:demo-fleet-1"),
  );
  const dropArea = await page.evaluate(
    (id) => window.__globeAdapter.areaScreenPoint(id),
    legalArea,
  );
  await page.mouse.move(dropFleet.x, dropFleet.y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(
      dropFleet.x + ((dropArea.x - dropFleet.x) * step) / 8,
      dropFleet.y + ((dropArea.y - dropFleet.y) * step) / 8,
    );
  }
  await page.mouse.up();
  await page.waitForFunction(
    () => window.__globeAdapterDemo.lastDrop?.startsWith("demo-fleet-1->") === true,
    null,
    { timeout: 10_000 },
  );
  const legalDrop = await page.evaluate(() => window.__globeAdapterDemo.lastDrop);
  check(
    "drag-to-order accepts a legal fleet drop",
    legalDrop === `demo-fleet-1->${legalArea}`,
    legalDrop,
  );

  const illegalArea = areas.find((id) => id !== legalArea);
  const illegalFleet = await page.evaluate(() =>
    window.__globeAdapter.featureScreenPoint("fleet:demo-fleet-2"),
  );
  const illegalPoint = await page.evaluate(
    (id) => window.__globeAdapter.areaScreenPoint(id),
    illegalArea,
  );
  const dropBeforeIllegal = await page.evaluate(() => window.__globeAdapterDemo.lastDrop);
  await page.mouse.move(illegalFleet.x, illegalFleet.y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(
      illegalFleet.x + ((illegalPoint.x - illegalFleet.x) * step) / 8,
      illegalFleet.y + ((illegalPoint.y - illegalFleet.y) * step) / 8,
    );
  }
  await page.mouse.up();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const dropAfterIllegal = await page.evaluate(() => window.__globeAdapterDemo.lastDrop);
  check(
    "drag-to-order rejects an illegal fleet drop",
    dropAfterIllegal === dropBeforeIllegal && dropAfterIllegal !== `demo-fleet-2->${illegalArea}`,
    `${dropBeforeIllegal} -> ${dropAfterIllegal}`,
  );

  const keyboardPan = await page.evaluate(() => ({
    tiles: window.__globeAdapter.areaLabelsRendered(),
    labels: document.querySelectorAll('[data-testid="globe-adapter-status"]').length,
  }));
  check(
    "labels stay rendered after the gesture pass",
    keyboardPan.tiles > 0,
    JSON.stringify(keyboardPan),
  );

  await page.screenshot({ path: join(outDir, "globe-interactions.png") });
  const passed = checks.filter((entry) => entry.ok).length;
  const report = { passed, total: checks.length, checks, pageErrors };
  await writeFile(join(outDir, "globe-interactions.json"), `${JSON.stringify(report, null, 2)}\n`);
  for (const entry of checks) {
    console.log(
      `${entry.ok ? "PASS" : "FAIL"} ${entry.name}${entry.detail === "" ? "" : ` — ${entry.detail}`}`,
    );
  }
  console.log(`${passed}/${checks.length} packaged interaction checks passed`);
  process.exitCode = passed === checks.length && pageErrors.length === 0 ? 0 : 1;
} finally {
  await app.close();
}
