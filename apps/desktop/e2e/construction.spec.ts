import type { Page } from "@playwright/test";
import { test, expect, openCampaign } from "./fixtures.js";
import {
  advanceMonths,
  navigateTo,
  openDesignSection,
  orderDesignFromCatalog,
  submitReferenceDesign,
} from "./flows.js";

const REVISED_CLASS = "Revise E2E";
const CORVETTE = "Corvette / colonial gunboat (KE)";

const openYardPlace = (page: Page, name: RegExp) =>
  page.getByRole("navigation", { name: "Yard" }).getByRole("button", { name }).click();

const shipsUnderConstruction = (page: Page) =>
  page.getByRole("list", { name: "Ships under construction" }).locator("> li");

test("a player can order a class batch and it appears after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Construction");

  await test.step("reachable:order-construction", async () => {
    const ships = shipsUnderConstruction(page);
    await expect(ships.first()).toBeVisible();
    const before = await ships.count();

    await openYardPlace(page, /^Design catalog/);
    await page.getByRole("button", { name: "Order a class batch (1–12)" }).click();

    await expect(page.getByRole("combobox", { name: "Batch design" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Previewed ship names" })).toBeVisible();
    await page.getByRole("spinbutton", { name: "Batch quantity" }).fill("1");
    await expect(page.getByTestId("batch-confirm")).toBeEnabled();
    await page.getByTestId("batch-confirm").click();

    await openYardPlace(page, /^Slipways/);
    await expect(
      page.getByRole("status").filter({ hasText: "OrderConstruction queued" }),
    ).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Construction");
    await expect(ships).toHaveCount(before + 1);
  });
});

test("a player can order from a foreign yard and it appears after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Construction");

  await test.step("reachable:order-foreign-construction", async () => {
    const ships = shipsUnderConstruction(page);
    await expect(ships.first()).toBeVisible();
    const before = await ships.count();

    await openYardPlace(page, /^Design catalog/);
    await page.getByRole("button", { name: "Order a class batch (1–12)" }).click();

    const builder = page.getByRole("combobox", { name: "Builder" });
    await expect(builder).toBeVisible();
    await builder.selectOption("france");

    await expect(page.getByTestId("foreign-contract-panel")).toBeVisible();
    await expect(page.getByTestId("foreign-total-price")).toBeVisible();
    await expect(page.getByTestId("foreign-impoundment-risk")).toBeVisible();

    await page.getByRole("spinbutton", { name: "Batch quantity" }).fill("1");
    const confirm = page.getByRole("button", { name: "Order from foreign yard" });
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await openYardPlace(page, /^Slipways/);
    await expect(
      page.getByRole("status").filter({ hasText: "OrderForeignConstruction queued" }),
    ).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Construction");
    await expect(ships).toHaveCount(before + 1);
  });
});

test("a player can halt a building hull and it stays halted after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Construction");

  await test.step("reachable:halt-or-resume-construction", async () => {
    await page.getByRole("button", { name: /^Inflexible, / }).click();
    const halt = page.getByRole("button", { name: "Inflexible halt" });
    await expect(halt).toBeVisible();
    await halt.click();
    await expect(
      page.getByRole("status").filter({ hasText: "HaltConstruction queued" }),
    ).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Construction");

    await expect(
      shipsUnderConstruction(page).filter({ hasText: "Inflexible" }).getByText("halted", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Inflexible, / }).click();
    await expect(page.getByRole("button", { name: "Inflexible resume" })).toBeVisible();
  });
});

test("a construction command can be submitted, replaced atomically, then cancelled", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Construction");
  await test.step("reachable:order-construction", async () => {
    await expect(page.getByRole("heading", { name: "Construction Commands" })).toBeVisible();

    await openYardPlace(page, /^Design catalog/);
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { name: "Submit Construction Command" }).click();
    await page.getByRole("button", { name: "Confirm order" }).click();
    await expect(page.getByText(/Command \S+ is submitted/)).toBeVisible();

    await openYardPlace(page, /^Orders/);
    const submittedRow = page.getByRole("row").filter({ hasText: "submitted" });
    await expect(submittedRow).toBeVisible();

    await submittedRow.getByRole("button", { name: "Replace" }).click();
    await expect(page.getByRole("row").filter({ hasText: "superseded" })).toBeVisible();
    await expect(submittedRow).toHaveCount(1);

    await submittedRow.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("row").filter({ hasText: "cancelled" })).toBeVisible();
    await expect(submittedRow).toHaveCount(0);
  });
});

