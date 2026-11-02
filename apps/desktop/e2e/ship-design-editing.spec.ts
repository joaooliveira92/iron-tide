import { test, expect, openCampaign } from "./fixtures.js";
import {
  addFitting,
  chooseDesignAction,
  closeSectionDrawer,
  closeWorkspaceDialog,
  fittingRows,
  nameTheClass,
  openArmamentTab,
  readEngineeringStatus,
  startFromReference,
} from "./design-session.js";
import { openRoster, openShipbuilding, selectRosterOption } from "./flows.js";

const BATTLESHIP = "Pre-dreadnought battleship (B)";
const ARMOURED_CRUISER = "Armoured cruiser (CA)";
const TORPEDO_TUBE = /Whitehead torpedo tube, above-water/;

test("a player refits a battleship, regrets it, steps back through the history and starts over", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(180_000);
  const page = e2e.page;
  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await openCampaign(e2e, campaignTemplate);
  await startFromReference(page, BATTLESHIP);
  await nameTheClass(page, "Refit E2E");
  const original = await readEngineeringStatus(page);
  await expect(undo).toBeDisabled();

  const torpedoes = await openArmamentTab(page, "Torpedoes");
  await expect.poll(() => fittingRows(torpedoes)).toHaveLength(1);

  await test.step("strip the torpedo tube, then change your mind with undo and redo", async () => {
    await torpedoes.getByRole("button", { name: "Remove tubes" }).click();
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(0);
    const stripped = await readEngineeringStatus(page);
    expect(stripped.cost).toBeLessThan(original.cost);

    await undo.click();
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(1);
    await expect.poll(() => readEngineeringStatus(page)).toEqual(original);
    await expect(undo).toBeDisabled();

    await redo.click();
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(0);
    await expect.poll(() => readEngineeringStatus(page)).toEqual(stripped);
  });

  await test.step("fit a new tube on the quarterdeck", async () => {
    await addFitting(torpedoes, page, "quarterdeck", TORPEDO_TUBE);
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(1);
    await expect(torpedoes.getByRole("row").filter({ hasText: "quarterdeck" })).toBeVisible();
    expect((await readEngineeringStatus(page)).cost).toBeGreaterThan(0);
  });

  await test.step("jump back to the start through the edit history", async () => {
    await chooseDesignAction(page, /Edit history/);
    const history = page.getByRole("dialog", { name: "Edit history" });
    await expect(history.getByRole("listitem")).toHaveCount(3);
    await history.getByRole("button", { name: /^0\. Start:/ }).click();
    await closeWorkspaceDialog(page, "Edit history");
    await expect.poll(() => readEngineeringStatus(page)).toEqual(original);
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(1);
    await expect(redo).toBeEnabled();
  });

  await test.step("start over from the starting design, after thinking twice", async () => {
    await torpedoes.getByRole("button", { name: "Remove tubes" }).click();
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(0);

    await chooseDesignAction(page, /Reset to the starting design/);
    const confirm = page.getByRole("alertdialog", { name: "Reset to the starting design?" });
    await confirm.getByRole("button", { name: "Keep what I have" }).click();
    await expect(confirm).toBeHidden();
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(0);

    await chooseDesignAction(page, /Reset to the starting design/);
    await confirm.getByRole("button", { name: "Replace my design" }).click();
    await expect(confirm).toBeHidden();
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(1);
    await expect.poll(() => readEngineeringStatus(page)).toEqual(original);
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
  });
});

test("switching to another ship type asks first, and keeps the work if the player declines", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(120_000);
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const workspace = await startFromReference(page, BATTLESHIP);
  const typeButton = (type: string) =>
    workspace.getByRole("button", { name: new RegExp(`Current type: ${type}`) });
  await expect(typeButton("Pre-dreadnought battleship")).toBeVisible();

  const torpedoes = await openArmamentTab(page, "Torpedoes");
  await torpedoes.getByRole("button", { name: "Remove tubes" }).click();
  await expect.poll(() => fittingRows(torpedoes)).toHaveLength(0);
  const edited = await readEngineeringStatus(page);
  await closeSectionDrawer(page, "Armament");

  await selectRosterOption(await openRoster(page, await openShipbuilding(page)), ARMOURED_CRUISER);
  const confirm = page.getByRole("alertdialog", { name: "Start from a different design?" });
  await confirm.getByRole("button", { name: "Keep what I have" }).click();
  await expect(confirm).toBeHidden();
  await expect(typeButton("Pre-dreadnought battleship")).toBeVisible();
  expect(await readEngineeringStatus(page)).toEqual(edited);

  await selectRosterOption(await openRoster(page, workspace), ARMOURED_CRUISER);
  await confirm.getByRole("button", { name: "Replace my design" }).click();
  await expect(typeButton("Armoured cruiser")).toBeVisible();
  await expect.poll(() => readEngineeringStatus(page)).not.toEqual(edited);
});
