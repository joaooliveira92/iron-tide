import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { SEED, test, expect } from "./fixtures.js";
import { advanceMonths, dismissTour, startNewCampaign } from "./flows.js";

// SB3-R11/R30 player surface: the Construction screen's class-order batch dialog previews the engine's auto-assigned
// names and dock fit, then places the batch through the engine on the next month. This drives the played loop:
// configure -> order batch -> advance month -> see the new hulls under construction.
test.describe.configure({ mode: "serial" });

let saveDir = "";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

test("a player can order a class batch and it appears after a month", async ({ e2e }) => {
  saveDir = join(await mkdtemp(join(tmpdir(), "bluewave-construction-batch-")), "save");
  await e2e.retargetDialog(saveDir);
  await startNewCampaign(e2e.page, { seed: SEED });
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
  await dismissTour(e2e.page);

  await navigateTo(e2e.page, "Construction");

  const shipsUnderConstruction = e2e.page
    .getByRole("list", { name: "Ships under construction" })
    .locator("> li");
  await expect(shipsUnderConstruction.first()).toBeVisible();
  const before = await shipsUnderConstruction.count();

  await e2e.page.getByRole("tab", { name: "Design Catalog" }).click();
  await e2e.page.getByRole("button", { name: "Order a class batch (1–12)" }).click();

  // The dialog previews the engine's assigned names and the dock fit before ordering.
  await expect(e2e.page.getByRole("combobox", { name: "Batch design" })).toBeVisible();
  await expect(e2e.page.getByRole("list", { name: "Previewed ship names" })).toBeVisible();
  await e2e.page.getByRole("spinbutton", { name: "Batch quantity" }).fill("1");
  await expect(e2e.page.getByTestId("batch-confirm")).toBeEnabled();
  await e2e.page.getByTestId("batch-confirm").click();

  // Issuing the command is a queued envelope: it applies when the month advances. The queued notice is surfaced on
  // the Shipyard Ledger, so return there before asserting it.
  await e2e.page.getByRole("tab", { name: "Shipyard Ledger" }).click();
  await expect(
    e2e.page.getByRole("status").filter({ hasText: "OrderConstruction queued" }),
  ).toBeVisible();

  await advanceMonths(e2e.page, 1);
  await navigateTo(e2e.page, "Construction");

  // The engine placed the batch: one more hull is now under construction.
  await expect(shipsUnderConstruction).toHaveCount(before + 1);
});
