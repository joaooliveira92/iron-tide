import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  SEED,
  test,
  expect,
  expectOverview,
  relaunchAndOpen,
  teardownHarness,
  openCampaign,
} from "./fixtures.js";
import {
  advanceMonths,
  expandStatusStrip,
  navigateTo,
  openFleetDepartment,
  openShipbuilding,
  startNewCampaign,
} from "./flows.js";

const ARCHETYPE = "Shipyard Baron";
const NATION = "United Kingdom";

async function openCampaignMenuItem(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name: "Campaign menu" }).click();
  await page.getByRole("button", { name }).click();
}

test("New Game compiles a fresh campaign onto Overview", async ({ e2e }) => {
  const page = e2e.page;

  await test.step("reachable:start-new-game", async () => {
    await test.step("reachable:read-opening-briefing", async () => {
      await startNewCampaign(page, {
        seed: SEED,
        archetype: ARCHETYPE,
        nation: NATION,
        onBriefingPage: async (pageIndex) => {
          await expect(
            page.getByRole("heading", { name: "Opening Strategic Briefing", level: 1 }),
          ).toBeVisible();
          if (pageIndex === 0) {
            await expect(page.getByText("Appointment confirmed · January 1880")).toBeVisible();
            await expect(
              page.getByRole("heading", { name: /^You have been appointed .* — United Kingdom$/ }),
            ).toBeVisible();
          } else if (pageIndex === 1) {
            await expect(page.getByText("Ship-class inventory")).toBeVisible();
            await expect(page.getByText("Ships under construction")).toBeVisible();
            await expect(page.getByText("Largest available dock")).toBeVisible();
            await expect(page.getByText(/^Dreadnought \(1875\)/)).toBeVisible();
          } else if (pageIndex === 2) {
            await expect(page.getByText("Government allocation")).toBeVisible();
            await expect(page.getByText("Projected surplus / deficit")).toBeVisible();
            await expect(page.getByText("Treasury outlook")).toBeVisible();
            await expect(page.getByText("100 NC", { exact: true })).toBeVisible();
          } else if (pageIndex === 3) {
            const world = page.getByRole("region", { name: "World Situation Briefing" });
            await expect(
              world.getByRole("heading", { name: "Strategic assessment" }),
            ).toBeVisible();
            await expect(world.getByText("United Kingdom")).toBeVisible();
            await expect(
              page.getByRole("navigation", { name: "Foreign powers" }).getByRole("button").first(),
            ).toBeVisible();
          } else {
            await expect(page.getByText("No pressing concerns to report.")).toBeHidden();
            await expect(page.getByText(/Authorizing a new battleship class/)).toBeVisible();
          }
        },
      });
    });

    await test.step("reachable:read-campaign-overview", async () => {
      await expectOverview(page);
      await expect(
        page.getByRole("heading", { name: "Campaign Overview, January 1880" }),
      ).toBeVisible();
      const strip = await expandStatusStrip(page);
      await expect(strip.getByRole("group", { name: "Nation" })).toContainText(NATION);
      await expect(strip.getByRole("button", { name: /^Treasury: [\d,]+ NC$/ })).toBeVisible();
      await expect(
        page
          .getByRole("group", { name: "Immediate priorities" })
          .getByRole("button", { name: /^(Critical|Warning|Advisory|Information): .+\. Go to / })
          .first(),
      ).toBeVisible();
    });

    await expect(page.getByText("Bluewave — January 1880")).toBeVisible();
    await expect(
      page.getByText("campaign-bluewave-1880-production", { exact: true }),
    ).toBeVisible();

    await expect(page.getByTestId("globe-adapter")).toBeVisible({
      timeout: 60_000,
    });
  });
});

