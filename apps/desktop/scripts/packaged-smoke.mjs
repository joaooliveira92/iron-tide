/**
 * Release smoke test for the PACKAGED app (not the electron-vite build the e2e
 * suite drives). Launches the real binary, starts a FRESH game (this is the path
 * that reads the shipped content artifact from app resources — not a repo-root
 * walk), and checks what packaging can break: file:// loading, the lazy
 * coastline chunk, the artifact-backed shipbuilding content, the debug gate and
 * the map's canvas actually painting. Exits non-zero on failure.
 *
 *   pnpm --filter @bluewave/desktop build
 *   CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @bluewave/desktop exec \
 *     electron-builder --mac --dir --config electron-builder.yml
 *   pnpm --filter @bluewave/desktop run smoke:packaged [--app BINARY] [--shot OUT.png] [--save DIR]
 *
 * `--shot` overrides the shipbuilding screenshot path; it defaults to
 * `test-results/packaged-smoke.png` and is captured on every run (CI uploads
 * it). `--save` is only the (stubbed) destination for the fresh campaign's
 * package; it defaults to a temp dir. The default `--app` path is the macOS
 * arm64 unpacked build; pass `--app` for other platforms.
 *
 * The new-game flow mirrors apps/desktop/e2e/flows.ts (the proven e2e path);
 * keep the two in step when the assistant changes.
 */
import { _electron as electron } from "@playwright/test";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { runPackageGuard } from "./package-guard/run.mjs";

const { values } = parseArgs({
  options: {
    app: {
      type: "string",
      default: "dist-electron/mac-arm64/Bluewave.app/Contents/MacOS/Bluewave",
    },
    shot: { type: "string" },
    save: { type: "string" },
  },
});

// Console `error`s that are known-benign and self-caught. Each entry must be a
// narrow match with a reason; a broad pattern here would hide real renderer
// faults. (Any library that feature-detects `unsafe-eval` inside a try/catch
// would emit the same Chromium CSP note, which is harmless because the throw is
// swallowed.)
const BENIGN_CONSOLE_ERRORS = [
  /Note that 'script-src' was not explicitly set, so 'default-src' is used as a fallback\./,
];

const scratch = await mkdtemp(join(tmpdir(), "bw-pkg-smoke-"));
const saveDir = values.save ?? join(scratch, "save");
await mkdir(saveDir, { recursive: true });

// The drawing-board screenshot is the reviewer's visible evidence (ticket 05,
// CRI-PKG-3). Capture it on every run — CI uploads it — not only when `--shot`
// is passed, so a green packaged smoke always leaves a screen to inspect.
const shotPath =
  values.shot ?? resolve(import.meta.dirname, "..", "test-results", "packaged-smoke.png");
await mkdir(dirname(shotPath), { recursive: true });

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

