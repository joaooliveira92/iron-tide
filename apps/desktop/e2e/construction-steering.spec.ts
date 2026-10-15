import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { SEED, test, expect } from "./fixtures.js";
import { advanceMonths, dismissTour, startNewCampaign } from "./flows.js";

// SB3-R5/R8 player surface: the Construction screen's halt/resume/accelerate controls issue a real command that the
// engine applies on the next month. This drives the played loop: halt a building hull, advance a month, and see the
// hull held.
test.describe.configure({ mode: "serial" });

let saveDir = "";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

test("a player can halt a building hull and it stays halted after a month", async ({ e2e }) => {
  saveDir = join(await mkdtemp(join(tmpdir(), "bluewave-construction-steering-")), "save");
  await e2e.retargetDialog(saveDir);
  await startNewCampaign(e2e.page, { seed: SEED });
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
  await dismissTour(e2e.page);

  await navigateTo(e2e.page, "Construction");

  // The starting build ("Inflexible") offers the steering controls on the Shipyard Ledger.
  const halt = e2e.page.getByRole("button", { name: "Inflexible halt" });
  await expect(halt).toBeVisible();
  await halt.click();

  // Issuing the command is a queued envelope: it applies when the month advances.
  await expect(
    e2e.page.getByRole("status").filter({ hasText: "HaltConstruction queued" }),
  ).toBeVisible();

  await advanceMonths(e2e.page, 1);
  await navigateTo(e2e.page, "Construction");

  // The engine held the hull: the row now shows the halted status and a resume control.
  await expect(e2e.page.getByText("halted", { exact: true })).toBeVisible();
  await expect(e2e.page.getByRole("button", { name: "Inflexible resume" })).toBeVisible();
});
