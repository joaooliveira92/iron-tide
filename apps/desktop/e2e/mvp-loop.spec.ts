import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { SEED, test, expect, launchHarness, teardownHarness, openCampaign } from "./fixtures.js";
import { advanceMonths, openShipbuilding, startNewCampaign } from "./flows.js";

const ARCHETYPE = "Shipyard Baron";
const NATION = "United Kingdom";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

async function openCampaignMenuItem(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name: "Campaign menu" }).click();
  await page.getByRole("button", { name }).click();
}

test("New Game compiles a fresh campaign onto Overview", async ({ e2e }) => {
  await startNewCampaign(e2e.page, {
    seed: SEED,
    archetype: ARCHETYPE,
    nation: NATION,
  });

  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });

  await expect(e2e.page.getByText("Bluewave — January 1880")).toBeVisible();
  await expect(
    e2e.page.getByText("campaign-bluewave-1880-production", { exact: true }),
  ).toBeVisible();

  await expect(e2e.page.getByRole("application", { name: /World map/ })).toBeVisible({
    timeout: 15_000,
  });
});

test("Advance Month moves the calendar into the following month", async ({
  e2e,
  campaignTemplate,
}) => {
  await openCampaign(e2e, campaignTemplate);
  await expect(e2e.page.getByText("Bluewave — January 1880")).toBeVisible();

  await advanceMonths(e2e.page, 1);

  await expect(e2e.page.getByText("Bluewave — February 1880")).toBeVisible();
  await expect(e2e.page.getByText("Month advanced to February 1880.")).toBeVisible();
  await expect(e2e.page.getByText(/Could not advance month/)).not.toBeVisible();
});

test("Fleet and Diplomacy & War render the honest compiled state", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await navigateTo(page, "Fleet");
  await expect(page.getByRole("heading", { name: "Fleet", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Divisions" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Home Fleet/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit movement command" })).toBeVisible();
  await expect(page.getByText("No movement commands")).toBeVisible();

  await navigateTo(page, "Diplomacy & War");
  await expect(page.getByRole("heading", { name: "Diplomacy & War" })).toBeVisible();
  await page.getByRole("tab", { name: "Battles" }).click();
  await expect(page.getByText("No battles fought yet")).toBeVisible();
  await expect(page.getByText(/Battle history unavailable/)).not.toBeVisible();

  await page.getByRole("tab", { name: "Not modelled" }).click();
  await expect(page.getByText("Not yet modelled by the engine", { exact: true })).toBeVisible();
  await expect(page.getByText(/Trade protection/)).toBeVisible();
});

test("a ship is assigned to and cleared from foreign station, and the presence readout is live", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Fleet");

  const section = page.getByTestId("fleet-station");
  await expect(
    section.getByRole("heading", { name: "Ships and foreign-station status" }),
  ).toBeVisible();
  await expect(section.getByTestId("fleet-presence")).toBeVisible();
  await expect(section.getByTestId("fleet-presence-not-configured")).toHaveCount(0);
  const row = section.getByTestId("fleet-station-row-gbr_dreadnought");
  await expect(row.getByText("Active fleet")).toBeVisible();

  await row.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await section.getByRole("button", { name: "Assign to foreign station" }).click();
  await expect(section.getByTestId("fleet-station-notice")).toContainText("queued for 1 ship(s)");

  await row.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await section.getByRole("button", { name: "Clear foreign station" }).click();
  await expect(section.getByTestId("fleet-station-notice")).toContainText(
    "HMS Dreadnought is not on foreign station.",
  );

  await advanceMonths(page, 1);
  await navigateTo(page, "Fleet");
  await expect(
    page.getByTestId("fleet-station-row-gbr_dreadnought").getByText("On foreign station"),
  ).toBeVisible();
});

test("a ship is placed in reserve through the readiness command", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Fleet");

  const section = page.getByTestId("fleet-station");
  const row = section.getByTestId("fleet-station-row-gbr_dreadnought");
  await row.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await section.getByRole("button", { name: "Place in reserve" }).click();
  await expect(section.getByTestId("fleet-station-notice")).toContainText(
    "Readiness change to reserve queued for 1 ship(s)",
  );

  await advanceMonths(page, 1);
  await navigateTo(page, "Fleet");
  await expect(
    page.getByTestId("fleet-station-row-gbr_dreadnought").getByText("Reserve fleet"),
  ).toBeVisible();
});

