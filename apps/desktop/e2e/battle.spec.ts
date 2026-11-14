import type { Page } from "@playwright/test";
import { test, expect, openCampaign } from "./fixtures.js";
import { advanceMonths, navigateTo } from "./flows.js";

const openMap = async (page: Page) => {
  await navigateTo(page, "Map");
  const panel = page.getByTestId("map-orders-panel");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  return panel;
};

const sail = async (page: Page, destination: string) => {
  const panel = await openMap(page);
  const fleet = panel.getByRole("button", { name: /Home Fleet/ });
  if ((await fleet.getAttribute("aria-pressed")) !== "true") await fleet.click();
  await expect(fleet).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: destination }).click();
  await expect(panel.getByText(new RegExp(`Ordered: sails for ${destination}`))).toBeVisible();
};

const declareWarOnGermany = async (page: Page) => {
  await navigateTo(page, "Diplomacy & War");
  await page
    .getByRole("navigation", { name: "Nations" })
    .getByRole("button", { name: /^German Empire, / })
    .click();
  const dossier = page.getByTestId("nation-dossier");
  await dossier.getByRole("button", { name: /^Declare war/ }).click();
  await expect(page.getByText(/declaration of war cannot be cancelled/)).toBeVisible();
  await page
    .getByRole("group", { name: "Orders" })
    .getByRole("button", { name: "Declare war", exact: true })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "Command queued" })).toBeVisible();
};

test("a declared war raises a battle offer that is accepted, fought to its end and recorded", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await declareWarOnGermany(page);
  await sail(page, "North Sea");
  await advanceMonths(page, 1);
  await sail(page, "German North Sea Coast");

  await page.getByRole("button", { name: /^advance month$/i }).click();
  await page.getByRole("button", { name: /^advance to /i }).click();

  await test.step("reachable:fight-or-decline-battle", async () => {
    await expect(page.getByTestId("offer-accept")).toBeVisible();
    await expect(page.getByTestId("offer-decline")).toBeVisible();
    await page.getByTestId("offer-accept").click();
    await expect(page.getByTestId("player-battle")).toBeVisible();
  });

  await test.step("reachable:combat-fought-battle", async () => {
    const ship = page.locator('[data-testid^="tactical-ship-"][data-side="own"]').first();
    await ship.click();
    await page.getByTestId("unit-course-input").fill("045");
    await page.getByTestId("unit-speed-input").fill("10");
    await page.getByTestId("unit-apply").click();
    await page.getByTestId("battle-advance").click();
    await expect(page.getByTestId("unit-order-state")).toHaveAttribute("data-state", "accepted");

    await page.getByTestId("battle-auto").click();
    await expect(page.getByTestId("tactical-run-state")).toHaveText("Battle over", {
      timeout: 90_000,
    });
    await page.getByTestId("battle-submit").click();
    await expect(page.getByTestId("player-battle")).toBeHidden();
  });

  await test.step("the fought battle is in the battle history", async () => {
    await navigateTo(page, "Diplomacy & War");
    await page.getByRole("tab", { name: "Battles" }).click();
    await expect(page.getByText("No battles fought yet")).toHaveCount(0);
    await expect(page.getByTestId("battle-summary")).toBeVisible();
  });
});
