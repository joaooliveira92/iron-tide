import type { Page } from "@playwright/test";
import { test, expect, openCampaign } from "./fixtures.js";
import { advanceMonths } from "./flows.js";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

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

test("a player can order from a foreign yard and it appears after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Construction");

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

test("a player can halt a building hull and it stays halted after a month", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Construction");

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

test("a construction command can be submitted, replaced atomically, then cancelled", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await navigateTo(page, "Construction");
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
