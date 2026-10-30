import { test, expect, openCampaign } from "./fixtures.js";
import {
  advanceMonths,
  navigateTo,
  openRoster,
  openShipbuilding,
  selectRosterOption,
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

  const workspace = await openShipbuilding(page);
  await selectRosterOption(await openRoster(page, workspace), CORVETTE);
  const replace = page.getByRole("button", { name: "Replace my design" });
  const className = workspace
    .getByRole("group", { name: "Design commands" })
    .getByRole("textbox", { name: "Class name" });
  await replace.or(className).first().waitFor();
  if (await replace.isVisible()) await replace.click();
  await className.fill(CLASS_NAME);
  await expect(workspace.getByText("Can be submitted")).toBeVisible();
  await workspace.getByRole("button", { name: "Finish design" }).click();
  await workspace.getByRole("button", { name: "Submit design" }).click();
  await expect(workspace.getByText(new RegExp(`Design queued\\. .*"${CLASS_NAME}"`))).toBeVisible();
  await workspace.getByRole("button", { name: "Close", exact: true }).click();

  await advanceMonths(page, 4);
  await navigateTo(page, "Construction");
  await page
    .getByRole("navigation", { name: "Yard" })
    .getByRole("button", { name: /^Design catalog/ })
    .click();
  await page.getByRole("radio", { name: new RegExp(CLASS_NAME) }).click();
  await page.getByRole("button", { name: "Submit Construction Command" }).click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText(/Command \S+ is submitted/)).toBeVisible();
  await advanceMonths(page, 4);

  await test.step("reachable:start-rebuild", async () => {
    const rebuildWorkspace = await openShipbuilding(page);
    await rebuildWorkspace.getByRole("button", { name: /^Review/ }).click();
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
    await rebuildWorkspace.getByRole("button", { name: "Close", exact: true }).click();

    await advanceMonths(page, 1);
    const reopened = await openShipbuilding(page);
    await reopened.getByRole("button", { name: /^Review/ }).click();
    await page.getByRole("tab", { name: "Rebuild" }).click();
    await expect(reopened.getByText("None of your ships can be rebuilt yet.")).toBeVisible();
  });
});
