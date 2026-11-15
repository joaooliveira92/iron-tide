import { test, expect, openCampaign } from "./fixtures.js";
import { navigateTo } from "./flows.js";

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
