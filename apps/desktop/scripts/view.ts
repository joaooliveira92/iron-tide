/**
 * Agent-facing "eyes and hands" for the desktop app. Launches the built Electron
 * app through the hermetic E2E harness, optionally drives it, then captures what
 * is on screen. Not a test — nothing here asserts.
 *
 *   pnpm --filter @bluewave/desktop snap [--out DIR] [--click TEXT]... [--fill LABEL=VALUE]...
 *                                        [--hover TEXT]... [--click-at X,Y]... [--scroll DX,DY[@X,Y]]...
 *                                        [--shot NAME]... [--strict]
 *                                        [--press KEY]... [--wait MS] [--eval JS]
 *                                        [--save PACKAGE_DIR] [--selector CSS]
 *                                        [--advance N] [--settle MS] [--tour]
 *                                        [--make-save DIR] [--size WxH] [--theme light|dark]
 *
 * --click "TEXT @last" / "TEXT @N" clicks the last / Nth (0-based) match instead of the first.
 * --hover TEXT   hovers a control (same matching and "@last"/"@N" suffixes as --click).
 * --click-at X,Y  clicks at window coordinates (canvas content such as the map has no controls).
 * --scroll DX,DY[@X,Y]  mouse-wheel scroll, after moving the pointer to X,Y when given.
 * --shot NAME     saves a mid-flow screenshot as NAME.png, in order with the other actions.
 * --strict        exit 1 when anything went wrong: page errors, console errors, a click that had
 *                 to fall back (no accessible match, never stabilised), or an idle render loop.
 *                 Without it these are only written to console.log.
 * --advance   clicks "Advance Month" N times, in order with the other actions (repeatable).
 * --settle    extra wait (ms) once, right before capture (--wait is per action).
 * --tour      leave the first-month guided tour overlay alone (default: dismiss it).
 * --make-save runs the new-game flow, compiles a campaign into DIR (so it can be
 *             passed to --save later) and waits for the Overview. DIR must not exist
 *             or be empty.
 * --save      copies a compiled campaign package to a temp dir, opens it via
 *             "Open Campaign", and starts from there (the source is never touched).
 * --size     resizes the window (CSS pixels, e.g. 900x700) before the first action.
 * --theme     "light" or "dark": starts the app in that theme (via the app-scope preferences file).
 * --background starts the app with that animated backdrop, e.g. "auralis" (via the app-scope preferences file).
 * --selector  screenshots only the first element matching the CSS selector.
 *
 * Actions run in the order given. Output (default `.dev-data/view`, git-ignored):
 *   screenshot.png  full-window screenshot
 *   aria.yaml       accessibility tree (roles, names, states) — best for locating controls
 *   text.txt        visible text
 *   console.log     renderer console messages + page errors
 *
 * Requires a built app: `pnpm --filter @bluewave/desktop build`.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { advanceMonths, dismissTour, startNewCampaign } from "../e2e/flows.ts";
import { writeAppPreferences } from "../e2e/preferences-fixture.ts";
import { copyFixturePackage, launchHarness, teardownHarness } from "../e2e/fixtures.ts";
import { parseSnapArgs, SnapUsageError, type SnapAction } from "./snap-args.ts";

// Idle structural DOM mutations per second above which a screen is reported as churning.
const CHURN_THRESHOLD = 500;

let opts;
try {
  opts = parseSnapArgs(process.argv.slice(2));
} catch (e) {
  if (e instanceof SnapUsageError) {
    console.error(`snap: ${e.message}`);
    process.exit(2);
  }
  throw e;
}

const outDir = resolve(opts.out);
await mkdir(outDir, { recursive: true });

let saveScratch: string | undefined;
let saveDir: string | undefined;
if (opts.save) {
  saveScratch = await mkdtemp(join(tmpdir(), "bluewave-snap-save-"));
  saveDir = await copyFixturePackage(resolve(opts.save), saveScratch);
}

const makeSave = opts.makeSave ? resolve(opts.makeSave) : undefined;
const h = await launchHarness({ saveDir: saveDir ?? makeSave });
const log: string[] = [];
// What --strict fails on. Always logged; only fatal under --strict.
const problems: string[] = [];
const problem = (message: string) => {
  problems.push(message);
  log.push(`[snap] WARNING: ${message}`);
};
h.page.on("console", (m) => {
  log.push(`[${m.type()}] ${m.text()}`);
  if (m.type() === "error") problems.push(`console error: ${m.text()}`);
});
h.page.on("pageerror", (e) => {
  log.push(`[pageerror] ${e.message}`);
  problems.push(`page error: ${e.message}`);
});

// Accessible role/name match (waits for it to render, e.g. after a compile). "TEXT @last" /
// "TEXT @N" target the last / Nth (0-based) match instead of the first.
function controlLocator(arg: string) {
  const suffix = /^(.*) @(last|\d+)$/.exec(arg);
  const label = suffix ? (suffix[1] as string) : arg;
  const matches = h.page
    .getByRole("button", { name: label })
    .or(h.page.getByRole("link", { name: label }))
    .or(h.page.getByRole("tab", { name: label }))
    .or(h.page.getByRole("menuitem", { name: label }))
    .or(h.page.getByRole("checkbox", { name: label }));
  const which = suffix?.[2];
  const byRole =
    which === undefined
      ? matches.first()
      : which === "last"
        ? matches.last()
        : matches.nth(Number(which));
  return { label, byRole };
}

async function resolveControl(arg: string) {
  const { label, byRole } = controlLocator(arg);
  const appeared = await byRole
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) return byRole;
  // Not found by role: a bare text match can hit the wrong element, so it is a reportable fallback.
  problem(`"${arg}" matched no accessible control; fell back to a visible-text match`);
  return h.page.getByText(label).first();
}

async function runAction(action: SnapAction): Promise<void> {
  switch (action.kind) {
    case "click":
    case "hover": {
      const arg = action.target;
      const target = await resolveControl(arg);
      if (action.kind === "hover") {
        await target.hover({ timeout: 5_000 });
        break;
      }
      // An element that keeps re-mounting never becomes "stable"; fall back to a
      // direct DOM click and note it (a churning screen is itself worth knowing).
      await target.click({ timeout: 5_000 }).catch(async () => {
        problem(`"${arg}" never stabilised; used dispatchEvent click`);
        await target.dispatchEvent("click");
      });
      break;
    }
    case "advance":
      await advanceMonths(h.page, action.months);
      break;
    case "fill":
      await h.page.getByLabel(action.label).fill(action.value);
      break;
    case "press":
      await h.page.keyboard.press(action.key);
      break;
    case "clickAt":
      await h.page.mouse.click(action.x, action.y);
      break;
    case "scroll":
      if (action.at) await h.page.mouse.move(action.at.x, action.at.y);
      await h.page.mouse.wheel(action.dx, action.dy);
      break;
    case "shot":
      await h.page.screenshot({ path: resolve(outDir, `${action.name}.png`) });
      log.push(`[snap] shot ${action.name}.png`);
      break;
  }
}

try {
  if (opts.theme || opts.background) {
    // Seed the app-scope preferences file, before anything is opened, so the
    // theme provider (and everything keyed off it) starts in the requested theme
    // rather than having a class flipped under it.
    writeAppPreferences(h.userDataDir, {
      ...(opts.theme ? { theme: opts.theme } : {}),
      ...(opts.background ? { background: opts.background } : {}),
    });
    await h.page.reload();
    await h.page.getByText("Bluewave Naval Staff").waitFor({ timeout: 15_000 });
  }
  if (saveDir) {
    await h.page.getByRole("button", { name: "Open Campaign" }).click();
    await h.page.waitForTimeout(opts.waitMs);
  }
  if (makeSave) {
    await startNewCampaign(h.page);
    await h.page
      .getByRole("heading", { name: "Campaign Overview" })
      .waitFor({ timeout: 60_000 })
      .catch(() => problem("Overview did not appear after Begin Commission"));
  }
  if (opts.size) {
    const { width, height } = opts.size;
    await h.app.evaluate(
      ({ BrowserWindow }, [w, ht]) => {
        const win = BrowserWindow.getAllWindows().find(
          (x) => !x.webContents.getURL().startsWith("devtools://"),
        );
        win?.setMinimumSize(1, 1);
        win?.setContentSize(w as number, ht as number);
      },
      [width, height],
    );
    await h.page.waitForTimeout(500);
  }
  // The tour mounts shortly after the Overview, so only the first check waits.
  const tidy = async (waitMs = 0) => {
    if (!opts.tour) await dismissTour(h.page, waitMs || 1);
  };
  await tidy(1500);
  for (const action of opts.actions) {
    // A failed action must not lose the capture: the screen it failed on is the evidence.
    await runAction(action).catch((e: unknown) =>
      problem(
        `${action.kind} failed: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`,
      ),
    );
    await h.page.waitForTimeout(opts.waitMs);
    await tidy();
  }
  if (opts.evalSource) {
    log.push(`[eval] ${JSON.stringify(await h.page.evaluate(opts.evalSource))}`);
  }
  await h.page.waitForTimeout(opts.waitMs + opts.settleMs);

  // Churn probe: a render loop (e.g. an unstable effect dependency) keeps adding and
  // removing nodes; a calm screen changes a few dozen per second. Only structural
  // mutations count — continuous animation (the globe, shaders) rewrites attributes
  // every frame and is not a loop.
  const { structural, attributes } = await h.page.evaluate(
    () =>
      new Promise<{ structural: number; attributes: number }>((done) => {
        const counts = { structural: 0, attributes: 0 };
        const o = new MutationObserver((ms) => {
          for (const m of ms) {
            if (m.type === "attributes") counts.attributes++;
            else counts.structural++;
          }
        });
        o.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        setTimeout(() => (o.disconnect(), done(counts)), 1000);
      }),
  );
  if (structural > CHURN_THRESHOLD) {
    problem(
      `${structural} node add/remove/text mutations in 1s while idle — the screen may be in a render loop`,
    );
  }
  log.push(`[snap] idle mutations/s: structural=${structural} attributes=${attributes}`);

  const shot = { path: resolve(outDir, "screenshot.png") };
  if (opts.selector) await h.page.locator(opts.selector).first().screenshot(shot);
  else await h.page.screenshot(shot);
  await writeFile(resolve(outDir, "aria.yaml"), await h.page.locator("body").ariaSnapshot());
  await writeFile(resolve(outDir, "text.txt"), await h.page.locator("body").innerText());
  await writeFile(resolve(outDir, "console.log"), log.join("\n") + "\n");
  console.log(`captured -> ${outDir}\n  screenshot.png  aria.yaml  text.txt  console.log`);
  if (log.some((l) => l.includes("WARNING"))) console.log("  ! warnings — see console.log");
  if (opts.strict && problems.length > 0) {
    console.error(`snap --strict: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
  }
} finally {
  await teardownHarness(h);
  if (saveScratch) await rm(saveScratch, { recursive: true, force: true }).catch(() => {});
}
