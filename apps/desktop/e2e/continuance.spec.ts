import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SEED, test, expect, copyFixturePackage } from "./fixtures.js";
import { advanceMonths, dismissTour, startNewCampaign } from "./flows.js";

// Serial continuance narrative (matrix rows 7-11). Independent of
// mvp-loop.spec.ts's create-side narrative; the shipped production package
// (content/production/1880/bluewave-austria_hungary-scen_1880/) is no
// longer in the working tree (untracked at charting time -- see ticket 02's
// finding), so this file compiles its own master fixture package via the
// create-side flow and copies it fresh for every row. The shipped tree is
// never touched.
test.describe.configure({ mode: "serial" });

const ARCHETYPE = "Shipyard Baron";
const NATION = "United Kingdom";

// Turn-0-only package: Load/Verify/Replay/tamper->Verify all target a
// pristine, never-advanced production package.
let masterPackageDir = "";
// Turn-0 + turn-1 package: Recover needs a predecessor save to revert to,
// so this fixture has one committed month on top of the fresh compile.
let recoverMasterPackageDir = "";

async function compileFreshCampaign(page: import("@playwright/test").Page): Promise<void> {
  await startNewCampaign(page, { seed: SEED, archetype: ARCHETYPE, nation: NATION });
  await expect(page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Corrupts the package's currently-active save so `SaveStore.load`'s
 * rawHash check fails deterministically (`store.ts`'s `loadById`) -- the
 * exact corruption-detection path Verify/Recover exercise. Stays valid
 * JSON (only a snapshot field changes) so the failure is specifically the
 * hash mismatch, not a parse error.
 */
async function tamperActiveSave(packageDir: string): Promise<void> {
  const pointer = JSON.parse(await readFile(join(packageDir, "pointer.json"), "utf8")) as {
    activeSaveId: string;
  };
  const campaignPath = join(packageDir, pointer.activeSaveId, "campaign.json");
  const parsed = JSON.parse(await readFile(campaignPath, "utf8")) as {
    snapshot: { campaignId: string };
  };
  parsed.snapshot = {
    ...parsed.snapshot,
    campaignId: `${parsed.snapshot.campaignId}-tampered`,
  };
  await writeFile(campaignPath, JSON.stringify(parsed), "utf8");
}

test("setup: compile the master production package fixtures", async ({ e2e }) => {
  masterPackageDir = join(await mkdtemp(join(tmpdir(), "bluewave-continuance-master-")), "package");
  await e2e.retargetDialog(masterPackageDir);
  await compileFreshCampaign(e2e.page);
  await expect(e2e.page.getByText("Bluewave — January 1880")).toBeVisible();
});

test("setup: compile a two-revision package fixture for Recover", async ({ e2e }) => {
  recoverMasterPackageDir = join(
    await mkdtemp(join(tmpdir(), "bluewave-continuance-recover-")),
    "package",
  );
  await e2e.retargetDialog(recoverMasterPackageDir);
  await compileFreshCampaign(e2e.page);
  await dismissTour(e2e.page);
  await advanceMonths(e2e.page, 1);
  await expect(e2e.page.getByText("Bluewave — February 1880")).toBeVisible();
});

test("row 7: Load restores Overview from a production package copy", async ({ e2e }) => {
  const pkg = await copyFixturePackage(masterPackageDir, e2e.scratch);
  await e2e.retargetDialog(pkg);

  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(e2e.page.getByText("Bluewave — January 1880")).toBeVisible();
  await expect(
    e2e.page.getByText("campaign-bluewave-1880-production", { exact: true }),
  ).toBeVisible();
});

test("row 8: Verify reports package integrity", async ({ e2e }) => {
  const pkg = await copyFixturePackage(masterPackageDir, e2e.scratch);
  await e2e.retargetDialog(pkg);

  await e2e.page.getByRole("button", { name: "Verify" }).click();
  await expect(e2e.page.getByText(/Package verified — campaign/)).toBeVisible({
    timeout: 15_000,
  });

  // The app remains operable after verification: the same package still
  // opens to Overview.
  await e2e.retargetDialog(pkg);
  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
});

test("row 9: Replay completes deterministically", async ({ e2e }) => {
  const pkg = await copyFixturePackage(masterPackageDir, e2e.scratch);
  await e2e.retargetDialog(pkg);

  await e2e.page.getByRole("button", { name: "Replay" }).click();
  await expect(e2e.page.getByText(/Replay complete/)).toBeVisible({
    timeout: 15_000,
  });
});

test("row 10: Recover repairs a damaged package", async ({ e2e }) => {
  const pkg = await copyFixturePackage(recoverMasterPackageDir, e2e.scratch);
  await tamperActiveSave(pkg);
  await e2e.retargetDialog(pkg);

  await e2e.page.getByRole("button", { name: "Recover" }).click();
  await expect(e2e.page.getByText(/Recovery complete — active revision 0/)).toBeVisible({
    timeout: 15_000,
  });

  // Recovered package is playable: opens cleanly to Overview, no crash.
  await e2e.retargetDialog(pkg);
  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
});

// Row 11 (tamper -> Verify mismatch) is deliberately NOT covered here.
// `verificationResultFromBridge` (renderer/screens/campaign-file/utils/
// package-operations.ts) maps ANY outcome:"success" VerifyCampaignResponse
// -- including `{ valid: false, issues: [...] }` -- to the "verify" result
// kind, and `OperationResultMessage`'s verify branch (OperationStatus.tsx)
// renders "Package verified - campaign ..." unconditionally, never reading
// `response.valid`/`issues`. So today a tampered package's Verify surfaces
// the SAME "Package verified" copy as a healthy one -- a real stub-surface
// honesty gap, not a flaky-fixture problem. Asserting today's copy would
// enshrine that gap as expected behavior; per the coverage matrix's own
// allowance ("otherwise the recover row is the minimum"), row 11 stays
// covered by persistence's unit tests until that renderer branch is fixed
// (out of scope here: this effort is test-only, no source changes).
