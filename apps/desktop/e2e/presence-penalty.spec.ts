import { test, expect, openCampaign } from "./fixtures.js";
import { advanceMonths, expandStatusStrip, navigateTo } from "./flows.js";

test("an idle ship left off a short station costs prestige after the opening and the status strip names why", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await advanceMonths(page, 13);

  await test.step("reachable:presence-shortfall-prestige", async () => {
    const strip = await expandStatusStrip(page);
    await strip.locator('[data-row="prestige"]').click();
    await expect(
      page.getByText(/Last change: -\d+ \(stations left without enough ships, \d{4}-\d{2}\)\./),
    ).toBeVisible();
  });
});

test("a queued sailing order that would leave a station short warns before the month ends", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await test.step("reachable:presence-queued-order-warning", async () => {
    await navigateTo(page, "Fleet");
    await page.getByRole("radio", { name: /Mediterranean Fleet/ }).click();
    await expect(page.getByTestId("fleet-presence-warning-med_malta")).toHaveCount(0);
    await page.getByRole("button", { name: "Submit movement command" }).click();
    const warning = page.getByTestId("fleet-presence-warning-med_malta");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("Malta");
    await page.getByRole("button", { name: "Cancel pending route" }).click();
    await expect(warning).toHaveCount(0);
  });
});
