import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { SEED, test, expect } from "./fixtures.js";
import { advanceMonths, dismissTour, startNewCampaign } from "./flows.js";

// SB3-R20/R34 player surface (INC-9b): the Construction screen's build dialog offers foreign builders, previews the
// engine's derived contract terms (with the builder's dock ceiling and impoundment risk) and places the order through
// the engine on the next month. Drives the played loop: choose foreign builder -> order -> advance month.
test.describe.configure({ mode: "serial" });

let saveDir = "";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

test("a player can order from a foreign yard and it appears after a month", async ({ e2e }) => {
  saveDir = join(await mkdtemp(join(tmpdir(), "bluewave-foreign-order-")), "save");
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

  // The builder selector offers the nation's own yards and the candidate foreign builders (SB3-R34).
  const builder = e2e.page.getByRole("combobox", { name: "Builder" });
  await expect(builder).toBeVisible();
  await builder.selectOption("france");

  // The contract panel shows the engine's derived terms, dock ceiling and impoundment risk.
  await expect(e2e.page.getByTestId("foreign-contract-panel")).toBeVisible();
  await expect(e2e.page.getByTestId("foreign-total-price")).toBeVisible();
  await expect(e2e.page.getByTestId("foreign-impoundment-risk")).toBeVisible();

  await e2e.page.getByRole("spinbutton", { name: "Batch quantity" }).fill("1");
  const confirm = e2e.page.getByRole("button", { name: "Order from foreign yard" });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // Issuing the command is a queued envelope: it applies when the month advances.
  await e2e.page.getByRole("tab", { name: "Shipyard Ledger" }).click();
  await expect(
    e2e.page.getByRole("status").filter({ hasText: "OrderForeignConstruction queued" }),
  ).toBeVisible();

  await advanceMonths(e2e.page, 1);
  await navigateTo(e2e.page, "Construction");

  await expect(shipsUnderConstruction).toHaveCount(before + 1);
});