test("Advance Month moves the calendar into the following month", async ({
  e2e,
  campaignTemplate,
}) => {
  await openCampaign(e2e, campaignTemplate);
  await expect(e2e.page.getByText("Bluewave — January 1880")).toBeVisible();

  await test.step("reachable:advance-month", async () => {
    await advanceMonths(e2e.page, 1);

    await expect(e2e.page.getByText("Bluewave — February 1880")).toBeVisible();
    await expect(e2e.page.getByText("Month advanced to February 1880.")).toBeVisible();
    await expect(e2e.page.getByText(/Could not advance month/)).not.toBeVisible();
  });
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
  await openFleetDepartment(page, "Orders");
  await expect(page.getByText("No orders submitted this month.")).toBeVisible();

  await navigateTo(page, "Diplomacy & War");
  await expect(page.getByRole("heading", { name: "Diplomacy & War" })).toBeVisible();
  await test.step("reachable:read-battle-history", async () => {
    const battles = page.getByRole("tab", { name: "Battles" });
    await battles.click();
    await expect(battles).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("No battles fought yet")).toBeVisible();
    await expect(page.getByText(/Battle history unavailable/)).not.toBeVisible();
    await expect(page.getByTestId("battle-summary")).toHaveCount(0);
  });

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
  await test.step("reachable:assign-station", async () => {
    await navigateTo(page, "Fleet");
    await openFleetDepartment(page, "Station");

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
    await openFleetDepartment(page, "Station");
    await expect(
      page.getByTestId("fleet-station-row-gbr_dreadnought").getByText("On foreign station"),
    ).toBeVisible();
  });
});

test("a ship is placed in reserve through the readiness command", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await test.step("reachable:ship-readiness", async () => {
    await test.step("reachable:set-ship-readiness", async () => {
      await navigateTo(page, "Fleet");
      await openFleetDepartment(page, "Station");

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
      await openFleetDepartment(page, "Station");
      await expect(
        page.getByTestId("fleet-station-row-gbr_dreadnought").getByText("Reserve fleet"),
      ).toBeVisible();
    });
  });
});

test("a fleet ordered to sail moves one hop when the month advances", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await test.step("reachable:move-fleet", async () => {
    await navigateTo(page, "Fleet");
    await page.getByRole("radio", { name: /Home Fleet/ }).click();
    await page.getByRole("button", { name: "Submit movement command" }).click();
    await expect(page.getByText("Order queued")).toBeVisible();
    await openFleetDepartment(page, "Orders");
    await expect(page.getByRole("row", { name: /Home Fleet.*submitted/ })).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Fleet");
    await expect(page.getByRole("radio", { name: /Home Fleet.*English Channel/ })).toBeVisible();
    await openFleetDepartment(page, "Orders");
    await expect(page.getByText("No orders submitted this month.")).toBeVisible();
  });
});

test("Fleet organization founds a division through the real engine and applies it next month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await test.step("reachable:organise-divisions", async () => {
    await navigateTo(page, "Fleet");
    await openFleetDepartment(page, "Organization");
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
    await openFleetDepartment(page, "Organization");
    await expect(divisions).toHaveCount(1);

    await organization.getByRole("button", { name: "Create division" }).click();
    await expect(organization.getByText(/Create division queued/)).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Fleet");
    await openFleetDepartment(page, "Organization");
    await expect(divisions).toHaveCount(2);
    await expect(organization.getByText("Commander vacant")).toBeVisible();
    await expect(organization.getByText("No divisions yet")).not.toBeVisible();
  });
});

test("the Campaign menu can save, copy, and close the campaign", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await test.step("reachable:manage-campaign-files", async () => {
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
    await expectOverview(page);
  });
});

test("a submitted design survives a restart and joins the catalog after its study", async ({
  e2e,
  campaignTemplate,
}) => {
  const root = await mkdtemp(join(tmpdir(), "bluewave-design-"));
  const pkg = await openCampaign(e2e, campaignTemplate, root);

  await test.step("reachable:submit-design", async () => {
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
  });

  await e2e.app.close();
  const second = await relaunchAndOpen(pkg);
  try {
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
