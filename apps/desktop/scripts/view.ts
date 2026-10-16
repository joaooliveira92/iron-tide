/**
 * Agent-facing "eyes and hands" for the desktop app. Launches the built Electron
 * app through the hermetic E2E harness, optionally drives it, then captures what
 * is on screen. Not a test — nothing here asserts.
 *
 *   pnpm --filter @bluewave/desktop snap [--out DIR] [--click TEXT]... [--fill LABEL=VALUE]...
 *                                        [--press KEY]... [--wait MS] [--eval JS]
 *                                        [--save PACKAGE_DIR] [--selector CSS]
 *                                        [--advance N] [--settle MS] [--tour]
 *                                        [--make-save DIR] [--size WxH] [--theme light|dark]
 *
 * --click "TEXT @last" / "TEXT @N" clicks the last / Nth (0-based) match instead of the first.
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
import { parseArgs } from "node:util";
import { advanceMonths, dismissTour, startNewCampaign } from "../e2e/flows.ts";
import { writeAppPreferences } from "../e2e/preferences-fixture.ts";
import { copyFixturePackage, launchHarness, teardownHarness } from "../e2e/fixtures.ts";
import type { AppPreferences } from "../src/shared/preferences-contract.ts";

// Idle structural DOM mutations per second above which a screen is reported as churning.
const CHURN_THRESHOLD = 500;

const { values } = parseArgs({
  options: {
    out: { type: "string", default: ".dev-data/view" },
    click: { type: "string", multiple: true, default: [] },
    fill: { type: "string", multiple: true, default: [] },
    press: { type: "string", multiple: true, default: [] },
    wait: { type: "string", default: "300" },
    eval: { type: "string" },
    save: { type: "string" },
    selector: { type: "string" },
    advance: { type: "string", multiple: true, default: [] },
    settle: { type: "string", default: "0" },
    tour: { type: "boolean", default: false },
    "make-save": { type: "string" },
    size: { type: "string" },
    theme: { type: "string" },
    background: { type: "string" },
  },
  strict: true,
});

// Preserve CLI order across the three action flags.
const order = process.argv
  .slice(2)
  .filter((a) => ["--click", "--fill", "--press", "--advance"].includes(a))
  .map((a) => a.slice(2) as "click" | "fill" | "press" | "advance");
const queues = {
  click: [...values.click!],
  fill: [...values.fill!],
  press: [...values.press!],
  advance: [...values.advance!],
};

const outDir = resolve(values.out!);
await mkdir(outDir, { recursive: true });

let saveScratch: string | undefined;
let saveDir: string | undefined;
if (values.save) {
  saveScratch = await mkdtemp(join(tmpdir(), "bluewave-snap-save-"));
  saveDir = await copyFixturePackage(resolve(values.save), saveScratch);
}

const makeSave = values["make-save"] ? resolve(values["make-save"]) : undefined;
const h = await launchHarness({ saveDir: saveDir ?? makeSave });
const log: string[] = [];
h.page.on("console", (m) => log.push(`[${m.type()}] ${m.text()}`));
h.page.on("pageerror", (e) => log.push(`[pageerror] ${e.message}`));

try {
  if (values.theme || values.background) {
    // Seed the app-scope preferences file, before anything is opened, so the
    // theme provider (and everything keyed off it) starts in the requested theme
    // rather than having a class flipped under it.
    writeAppPreferences(h.userDataDir, {
      ...(values.theme ? { theme: values.theme as AppPreferences["theme"] } : {}),
      ...(values.background
        ? { background: values.background as AppPreferences["background"] }
        : {}),
    });
    await h.page.reload();
    await h.page.getByText("Bluewave Naval Staff").waitFor({ timeout: 15_000 });
  }
  if (saveDir) {
    await h.page.getByRole("button", { name: "Open Campaign" }).click();
    await h.page.waitForTimeout(Number(values.wait));
  }
  if (makeSave) {
    await startNewCampaign(h.page);
    await h.page
      .getByRole("heading", { name: "Campaign Overview" })
      .waitFor({ timeout: 60_000 })
      .catch(() => log.push("[snap] Overview did not appear after Begin Commission"));
  }
  if (values.size) {
    const match = /^(\d+)x(\d+)$/.exec(values.size);
    if (match === null) throw new Error(`--size expects WxH, got "${values.size}"`);
    const [, width, height] = match;
    await h.app.evaluate(
      ({ BrowserWindow }, [w, ht]) => {
        const win = BrowserWindow.getAllWindows().find(
          (x) => !x.webContents.getURL().startsWith("devtools://"),
        );
        win?.setMinimumSize(1, 1);
        win?.setContentSize(w as number, ht as number);
      },
      [Number(width), Number(height)],
    );
    await h.page.waitForTimeout(500);
  }
  // The tour mounts shortly after the Overview, so only the first check waits.
  const tidy = async (waitMs = 0) => {
    if (!values.tour) await dismissTour(h.page, waitMs || 1);
  };
  await tidy(1500);
  for (const kind of order) {
    const arg = queues[kind].shift()!;
    if (kind === "click") {
      // Prefer an accessible role/name match (waiting for it to render, e.g. after
      // a compile), fall back to any visible text.
      // "TEXT @last" / "TEXT @N" target the last / Nth (0-based) match instead of the
      // first (e.g. one row's button among many with the same label).
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
      const appeared = await byRole
        .waitFor({ timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      const target = appeared ? byRole : h.page.getByText(label).first();
      // An element that keeps re-mounting never becomes "stable"; fall back to a
      // direct DOM click and note it (a churning screen is itself worth knowing).
      await target.click({ timeout: 5_000 }).catch(async () => {
        log.push(`[snap] "${arg}" never stabilised; used dispatchEvent click`);
        await target.dispatchEvent("click");
      });
    } else if (kind === "advance") {
      await advanceMonths(h.page, Number(arg));
    } else if (kind === "fill") {
      const i = arg.indexOf("=");
      await h.page.getByLabel(arg.slice(0, i)).fill(arg.slice(i + 1));
    } else {
      await h.page.keyboard.press(arg);
    }
    await h.page.waitForTimeout(Number(values.wait));
    await tidy();
  }
  if (values.eval) {
    log.push(`[eval] ${JSON.stringify(await h.page.evaluate(values.eval))}`);
  }
  await h.page.waitForTimeout(Number(values.wait) + Number(values.settle));

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
    log.push(
      `[snap] WARNING: ${structural} node add/remove/text mutations in 1s while idle — the screen may be in a render loop`,
    );
  }
  log.push(`[snap] idle mutations/s: structural=${structural} attributes=${attributes}`);

  const shot = { path: resolve(outDir, "screenshot.png") };
  if (values.selector) await h.page.locator(values.selector).first().screenshot(shot);
  else await h.page.screenshot(shot);
  await writeFile(resolve(outDir, "aria.yaml"), await h.page.locator("body").ariaSnapshot());
  await writeFile(resolve(outDir, "text.txt"), await h.page.locator("body").innerText());
  await writeFile(resolve(outDir, "console.log"), log.join("\n") + "\n");
  console.log(`captured -> ${outDir}\n  screenshot.png  aria.yaml  text.txt  console.log`);
  if (log.some((l) => l.includes("WARNING"))) console.log("  ! churn warning — see console.log");
} finally {
  await teardownHarness(h);
  if (saveScratch) await rm(saveScratch, { recursive: true, force: true }).catch(() => {});
}
