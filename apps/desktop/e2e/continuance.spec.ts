import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, copyFixturePackage, openCampaign } from "./fixtures.js";

// Continuance: Load, Recent Campaigns, Verify, Replay and Recover. Each test works on its own copy of a
// compiled package (the worker's templates), so the originals are never touched and tests are independent.

const CLOSE_MENU_LABEL = "Close campaign…";
const CLOSE_CONFIRM_LABEL = "Close campaign";

/**
 * Corrupts the package's currently-active save so `SaveStore.load`'s rawHash check fails
 * deterministically (`store.ts`'s `loadById`) -- the exact corruption-detection path Verify/Recover
 * exercise. Stays valid JSON (only a snapshot field changes) so the failure is specifically the hash
 * mismatch, not a parse error.
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

test("Load restores Overview from a package copy", async ({ e2e, campaignTemplate }) => {
  await openCampaign(e2e, campaignTemplate);
  await expect(e2e.page.getByText("Bluewave — January 1880")).toBeVisible();
  await expect(
    e2e.page.getByText("campaign-bluewave-1880-production", { exact: true }),
  ).toBeVisible();
});

test("Recent Campaigns reopens a package without prompting the file dialog", async ({
  e2e,
  campaignTemplate,
}) => {
  const pkg = await openCampaign(e2e, campaignTemplate);

  // Close the campaign and return to the main menu.
  await e2e.page.getByRole("button", { name: "Campaign menu" }).click();
  await e2e.page.getByRole("button", { name: CLOSE_MENU_LABEL }).click();
  await e2e.page.getByRole("button", { name: CLOSE_CONFIRM_LABEL, exact: true }).click();
  await expect(e2e.page.getByText("Recent Campaigns")).toBeVisible();

  // Any further native dialog would be a regression: make it fail loudly.
  await e2e.app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => {
      throw new Error("file dialog must not open for a recent campaign");
    };
  });
  await e2e.page.getByTitle(new RegExp(pkg.split("/").pop()!)).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
});

test("Verify and Replay report on a healthy package, which still opens afterwards", async ({
  e2e,
  campaignTemplate,
}) => {
  const pkg = await copyFixturePackage(campaignTemplate, e2e.scratch);
  await e2e.retargetDialog(pkg);

  await e2e.page.getByRole("button", { name: "Verify" }).click();
  await expect(e2e.page.getByText(/Package verified — campaign/)).toBeVisible();

  await e2e.page.getByRole("button", { name: "Replay" }).click();
  await expect(e2e.page.getByText(/Replay complete/)).toBeVisible();

  // The app remains operable after verification and replay: the same package still opens.
  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
});

test("Recover repairs a damaged package", async ({ e2e, advancedCampaignTemplate }) => {
  // The advanced template has a predecessor save for Recover to revert to.
  const pkg = await copyFixturePackage(advancedCampaignTemplate, e2e.scratch);
  await tamperActiveSave(pkg);
  await e2e.retargetDialog(pkg);

  await e2e.page.getByRole("button", { name: "Recover" }).click();
  await expect(e2e.page.getByText(/Recovery complete — active revision 0/)).toBeVisible();

  // The recovered package is playable: it opens cleanly to Overview.
  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
});

// Tamper -> Verify mismatch is deliberately NOT covered here.
// `verificationResultFromBridge` (renderer/screens/campaign-file/utils/package-operations.ts) maps ANY
// outcome:"success" VerifyCampaignResponse -- including `{ valid: false, issues: [...] }` -- to the
// "verify" result kind, and `OperationResultMessage`'s verify branch (OperationStatus.tsx) renders
// "Package verified - campaign ..." unconditionally, never reading `response.valid`/`issues`. So today a
// tampered package's Verify shows the SAME copy as a healthy one. Asserting today's copy would enshrine
// that gap; persistence's unit tests cover the mismatch until the renderer branch is fixed.