test("a player can accelerate a building hull and it is accelerated after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await test.step("reachable:accelerate-construction", async () => {
    await navigateTo(page, "Construction");
    await page.getByRole("button", { name: /^Inflexible, active/ }).click();
    await page.getByRole("button", { name: "Inflexible accelerate" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "SetAcceleration queued" }),
    ).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Construction");
    await expect(
      shipsUnderConstruction(page).filter({ hasText: "Inflexible" }).getByText("accelerated", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Inflexible, accelerated/ }).click();
    await expect(page.getByRole("button", { name: "Inflexible stop accelerating" })).toBeVisible();
  });
});

test("a player can authorize a dock expansion and it is under way after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await test.step("reachable:authorize-dock-expansion", async () => {
    await navigateTo(page, "Construction");
    const ships = shipsUnderConstruction(page);
    await expect(ships.first()).toBeVisible();
    const before = await ships.count();
    await openYardPlace(page, /^Dock/);
    await expect(page.getByTestId("dock-size")).toBeVisible();
    await page.getByRole("button", { name: "Authorize dock expansion" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "AuthorizeDockExpansion queued" }),
    ).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Construction");
    await openYardPlace(page, /^Slipways/);
    await expect(ships).toHaveCount(before + 1);
  });
});

test("a player can cancel a construction project and it is cancelled after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await test.step("reachable:cancel-construction-project", async () => {
    await navigateTo(page, "Construction");
    await page.getByRole("button", { name: /^Inflexible, active/ }).click();
    await page.getByRole("button", { name: "Inflexible cancel project" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "CancelConstructionProject queued" }),
    ).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Construction");
    await expect(
      shipsUnderConstruction(page).filter({ hasText: "Inflexible" }).getByText("cancelled", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Inflexible, cancelled/ }).click();
    await expect(page.getByRole("button", { name: "Inflexible cancel project" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inflexible accelerate" })).toHaveCount(0);
  });
});

test("a player can revise a player-designed project and it is on hold after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(240_000);
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await submitReferenceDesign(page, CORVETTE, REVISED_CLASS);
  await advanceMonths(page, 4);
  await orderDesignFromCatalog(page, REVISED_CLASS);
  await advanceMonths(page, 1);

  await test.step("reachable:revise-project", async () => {
    await navigateTo(page, "Construction");
    await openYardPlace(page, /^Slipways/);
    await page.getByRole("button", { name: new RegExp(`^${REVISED_CLASS}, `) }).click();
    await expect(page.getByText(/on hold until/)).toHaveCount(0);
    await page.getByRole("button", { name: `${REVISED_CLASS} revise` }).click();

    const workspace = page.getByTestId("shipbuilding-workspace");
    await expect(workspace).toBeVisible();
    await openDesignSection(page, "Review");
    await page.getByRole("tab", { name: "Finish" }).click();
    const revision = workspace.getByRole("region", { name: "Revision preview" });
    await revision.getByRole("button", { name: "Load this ship's design into the board" }).click();
    const replaceMine = page.getByRole("button", { name: "Replace my design" });
    if (await replaceMine.isVisible()) await replaceMine.click();
    await expect(
      revision.getByText("No changes yet, so nothing would need revising."),
    ).toBeVisible();

    await openDesignSection(page, "Hull");
    await page.getByRole("tab", { name: "Dimensions" }).click();
    const subdivision = page.getByRole("combobox", { name: "Subdivision" });
    await subdivision.click();
    await page.getByRole("option", { name: "Grade 1" }).click();

    await openDesignSection(page, "Review");
    await page.getByRole("tab", { name: "Finish" }).click();
    await expect(revision.getByText("Redesign", { exact: true })).toBeVisible();
    await expect(revision.getByText("Funding on hold for")).toBeVisible();
    await revision.getByRole("button", { name: "Apply revision to this ship" }).click();
    await page.getByRole("button", { name: "Queue the revision" }).click();
    await expect(
      revision.getByRole("alert").filter({ hasText: "Revision queued (Redesign)" }),
    ).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Construction");
    await openYardPlace(page, /^Slipways/);
    await page.getByRole("button", { name: new RegExp(`^${REVISED_CLASS}, `) }).click();
    await expect(page.getByText(/on hold until \d{4}-\d{2}/).first()).toBeVisible();
  });
});
