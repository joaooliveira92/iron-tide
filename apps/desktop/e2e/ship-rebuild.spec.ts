import { test, expect, openCampaign } from "./fixtures.js";
import {
  advanceMonths,
  openDesignSection,
  openShipbuilding,
  orderDesignFromCatalog,
  submitReferenceDesign,
} from "./flows.js";

const CLASS_NAME = "Rebuild E2E";
const CORVETTE = "Corvette / colonial gunboat (KE)";

test("a completed player-designed ship is rebuilt and leaves service after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(240_000);
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await submitReferenceDesign(page, CORVETTE, CLASS_NAME);

  await advanceMonths(page, 4);
  await orderDesignFromCatalog(page, CLASS_NAME);
  await advanceMonths(page, 4);

  await test.step("reachable:start-rebuild", async () => {
    const rebuildWorkspace = await openShipbuilding(page);
    await openDesignSection(page, "Review");
    await page.getByRole("tab", { name: "Rebuild" }).click();
    const panel = rebuildWorkspace.getByRole("region", { name: "Rebuild a ship" });
    await expect(panel.getByRole("combobox", { name: "Ship to rebuild" })).toContainText(
      CLASS_NAME,
    );

    await panel.getByRole("button", { name: "Load this ship's design to rebuild it" }).click();
    const replaceMine = page.getByRole("button", { name: "Replace my design" });
    if (await replaceMine.isVisible()) await replaceMine.click();
    await expect(panel.getByText("Rebuild not allowed")).toBeVisible();
    await expect(panel.getByText(/The design is the same as the ship's/)).toBeVisible();
    await expect(panel.getByRole("button", { name: "Start the rebuild" })).toBeDisabled();

    await panel.getByRole("combobox", { name: "Rebuild action" }).selectOption("BULGE");
    const blister = panel.getByRole("textbox", { name: /Blister mass/ });
    await blister.fill("30000");
    await blister.press("Enter");
    await expect(panel.getByText("Rebuild allowed")).toBeVisible();
    await expect(panel.getByLabel("Bulge projection")).toContainText("Torpedo protection");

    await panel.getByRole("button", { name: "Start the rebuild" }).click();
    await page.getByRole("button", { name: "Queue the rebuild" }).click();
    await expect(
      panel.getByRole("alert").filter({ hasText: /Rebuild of .* queued/ }),
    ).toBeVisible();

    await advanceMonths(page, 1);
    const reopened = await openShipbuilding(page);
    await openDesignSection(page, "Review");
    await page.getByRole("tab", { name: "Rebuild" }).click();
    await expect(reopened.getByText("None of your ships can be rebuilt yet.")).toBeVisible();
  });
});
