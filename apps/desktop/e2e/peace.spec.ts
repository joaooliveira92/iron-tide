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

const selectGermany = async (page: Page) => {
  await navigateTo(page, "Diplomacy & War");
  await page
    .getByRole("navigation", { name: "Nations" })
    .getByRole("button", { name: /^German Empire, / })
    .click();
};

const submitOrder = async (page: Page, label: string) => {
  await page
    .getByRole("group", { name: "Orders" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "Command queued" })).toBeVisible();
};

const advanceDelegatingBattles = async (page: Page) => {
  const calendar = page.getByText(/^Bluewave — [A-Za-z]+ \d{4}$/).first();
  const before = await calendar.textContent();
  await page.getByRole("button", { name: /^advance month$/i }).click();
  await page.getByRole("button", { name: /^advance to /i }).click();
  const interruption = page.getByRole("alertdialog");
  const battleOffer = page.getByTestId("offer-dialog");
  for (let answered = 0; answered < 8; answered++) {
    await expect
      .poll(
        async () => (await interruption.isVisible()) || (await calendar.textContent()) !== before,
      )
      .toBe(true);
    if (!(await interruption.isVisible())) return;
    if (await battleOffer.isVisible()) await battleOffer.getByTestId("offer-delegate").click();
    else await interruption.getByRole("button", { name: "Choose" }).first().click();
    await interruption.waitFor({ state: "hidden" });
  }
  await expect(calendar).not.toHaveText(before!);
};

test("a beaten AI nation proposes peace and the player accepts the offer", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(600_000);
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const dossier = page.getByTestId("nation-dossier");
  const war = page.getByTestId("war-front");

  await selectGermany(page);
  await dossier.getByRole("button", { name: /^Declare war/ }).click();
  await submitOrder(page, "Declare war");
  await sail(page, "North Sea");
  await advanceMonths(page, 1);

  await selectGermany(page);
  await dossier.getByRole("button", { name: /^Blockade/ }).click();
  await submitOrder(page, "Submit command");
  await sail(page, "German North Sea Coast");

  await page.getByRole("button", { name: /^advance month$/i }).click();
  await page.getByRole("button", { name: /^advance to /i }).click();
  await page.getByTestId("offer-accept").click();
  await expect(page.getByTestId("player-battle")).toBeVisible();
  await page.getByTestId("battle-auto").click();
  await expect(page.getByTestId("tactical-run-state")).toHaveText("Battle over", {
    timeout: 90_000,
  });
  await page.getByTestId("battle-submit").click();
  await expect(page.getByTestId("player-battle")).toBeHidden();

  const offer = page.getByTestId("incoming-peace-offer");
  for (let month = 0; month < 12; month++) {
    await navigateTo(page, "Diplomacy & War");
    if (await offer.isVisible()) break;
    await advanceDelegatingBattles(page);
  }

  await test.step("reachable:accept-peace", async () => {
    await expect(offer).toBeVisible();
    await expect(offer).toHaveAccessibleName(/^Peace offer from German Empire\b/);
    await expect(offer).toContainText("proposes peace");
    await page.getByTestId("accept-peace-offer").click();
    await submitOrder(page, "Submit command");
    await advanceDelegatingBattles(page);
    await navigateTo(page, "Diplomacy & War");
    await expect(war).toContainText("Ended");
    await expect(offer).toHaveCount(0);
  });
});
