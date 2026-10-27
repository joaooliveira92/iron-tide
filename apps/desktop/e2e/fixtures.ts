import { test as base, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page, TestInfo } from "@playwright/test";
import { mkdtemp, mkdir, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { advanceMonths, dismissTour, startNewCampaign } from "./flows.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SEED = "ba44581c2f1d8e5c9753ffc80be8e6a0";

const OUT_MAIN = resolve(__dirname, "..", "out", "main", "index.js");
const LANDING_TEXT = "Bluewave Naval Staff";

const EXPECT_DEBUG_BUILD = process.env.BLUEWAVE_E2E_DEBUG_BUILD === "true";

export interface E2EHarness {
  readonly app: ElectronApplication;
  readonly page: Page;
  readonly scratch: string;
  readonly userDataDir: string;
  readonly saveDir: string;
  retargetDialog(dir: string): Promise<void>;
}

export async function launchHarness(opts: { saveDir?: string } = {}): Promise<E2EHarness> {
  if (!existsSync(OUT_MAIN)) {
    throw new Error(
      `out/main/index.js missing — run "pnpm build" (electron-vite build) in apps/desktop first`,
    );
  }
  const scratch = await mkdtemp(join(tmpdir(), "bluewave-e2e-"));
  try {
    const userDataDir = join(scratch, "userdata");
    const saveDir = opts.saveDir ?? join(scratch, "save");
    await mkdir(saveDir, { recursive: true });

    const app = await electron.launch({
      args: [OUT_MAIN, `--user-data-dir=${userDataDir}`],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
      timeout: 60_000,
    });

    await app.evaluate(({ dialog }, dir) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: dir });
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [dir],
      });
    }, saveDir);

    const window = await app.waitForEvent("window", {
      predicate: (win) => !win.url().startsWith("devtools://"),
    });
    await window.waitForLoadState("load");
    await window.getByText(LANDING_TEXT).waitFor({ timeout: 15_000 });
    await assertBuildMode(window);

    return {
      app,
      page: window,
      scratch,
      userDataDir,
      saveDir,
      retargetDialog: (dir) =>
        app.evaluate(({ dialog }, d) => {
          dialog.showSaveDialog = async () => ({
            canceled: false,
            filePath: d,
          });
          dialog.showOpenDialog = async () => ({
            canceled: false,
            filePaths: [d],
          });
        }, dir),
    };
  } catch (error) {
    await rm(scratch, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function assertBuildMode(page: Page): Promise<void> {
  const reason = await page.evaluate(async () => {
    const bridge = Reflect.get(window, "bluewave") as {
      campaign: { execute(command: string, payload: unknown): Promise<{ reason?: string }> };
    };
    return (await bridge.campaign.execute("generateBattle", { sessionId: "x", warId: "w" })).reason;
  });
  const isDebugBuild = reason !== "DEBUG_ONLY";
  if (isDebugBuild !== EXPECT_DEBUG_BUILD) {
    throw new Error(
      `out/ holds a ${isDebugBuild ? "debug" : "release"} build but this run expects a ${
        EXPECT_DEBUG_BUILD ? "debug" : "release"
      } build — run "pnpm --filter @bluewave/desktop ${
        EXPECT_DEBUG_BUILD ? "build:debug" : "build"
      }"`,
    );
  }
}

export async function captureEvidence(h: E2EHarness, testInfo: TestInfo): Promise<void> {
  const failed = testInfo.status !== testInfo.expectedStatus || testInfo.retry > 0;
  const tracePath = testInfo.outputPath(`trace-${testInfo.retry}.zip`);
  if (failed) {
    await h.page
      .screenshot({ path: testInfo.outputPath("failure.png") })
      .then(() => testInfo.attach("failure", { path: testInfo.outputPath("failure.png") }))
      .catch(() => {});
    await h.app
      .context()
      .tracing.stop({ path: tracePath })
      .then(() => testInfo.attach("trace", { path: tracePath }))
      .catch(() => {});
    return;
  }
  await h.app
    .context()
    .tracing.stop()
    .catch(() => {});
}

export async function teardownHarness(h: E2EHarness): Promise<void> {
  try {
    await h.app.close().catch(() => {});
  } finally {
    await rm(h.scratch, { recursive: true, force: true }).catch(() => {});
  }
}

export async function copyFixturePackage(sourceDir: string, scratchRoot: string): Promise<string> {
  const target = join(scratchRoot, "package");
  await cp(sourceDir, target, { recursive: true });
  return target;
}

export async function expectOverview(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
}

export async function relaunchAndOpen(saveDir: string): Promise<E2EHarness> {
  const harness = await launchHarness({ saveDir });
  try {
    await harness.page.getByRole("button", { name: "Open Campaign" }).click();
    await expectOverview(harness.page);
    return harness;
  } catch (error) {
    await teardownHarness(harness);
    throw error;
  }
}

export async function openCampaign(
  e2e: Pick<E2EHarness, "page" | "scratch" | "retargetDialog">,
  template: string,
  scratchRoot: string = e2e.scratch,
): Promise<string> {
  const pkg = await copyFixturePackage(template, scratchRoot);
  await e2e.retargetDialog(pkg);
  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expectOverview(e2e.page);
  return pkg;
}

type HarnessFixtures = { e2e: E2EHarness };

type WorkerFixtures = {
  campaignTemplate: string;
  advancedCampaignTemplate: string;
};

async function compileTemplate(months: number): Promise<{ dir: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "bluewave-template-"));
  const dir = join(root, "package");
  const harness = await launchHarness({ saveDir: dir });
  try {
    await startNewCampaign(harness.page, { seed: SEED });
    await expectOverview(harness.page);
    await dismissTour(harness.page);
    if (months > 0) await advanceMonths(harness.page, months);
  } finally {
    await teardownHarness(harness);
  }
  return { dir, root };
}

export const test = base.extend<HarnessFixtures, WorkerFixtures>({
  campaignTemplate: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const { dir, root } = await compileTemplate(0);
      await use(dir);
      await rm(root, { recursive: true, force: true }).catch(() => {});
    },
    { scope: "worker" },
  ],
  advancedCampaignTemplate: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const { dir, root } = await compileTemplate(1);
      await use(dir);
      await rm(root, { recursive: true, force: true }).catch(() => {});
    },
    { scope: "worker" },
  ],
  // eslint-disable-next-line no-empty-pattern
  e2e: async ({}, use, testInfo) => {
    const harness = await launchHarness();
    await harness.app.context().tracing.start({ snapshots: true });
    const pageErrors: string[] = [];
    harness.page.on("pageerror", (error) => pageErrors.push(String(error)));
    try {
      await use(harness);
      expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    } finally {
      await captureEvidence(harness, testInfo);
      await teardownHarness(harness);
    }
  },
});

export { expect };
