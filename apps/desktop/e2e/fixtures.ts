import { test as base, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
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

export async function openCampaign(
  e2e: Pick<E2EHarness, "page" | "scratch" | "retargetDialog">,
  template: string,
  scratchRoot: string = e2e.scratch,
): Promise<string> {
  const pkg = await copyFixturePackage(template, scratchRoot);
  await e2e.retargetDialog(pkg);
  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
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
    await expect(harness.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
      timeout: 30_000,
    });
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
  e2e: async ({}, use) => {
    const harness = await launchHarness();
    try {
      await use(harness);
    } finally {
      await teardownHarness(harness);
    }
  },
});

export { expect };