const app = await electron.launch({
  executablePath: values.app,
  args: [`--user-data-dir=${join(scratch, "userdata")}`],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
  timeout: 60_000,
});
try {
  await app.evaluate(({ dialog }, dir) => {
    // Mutate methods, never replace the module. Save dialog (fresh compile)
    // returns `filePath`; open dialog (continuance) returns `filePaths`.
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: dir });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, saveDir);
  const isPackaged = await app.evaluate(({ app: electronApp }) => electronApp.isPackaged);
  check("running the packaged build", isPackaged === true);

  const guard = runPackageGuard("default", values.app);
  check(
    "the default package holds only the allow-listed production globe assets",
    guard.ok,
    guard.ok ? "" : guard.output.slice(0, 1500),
  );

  // The window may already exist by the time we ask: firstWindow handles both.
  const page = await app.firstWindow();
  // Uncaught exceptions are always fatal. Console `error`s are fatal unless they
  // match a known-benign, self-caught probe from a bundled library (see above).
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.waitForLoadState("load");
  check("renderer loaded over file://", page.url().startsWith("file://"), page.url());

  // --- Fresh game (reads shipped content from app resources) ---
  await page.getByText("Bluewave Naval Staff").waitFor({ timeout: 20_000 });
  const click = (name) => page.getByRole("button", { name }).first().click();
  await click("New Campaign");
  await page.getByRole("option", { name: "United Kingdom" }).click();
  await page.getByRole("listbox", { name: "Playable nations" }).press("Enter");
  await click("Next: Choose Archetype");
  // The deck's cards overlap: step the listbox to the archetype and confirm with Enter.
  const deck = page.getByRole("listbox", { name: "Archetype presets" });
  const target = await page.getByRole("option", { name: "Shipyard Baron" }).getAttribute("id");
  for (let step = 0; step < 4; step++) {
    if ((await deck.getAttribute("aria-activedescendant")) === target) break;
    await deck.press("ArrowRight");
  }
  await deck.press("Enter");
  await click("Choose Nation");
  await page.getByLabel("Admiral name").fill("John Fisher");
  await page.getByLabel("Campaign name").fill("Packaged Smoke");
  await click("Next");
  await click("Next: Review Campaign");
  await click("Begin Commission");
  for (const label of [
    "Review Naval Estimates",
    "Continue to Treasury Position",
    "Continue to Foreign Intelligence",
    "Continue to Immediate Concerns",
    "Take command",
  ]) {
    await click(label);
  }

  await page.getByRole("heading", { name: "Campaign Overview" }).waitFor({ timeout: 30_000 });
  check("fresh campaign compiles onto Overview", true);
  check("month header visible", await page.getByText("Bluewave — January 1880").isVisible());
  check(
    "no session id in the release UI",
    !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(await page.locator("body").innerText()),
  );
  const reason = await page.evaluate(
    async () =>
      (await window.bluewave.campaign.execute("generateBattle", { sessionId: "x", warId: "w" }))
        .reason,
  );
  check("debug-only commands rejected", reason === "DEBUG_ONLY", String(reason));

  // --- The Overview home map is now the globe renderer by default. It must
  // mount from packaged assets, report itself, and keep a tested legacy path.
  const globe = page.getByTestId("globe-adapter");
  await globe.waitFor({ timeout: 30_000 });
  check("globe renderer is the default Overview renderer", true);
  check(
    "renderer diagnostic reports the globe",
    (await page.evaluate(() => document.documentElement.dataset.overviewRenderer)) === "globe",
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="globe-adapter-status"]')
        ?.textContent?.includes("tiles=") === true,
    null,
    { timeout: 30_000 },
  );
  const globeStatus = await page.getByTestId("globe-adapter-status").innerText();
  check(
    "globe reports a live source level and tile set",
    /z=.*tiles=[1-9]/.test(globeStatus),
    globeStatus,
  );
  const globeAreas = page.getByRole("navigation", { name: "Map areas" }).getByRole("button");
  check(
    "globe exposes every area as a keyboard button",
    (await globeAreas.count()) >= 36,
    `buttons=${await globeAreas.count()}`,
  );
  check(
    "globe exposes the screen-reader area table",
    (await page.getByTestId("globe-adapter-area-table").locator("tbody tr").count()) >= 36,
  );
  await page.screenshot({ path: resolve(dirname(shotPath), "globe-overview.png") });

  await page.evaluate(() => {
    window.location.hash = "#legacy-renderer";
  });
  const legacyApp = page.getByRole("application", { name: /World map/ });
  await legacyApp.waitFor({ timeout: 15_000 });
  check("legacy renderer is available as a rollback fallback", true);
  check(
    "renderer diagnostic reports the rollback",
    (await page.evaluate(() => document.documentElement.dataset.overviewRenderer)) === "legacy",
  );
  check(
    "legacy home map keeps its 36 keyboard-reachable areas",
    (await legacyApp.locator('path[role="button"]').count()) === 36,
  );
  await page.evaluate(() => {
    window.location.hash = "";
  });
  await globe.waitFor({ timeout: 30_000 });
  check("clearing the rollback flag returns to the globe renderer", true);

  // --- The Shipbuilding workspace renders the artifact-backed ship-building content ---
  await page.getByTestId("bottom-nav").getByRole("button", { name: "Ship design" }).click();
  const workspace = page.getByTestId("shipbuilding-dialog");
  await workspace.getByRole("img", { name: /Top-down plan/ }).waitFor({ timeout: 15_000 });
  check("shipbuilding workspace opens on the shipped content", true);
  check(
    "shipbuilding workspace loads the ship-building catalogue",
    (await workspace.getByRole("group", { name: "Hull sections" }).getByRole("button").count()) ===
      8,
  );
  // The plan is drawn from the catalogue (a non-empty SVG), not an error card.
  check(
    "shipbuilding workspace renders the ship plan",
    (await workspace.getByRole("img", { name: /Top-down plan/ }).count()) === 1,
  );
  await page.screenshot({ path: shotPath });
  check("shipbuilding screenshot captured", (await stat(shotPath)).size > 0, shotPath);

  check("no uncaught renderer exceptions", pageErrors.length === 0, pageErrors[0]?.slice(0, 200));
  const unexpectedConsoleErrors = consoleErrors.filter(
    (text) => !BENIGN_CONSOLE_ERRORS.some((pattern) => pattern.test(text)),
  );
  check(
    "no unexpected console errors",
    unexpectedConsoleErrors.length === 0,
    unexpectedConsoleErrors[0]?.slice(0, 200),
  );

  // --- Shell policy in the packaged binary: the renderer's CSP is enforced over
  // file:// and renderer-created windows are denied. Run after the console-error
  // assertion because a blocked probe deliberately logs CSP violations.
  const shell = await page.evaluate(async () => {
    const violated = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      violated.push(event.violatedDirective),
    );
    const script = document.createElement("script");
    script.textContent = "window.__cspInlineProbe = true;";
    document.head.append(script);
    const base = document.createElement("base");
    base.href = "https://example.com/";
    document.head.append(base);
    base.remove();
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      violated,
      inlineScriptRan: window.__cspInlineProbe === true,
      windowOpened: window.open("https://example.com/") !== null,
    };
  });
  check(
    "packaged CSP blocks inline scripts",
    !shell.inlineScriptRan && shell.violated.includes("script-src-elem"),
    String(shell.violated),
  );
  check("packaged CSP locks base-uri", shell.violated.includes("base-uri"), String(shell.violated));
  check("packaged shell denies renderer-created windows", shell.windowOpened === false);
  check(
    "packaged shell keeps a single window",
    app.windows().length === 1,
    String(app.windows().length),
  );

  // --- Crash support bundle (ADR-0133 hardening): force a real uncaught renderer
  // error in the packaged binary and assert the local-only bundle is written.
  // Done after the pageerror assertions above so the deliberate crash does not
  // trip them. No network call is made anywhere in the capture path.
  const userDataDir = await app.evaluate(({ app: electronApp }) => electronApp.getPath("userData"));
  const supportDir = join(userDataDir, "support");
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("packaged-smoke forced crash");
    }, 0);
  });
  let bundlePath = null;
  let bundle = null;
  {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const name = (await readdir(supportDir)).find((entry) => entry.startsWith("crash-"));
        if (name) {
          bundlePath = join(supportDir, name);
          bundle = JSON.parse(await readFile(bundlePath, "utf8"));
          break;
        }
      } catch {
        // support dir not created yet
      }
      await page.waitForTimeout(150);
    }
  }
  check("crash support bundle written by the packaged binary", Boolean(bundle), supportDir);
  if (bundle) {
    check(
      "support bundle carries the forced crash",
      String(bundle.message).includes("packaged-smoke forced crash"),
      String(bundle.message),
    );
    check(
      "support bundle is local-only (no network note)",
      /no network/i.test(String(bundle.note)),
    );
  }
} finally {
  await app.close().catch(() => {});
  await rm(scratch, { recursive: true, force: true }).catch(() => {});
}

for (const { name, ok, detail } of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail && !ok ? ` — ${detail}` : ""}`);
}
process.exit(checks.every((c) => c.ok) ? 0 : 1);
