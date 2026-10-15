import { test as base, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { mkdtemp, mkdir, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
      // Mutate methods, never replace the module. Save dialog (compile) returns
      // `filePath`; open dialog (continuance) returns `filePaths`. Runs in the
      // Electron main process — no outer helpers in scope.
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
    // Launch or boot failed mid-way — never leak the scratch tree.
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

/**
 * Copies a compiled SaveStore package into a fresh, disposable location so a
 * continuance spec never mutates its source (the master fixture package, or
 * the shipped tree). `sourceDir` is the package to copy; `scratchRoot` is
 * typically the per-test `e2e.scratch` tree.
 */
export async function copyFixturePackage(sourceDir: string, scratchRoot: string): Promise<string> {
  const target = join(scratchRoot, "package");
  await cp(sourceDir, target, { recursive: true });
  return target;
}

type HarnessFixtures = { e2e: E2EHarness };

export const test = base.extend<HarnessFixtures>({
  // Playwright requires the object-destructuring form for a fixture's first
  // argument; this fixture has no sibling dependencies to draw on.
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