test("a fleet ordered to sail moves one hop when the month advances", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await navigateTo(page, "Fleet");
  await page.getByRole("radio", { name: /Home Fleet/ }).click();
  await page.getByRole("button", { name: "Submit movement command" }).click();
  await expect(page.getByText("Order queued")).toBeVisible();
  await expect(page.getByRole("row", { name: /Home Fleet.*submitted/ })).toBeVisible();

  await advanceMonths(page, 1);
  await navigateTo(page, "Fleet");
  await expect(page.getByRole("radio", { name: /Home Fleet.*English Channel/ })).toBeVisible();
  await expect(page.getByText("No movement commands")).toBeVisible();
});

test("Fleet organization founds a division through the real engine and applies it next month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await navigateTo(page, "Fleet");
  const organization = page.getByTestId("fleet-organization");
  const divisions = organization.getByRole("heading", {
    name: /division — HMS /,
  });
  await expect(divisions).toHaveCount(2);

  await organization.getByRole("button", { name: "Dissolve division" }).first().click();
  await page.getByRole("button", { name: "Dissolve", exact: true }).click();
  await expect(organization.getByText(/Dissolve division queued/)).toBeVisible();
  await expect(divisions).toHaveCount(2);

  await advanceMonths(page, 1);
  await navigateTo(page, "Fleet");
  await expect(divisions).toHaveCount(1);

  await organization.getByRole("button", { name: "Create division" }).click();
  await expect(organization.getByText(/Create division queued/)).toBeVisible();

  await advanceMonths(page, 1);
  await navigateTo(page, "Fleet");
  await expect(divisions).toHaveCount(2);
  await expect(organization.getByText("Commander vacant")).toBeVisible();
  await expect(organization.getByText("No divisions yet")).not.toBeVisible();
});

test("the Campaign menu can save, copy, and close the campaign", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await openCampaignMenuItem(page, "Save");
  await expect(page.getByText(/Campaign saved — revision \d+/)).toBeVisible();
  await expect(page.getByText(/NOT_IMPLEMENTED/)).not.toBeVisible();

  const copyDir = join(e2e.scratch, "the-copy");
  await e2e.retargetDialog(copyDir);
  await openCampaignMenuItem(page, /Copy game/);
  await expect(page.getByText(/Copy saved to/)).toBeVisible();

  await openCampaignMenuItem(page, "Close campaign…");
  await page.getByRole("button", { name: "Close campaign", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Campaign" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Campaign Overview" })).not.toBeVisible();

  await e2e.retargetDialog(copyDir);
  await page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
});

test("a submitted design survives a restart and joins the catalog after its study", async ({
  e2e,
  campaignTemplate,
}) => {
  const root = await mkdtemp(join(tmpdir(), "bluewave-design-"));
  const pkg = await openCampaign(e2e, campaignTemplate, root);
  const workspace = await openShipbuilding(e2e.page);

  await expect(workspace.getByText("Needs a class name")).toBeVisible();
  await workspace
    .getByRole("group", { name: "Design commands" })
    .getByRole("textbox", { name: "Class name" })
    .fill("Arethusa E2E");
  await expect(workspace.getByText("Can be submitted")).toBeVisible();
  await workspace.getByRole("button", { name: "Finish design" }).click();
  await workspace.getByRole("button", { name: "Submit design" }).click();
  await expect(workspace.getByText(/Design queued\./)).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Queued" })).toBeDisabled();

  await e2e.app.close();
  const second = await launchHarness({ saveDir: pkg });
  try {
    await second.page.getByRole("button", { name: "Open Campaign" }).click();
    await expect(second.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
      timeout: 30_000,
    });
    await advanceMonths(second.page, 4);
    await navigateTo(second.page, "Construction");
    await second.page
      .getByRole("navigation", { name: "Yard" })
      .getByRole("button", { name: /^Design catalog/ })
      .click();
    await expect(second.page.getByText("Arethusa E2E").first()).toBeVisible();
  } finally {
    await teardownHarness(second);
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
