import { test, expect, openCampaign } from "./fixtures.js";
import { expandStatusStrip } from "./flows.js";

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
