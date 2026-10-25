import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, copyFixturePackage, openCampaign } from "./fixtures.js";

const CLOSE_MENU_LABEL = "Close campaign…";
const CLOSE_CONFIRM_LABEL = "Close campaign";

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

  await e2e.page.getByRole("button", { name: "Campaign menu" }).click();
  await e2e.page.getByRole("button", { name: CLOSE_MENU_LABEL }).click();
  await e2e.page.getByRole("button", { name: CLOSE_CONFIRM_LABEL, exact: true }).click();
  await expect(e2e.page.getByText("Recent Campaigns")).toBeVisible();

  await e2e.app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => {
      throw new Error("file dialog must not open for a recent campaign");
    };
  });
  await e2e.page.getByRole("button", { name: pkg.split("/").pop()!, exact: true }).click();
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

  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
});

test("Recover repairs a damaged package", async ({ e2e, advancedCampaignTemplate }) => {
  const pkg = await copyFixturePackage(advancedCampaignTemplate, e2e.scratch);
  await tamperActiveSave(pkg);
  await e2e.retargetDialog(pkg);

  await e2e.page.getByRole("button", { name: "Recover" }).click();
  await expect(e2e.page.getByText(/Recovery complete — active revision 0/)).toBeVisible();

  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
});
