import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { SEED, test, expect, launchHarness, teardownHarness, openCampaign } from "./fixtures.js";
import { advanceMonths, openShipbuilding, startNewCampaign } from "./flows.js";

// The create-side narrative. Only the first test compiles a campaign through the real New Game flow; the rest
// open an isolated copy of the worker's compiled template, so each is independent and parallel-safe.

const ARCHETYPE = "Shipyard Baron";
const NATION = "United Kingdom";

// The Overview screen also renders its own "Construction"/"Fleet" quick-nav buttons, so a plain
// getByRole("button", { name }) is ambiguous -- scope to the bottom bar.
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

  // Compiled -> the shell moves into the active campaign, always on Overview.
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });

  // User-visible proof of the fresh compile: January 1880 (turn 0) and the production scenario's identity.
  await expect(e2e.page.getByText("Bluewave — January 1880")).toBeVisible();
  await expect(
    e2e.page.getByText("campaign-bluewave-1880-production", { exact: true }),
  ).toBeVisible();

  // The world map is the home screen's primary panel: live, lazy-loaded and keyboard-reachable.
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

  // Fleet: the compiled United Kingdom fleets render as real state, never an error card.
  await navigateTo(page, "Fleet");
  await expect(page.getByRole("heading", { name: "Fleet", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Divisions" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Home Fleet/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit movement command" })).toBeVisible();
  await expect(page.getByText("No movement commands")).toBeVisible();

  // Diplomacy & War: the read-only battle-history command answers over the real IPC bridge; a fresh
  // campaign has fought nothing, which is shown as such (not as an error).
  await navigateTo(page, "Diplomacy & War");
  await expect(page.getByRole("heading", { name: "Diplomacy & War" })).toBeVisible();
  await expect(page.getByText("No battles fought yet")).toBeVisible();
  await expect(page.getByText(/Battle history unavailable/)).not.toBeVisible();

  // War-panel items the engine cannot supply are stated, never faked.
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
  // The production pack authors the S-5 presence section: the readout is live, not "not configured".
  await expect(section.getByTestId("fleet-presence")).toBeVisible();
  await expect(section.getByTestId("fleet-presence-not-configured")).toHaveCount(0);
  const row = section.getByTestId("fleet-station-row-gbr_dreadnought");
  await expect(row.getByText("Active fleet")).toBeVisible();

  // Keyboard-operable selection, then assign: queued, applied by the engine on the month advance.
  await row.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await section.getByRole("button", { name: "Assign to foreign station" }).click();
  await expect(section.getByTestId("fleet-station-notice")).toContainText("queued for 1 ship(s)");

  // Clearing a ship that is not (yet) on foreign station is rejected whole, with the reason in text.
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
  // The 1880 production start seeds its historical divisions, so the screen is populated.
  await expect(divisions).toHaveCount(2);

  // Free a ship pool by dissolving a seeded division, then found a new one from it.
  await organization.getByRole("button", { name: "Dissolve division" }).first().click();
  await page.getByRole("button", { name: "Dissolve", exact: true }).click();
  // Queued, not applied: the engine only acts when the month is committed.
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

  // Save a copy: the (stubbed) dialog returns a new folder; the copy is a real package.
  const copyDir = join(e2e.scratch, "the-copy");
  await e2e.retargetDialog(copyDir);
  await openCampaignMenuItem(page, /Copy game/);
  await expect(page.getByText(/Copy saved to/)).toBeVisible();

  // Close returns to the campaign file screen.
  await openCampaignMenuItem(page, "Close campaign…");
  await page.getByRole("button", { name: "Close campaign", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Campaign" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Campaign Overview" })).not.toBeVisible();

  // The copy opens like any other campaign.
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
  // The package must outlive the first app instance, so it lives outside e2e.scratch.
  const root = await mkdtemp(join(tmpdir(), "bluewave-design-"));
  const pkg = await openCampaign(e2e, campaignTemplate, root);
  const workspace = await openShipbuilding(e2e.page);

  // Inside a campaign an unnamed design reads "Needs a class name"; name it in the top command bar.
  await expect(workspace.getByText("Needs a class name")).toBeVisible();
  await workspace
    .getByRole("group", { name: "Design commands" })
    .getByRole("textbox", { name: "Class name" })
    .fill("Arethusa E2E");
  await expect(workspace.getByText("Can be submitted")).toBeVisible();
  await workspace.getByRole("button", { name: "Finish design" }).click();
  await workspace.getByRole("button", { name: "Submit design" }).click();
  // Submitting starts a design study: the queued notice says so and the button cannot send it twice.
  await expect(workspace.getByText(/Design queued\./)).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Queued" })).toBeDisabled();

  // Restart the app on the same package (ADR-0082): the queued design must have survived.
  await e2e.app.close();
  const second = await launchHarness({ saveDir: pkg });
  try {
    await second.page.getByRole("button", { name: "Open Campaign" }).click();
    await expect(second.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
      timeout: 30_000,
    });
    // A new design needs four months of design-office work before it joins the catalog
    // (balance.yaml study.baseWorkMonths; DESIGN-21/ADR-0085).
    await advanceMonths(second.page, 4);
    await navigateTo(second.page, "Construction");
    await second.page.getByRole("tab", { name: /Design Catalog/ }).click();
    await expect(second.page.getByText("Arethusa E2E").first()).toBeVisible();
  } finally {
    await teardownHarness(second);
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
