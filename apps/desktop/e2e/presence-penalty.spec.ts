import { test, expect, openCampaign } from "./fixtures.js";
import { expandStatusStrip, navigateTo } from "./flows.js";

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

test("a station left short of ships costs prestige and the status strip names why", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const calendar = page.getByText(/^Bluewave — [A-Za-z]+ \d{4}$/).first();
  const before = await calendar.textContent();
  await page.getByRole("button", { name: /^advance month$/i }).click();
  await page.getByRole("button", { name: /^advance to /i }).click();
  await page.getByRole("dialog", { name: "Pre-turn review" }).waitFor({ state: "hidden" });
  await expect.poll(async () => await calendar.textContent()).not.toBe(before);

  await test.step("reachable:presence-shortfall-prestige", async () => {
    const strip = await expandStatusStrip(page);
    await strip.locator('[data-row="prestige"]').click();
    await expect(
      page.getByText(/Last change: -\d+ \(stations left without enough ships, \d{4}-\d{2}\)\./),
    ).toBeVisible();
  });
});
