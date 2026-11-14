import { test, expect, openCampaign } from "./fixtures.js";
import { expandStatusStrip } from "./flows.js";

const MAX_MONTHS = 36;

test("a monthly event dilemma is answered and its prestige change is explained", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const calendar = page.getByText(/^Bluewave — [A-Za-z]+ \d{4}$/).first();
  const dilemma = page.getByRole("alertdialog");

  let answered = false;
  for (let month = 0; month < MAX_MONTHS && !answered; month++) {
    const before = await calendar.textContent();
    await page.getByRole("button", { name: /^advance month$/i }).click();
    await page.getByRole("button", { name: /^advance to /i }).click();
    await page.getByRole("dialog", { name: "Pre-turn review" }).waitFor({ state: "hidden" });
    await expect
      .poll(async () => (await dilemma.isVisible()) || (await calendar.textContent()) !== before)
      .toBe(true);
    if (!(await dilemma.isVisible())) continue;

    await test.step("reachable:answer-event-dilemma", async () => {
      await expect(dilemma.getByTestId("decision-hints").first()).toBeVisible();
      const moving = dilemma
        .getByRole("listitem")
        .filter({ has: page.getByTestId("decision-hints") })
        .filter({ hasText: /prestige/i });
      const choice =
        (await moving.count()) > 0 ? moving.first() : dilemma.getByRole("listitem").first();
      await choice.getByRole("button", { name: "Choose" }).click();
      await dilemma.waitFor({ state: "hidden" });
      await expect(calendar).not.toHaveText(before!);
    });
    answered = true;
  }
  expect(answered).toBe(true);

  await test.step("reachable:national-events", async () => {
    await expect(page.getByText(/Could not advance month/)).not.toBeVisible();
  });

  await test.step("reachable:prestige", async () => {
    const strip = await expandStatusStrip(page);
    const row = strip.locator('[data-row="prestige"]');
    await row.click();
    await expect(page.getByText(/Last change: [+-]\d+ \(.+, \d{4}-\d{2}\)\./)).toBeVisible();
  });
});
