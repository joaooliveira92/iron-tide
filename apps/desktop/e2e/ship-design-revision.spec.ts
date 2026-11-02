import { test, expect, openCampaign } from "./fixtures.js";
import {
  advanceMonths,
  navigateTo,
  openDesignSection,
  orderDesignFromCatalog,
  submitReferenceDesign,
} from "./flows.js";
import { openHullDimensions, readEngineeringStatus, setNumber } from "./design-session.js";

const CLASS_NAME = "Revision E2E";
const CORVETTE = "Corvette / colonial gunboat (KE)";

test("a player reopens the design of a ship under construction, changes it and queues the revision", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(300_000);
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await submitReferenceDesign(page, CORVETTE, CLASS_NAME);
  await advanceMonths(page, 4);
  await orderDesignFromCatalog(page, CLASS_NAME);
  await advanceMonths(page, 1);

  await navigateTo(page, "Construction");
  await page
    .getByRole("navigation", { name: "Yard" })
    .getByRole("button", { name: /^Slipways/ })
    .click();
  await page.getByRole("button", { name: new RegExp(`^${CLASS_NAME}, `) }).click();
  await page.getByRole("button", { name: `${CLASS_NAME} revise` }).click();
  await page.getByTestId("shipbuilding-workspace").waitFor();
  const finish = await openDesignSection(page, "Review");
  await finish.getByRole("tab", { name: "Finish" }).click();
  const revision = finish.getByRole("region", { name: "Revision preview" });
  await expect(revision).toContainText(CLASS_NAME);
  await revision.getByRole("button", { name: /Load this ship's design into the board/ }).click();
  const replace = page.getByRole("button", { name: "Replace my design" });
  if (await replace.isVisible()) await replace.click();

  const loaded = await readEngineeringStatus(page);
  await page.getByRole("button", { name: "Close Review" }).click();
  const hull = await openHullDimensions(page);
  const beam = hull.getByRole("textbox", { name: "Beam (m)" });
  const current = Number(await beam.inputValue());
  await setNumber(hull, "Beam (m)", (current + 0.2).toFixed(2));
  await expect.poll(() => readEngineeringStatus(page)).not.toEqual(loaded);
  await page.getByRole("button", { name: "Close Hull" }).click();

  const again = await openDesignSection(page, "Review");
  await again.getByRole("tab", { name: "Finish" }).click();
  const preview = again.getByRole("region", { name: "Revision preview" });
  await expect(preview.getByRole("status")).toBeVisible();
  await preview.getByRole("button", { name: "Apply revision to this ship" }).click();
  await page.getByRole("button", { name: "Queue the revision" }).click();
  await expect(preview.getByText(/Revision queued/)).toBeVisible();
});
