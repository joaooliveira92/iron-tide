import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { advanceMonths, dismissTour, startNewCampaign } from "../e2e/flows.ts";
import { writeAppPreferences } from "../e2e/preferences-fixture.ts";
import { copyFixturePackage, launchHarness, teardownHarness } from "../e2e/fixtures.ts";
import { waitForQuiet } from "./snap-quiet.ts";
import { createProblemLog } from "./snap-problems.ts";
import { parseSnapArgs, SnapUsageError, type SnapAction, type SnapOptions } from "./snap-args.ts";

const CHURN_THRESHOLD = 500;
const QUIET_MS = 200;

let opts: SnapOptions;
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
const problems = createProblemLog();
const problem = (message: string, key?: string) => {
  problems.record(message, key);
  log.push(`[snap] WARNING: ${message}`);
};
h.page.on("console", (m) => {
  log.push(`[${m.type()}] ${m.text()}`);
  if (m.type() === "error") problems.record(`console error: ${m.text()}`);
});
h.page.on("pageerror", (e) => {
  log.push(`[pageerror] ${e.message}`);
  problems.record(`page error: ${e.message}`);
});

const shotOptions = opts.freeze ? ({ animations: "disabled" } as const) : {};

async function settle(extraMs = 0): Promise<void> {
  await h.page.waitForTimeout(opts.waitMs + extraMs);
  const { settled } = await h.page.evaluate(waitForQuiet, {
    quietMs: QUIET_MS,
    maxMs: opts.waitMaxMs,
  });
  if (!settled) log.push(`[snap] screen still changing after ${opts.waitMaxMs}ms (--wait-max)`);
}

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
  problem(
    `"${arg}" matched no accessible control; fell back to a visible-text match`,
    `control:${arg}`,
  );
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
      await target.click({ timeout: 5_000 }).catch(async () => {
        problem(`"${arg}" never stabilised; used dispatchEvent click`, `control:${arg}`);
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
      await h.page.screenshot({ path: resolve(outDir, `${action.name}.png`), ...shotOptions });
      log.push(`[snap] shot ${action.name}.png`);
      break;
  }
}

try {
  if (opts.theme || opts.background) {
    writeAppPreferences(h.userDataDir, {
      ...(opts.theme ? { theme: opts.theme } : {}),
      ...(opts.background ? { background: opts.background } : {}),
    });
    await h.page.reload();
    await h.page.getByText("Bluewave Naval Staff").waitFor({ timeout: 15_000 });
  }
  if (saveDir) {
    await h.page.getByRole("button", { name: "Open Campaign" }).click();
    await settle();
  }
  if (makeSave) {
    await startNewCampaign(h.page);
    await h.page
      .getByRole("heading", { name: "Campaign Overview" })
      .waitFor({ timeout: 60_000 })
      .catch(() => problem("Overview did not appear after Begin Commission"));
  }
  if (opts.freeze) await h.page.emulateMedia({ reducedMotion: "reduce" });
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
    await settle();
  }
  const tidy = async (waitMs = 0) => {
    if (opts.tour) return;
    const shown = await h.page
      .getByRole("button", { name: "End inspection" })
      .waitFor({ timeout: waitMs || 1 })
      .then(() => true)
      .catch(() => false);
    if (shown) await dismissTour(h.page);
  };
  await tidy(1500);
  for (const action of opts.actions) {
    await runAction(action).catch((e: unknown) =>
      problem(
        `${action.kind} failed: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`,
        "target" in action ? `control:${action.target}` : undefined,
      ),
    );
    await settle();
    await tidy();
  }
  if (opts.evalSource) {
    log.push(`[eval] ${JSON.stringify(await h.page.evaluate(opts.evalSource))}`);
  }
  await settle(opts.settleMs);

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

  const shot = { path: resolve(outDir, "screenshot.png"), ...shotOptions };
  if (opts.selector) await h.page.locator(opts.selector).first().screenshot(shot);
  else await h.page.screenshot(shot);
  await writeFile(resolve(outDir, "aria.yaml"), await h.page.locator("body").ariaSnapshot());
  await writeFile(resolve(outDir, "text.txt"), await h.page.locator("body").innerText());
  await writeFile(resolve(outDir, "console.log"), log.join("\n") + "\n");
  console.log(`captured -> ${outDir}\n  screenshot.png  aria.yaml  text.txt  console.log`);
  if (log.some((l) => l.includes("WARNING"))) console.log("  ! warnings — see console.log");
  const failure = problems.summary();
  if (opts.strict && failure) console.error(failure);
  process.exitCode = problems.exitCode(opts.strict);
} finally {
  await teardownHarness(h);
  if (saveScratch) await rm(saveScratch, { recursive: true, force: true }).catch(() => {});
}
