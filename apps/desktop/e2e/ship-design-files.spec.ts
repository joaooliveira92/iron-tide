import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, openCampaign } from "./fixtures.js";
import {
  addFitting,
  closeFileDialog,
  fittingRows,
  openArmamentTab,
  openDesignFile,
  openFileDialog,
  openHullDimensions,
  openOverviewBrief,
  readEngineeringStatus,
  saveDesignFile,
  setNumber,
} from "./design-session.js";
import { classNameField, nameTheClass, startFromReference } from "./flows.js";

const BATTLESHIP = "Pre-dreadnought battleship (B)";
const CLASS_NAME = "Saved Design E2E";

test("a player tunes a battleship, saves it, keeps experimenting and goes back to the saved file", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(180_000);
  const page = e2e.page;
  const file = join(e2e.scratch, "tuned-battleship.bwdesign");
  await openCampaign(e2e, campaignTemplate);
  await startFromReference(page, BATTLESHIP);
  await nameTheClass(page, CLASS_NAME);
  const starting = await readEngineeringStatus(page);

  const hull = await openHullDimensions(page);
  await setNumber(hull, "Beam (m)", "20.50");
  await expect(hull.getByRole("textbox", { name: "Beam (m)" })).toHaveValue("20.50");
  const widened = await readEngineeringStatus(page);
  expect(widened).not.toEqual(starting);

  const torpedoes = await openArmamentTab(page, "Torpedoes");
  expect(await fittingRows(torpedoes)).toHaveLength(1);
  await torpedoes.getByRole("button", { name: "Remove tubes" }).click();
  await expect.poll(() => fittingRows(torpedoes)).toHaveLength(0);
  const tuned = await readEngineeringStatus(page);
  expect(tuned.displacement).toBeLessThan(widened.displacement);

  await saveDesignFile(e2e.app, page, file);
  await closeFileDialog(page);
  expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ className: CLASS_NAME });

  await test.step("keep experimenting after the save", async () => {
    await nameTheClass(page, "Scratch Name");
    const narrowed = await openHullDimensions(page);
    await setNumber(narrowed, "Beam (m)", "18.50");
    const warning = page.getByRole("dialog", { name: "This change breaks the design" });
    await expect(warning).toBeVisible();
    await warning.getByRole("button", { name: "Undo this choice" }).click();
    await expect(warning).toBeHidden();
    await expect(narrowed.getByRole("textbox", { name: "Beam (m)" })).toHaveValue("20.50");
    await setNumber(narrowed, "Block coefficient", "0.65");
    await expect.poll(() => readEngineeringStatus(page)).not.toEqual(tuned);
    await setNumber(await openOverviewBrief(page), "Required top speed (kn)", "17.0");
  });

  await test.step("go back to the saved file", async () => {
    await openDesignFile(page, file, { replacingEdits: true });
    const dialog = await openFileDialog(page);
    await expect(dialog.getByText("Design opened.")).toBeVisible();
    await expect(dialog.getByLabel("Last design file")).toContainText("Opened");
    await closeFileDialog(page);

    await expect(classNameField(page)).toHaveValue(CLASS_NAME);
    await expect.poll(() => readEngineeringStatus(page)).toEqual(tuned);
    const reopenedHull = await openHullDimensions(page);
    await expect(reopenedHull.getByRole("textbox", { name: "Beam (m)" })).toHaveValue("20.50");
    expect(await fittingRows(await openArmamentTab(page, "Torpedoes"))).toHaveLength(0);
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  });
});

test("a saved design is edited and saved again, and the file holds the latest save", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(180_000);
  const page = e2e.page;
  const file = join(e2e.scratch, "revised-battleship.bwdesign");
  await openCampaign(e2e, campaignTemplate);
  await startFromReference(page, BATTLESHIP);
  await nameTheClass(page, CLASS_NAME);

  const torpedoes = await openArmamentTab(page, "Torpedoes");
  await torpedoes.getByRole("button", { name: "Remove tubes" }).click();
  await expect.poll(() => fittingRows(torpedoes)).toHaveLength(0);
  const firstSave = await readEngineeringStatus(page);
  await saveDesignFile(e2e.app, page, file);
  await closeFileDialog(page);

  await setNumber(await openHullDimensions(page), "Beam (m)", "20.50");
  await expect.poll(() => readEngineeringStatus(page)).not.toEqual(firstSave);
  const secondSave = await readEngineeringStatus(page);
  await saveDesignFile(e2e.app, page, file);
  await closeFileDialog(page);

  const refit = await openArmamentTab(page, "Torpedoes");
  await addFitting(refit, page, "quarterdeck", /Whitehead torpedo tube, above-water/);
  await expect.poll(() => fittingRows(refit)).toHaveLength(1);
  await expect.poll(() => readEngineeringStatus(page)).not.toEqual(secondSave);

  await openDesignFile(page, file, { replacingEdits: true });
  await closeFileDialog(page);
  await expect.poll(() => readEngineeringStatus(page)).toEqual(secondSave);
  await expect
    .poll(async () => fittingRows(await openArmamentTab(page, "Torpedoes")))
    .toHaveLength(0);
});

test("backing out of opening a file keeps the work, and a damaged file is refused", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(120_000);
  const page = e2e.page;
  const good = join(e2e.scratch, "good.bwdesign");
  const damaged = join(e2e.scratch, "damaged.bwdesign");
  await writeFile(damaged, '{"format": "not-a-design"');
  await openCampaign(e2e, campaignTemplate);
  await startFromReference(page, BATTLESHIP);
  await nameTheClass(page, CLASS_NAME);

  await saveDesignFile(e2e.app, page, good);
  await closeFileDialog(page);
  await setNumber(await openHullDimensions(page), "Beam (m)", "21.00");
  const edited = await readEngineeringStatus(page);

  await test.step("the player changes their mind at the confirmation", async () => {
    const dialog = await openFileDialog(page);
    await dialog.getByRole("button", { name: "Open design file" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Open a design file?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Keep what I have" }).click();
    await expect(confirm).toBeHidden();
    await closeFileDialog(page);
    expect(await readEngineeringStatus(page)).toEqual(edited);
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  await test.step("a damaged file is refused and the design is untouched", async () => {
    await openDesignFile(page, damaged, { replacingEdits: true });
    const dialog = await openFileDialog(page);
    await expect(dialog.getByRole("alert").or(dialog.getByRole("status"))).toContainText(
      /Cannot open design/,
    );
    await expect(dialog.getByLabel("Last design file")).toContainText("Could not be opened");
    await closeFileDialog(page);
    expect(await readEngineeringStatus(page)).toEqual(edited);
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  });
});
