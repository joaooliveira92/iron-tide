import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, openCampaign, relaunchAndOpen, teardownHarness } from "./fixtures.js";
import type { E2EHarness } from "./fixtures.js";
import {
  closeSectionDrawer,
  fittingRows,
  nameTheClass,
  openArmamentTab,
  openHullDimensions,
  readEngineeringStatus,
  setNumber,
  startFromReference,
} from "./design-session.js";
import { navigateTo, openShipbuilding } from "./flows.js";

const BATTLESHIP = "Pre-dreadnought battleship (B)";

async function leaveAndQuit(harness: E2EHarness): Promise<void> {
  await navigateTo(harness.page, "Construction");
  await harness.app.close();
}

test("an unfinished design is waiting after a restart, and the player can keep it or start over", async ({
  e2e,
  campaignTemplate,
}) => {
  test.setTimeout(240_000);
  const root = await mkdtemp(join(tmpdir(), "bluewave-draft-"));
  try {
    const pkg = await openCampaign(e2e, campaignTemplate, root);
    const page = e2e.page;
    await startFromReference(page, BATTLESHIP);
    await nameTheClass(page, "Draft E2E");
    const original = await readEngineeringStatus(page);

    const torpedoes = await openArmamentTab(page, "Torpedoes");
    await torpedoes.getByRole("button", { name: "Remove tubes" }).click();
    await expect.poll(() => fittingRows(torpedoes)).toHaveLength(0);
    const stripped = await readEngineeringStatus(page);
    expect(stripped).not.toEqual(original);
    await closeSectionDrawer(page, "Armament");
    await leaveAndQuit(e2e);

    const second = await relaunchAndOpen(pkg);
    try {
      const next = second.page;
      await openShipbuilding(next);
      await expect(next.getByRole("button", { name: "Start over" })).toBeVisible();
      await expect(next.getByRole("button", { name: "Keep working" })).toBeVisible();
      await expect.poll(() => readEngineeringStatus(next)).toEqual(stripped);
      const restored = await openArmamentTab(next, "Torpedoes");
      await expect.poll(() => fittingRows(restored)).toHaveLength(0);
      await closeSectionDrawer(next, "Armament");

      await next.getByRole("button", { name: "Start over" }).click();
      await expect(next.getByRole("button", { name: "Start over" })).toBeHidden();
      await expect.poll(() => readEngineeringStatus(next)).toEqual(original);

      await setNumber(await openHullDimensions(next), "Beam (m)", "20.50");
      await expect.poll(() => readEngineeringStatus(next)).not.toEqual(original);
      await closeSectionDrawer(next, "Hull");
      await leaveAndQuit(second);
    } catch (error) {
      await teardownHarness(second);
      throw error;
    }

    const third = await relaunchAndOpen(pkg);
    try {
      const last = third.page;
      await openShipbuilding(last);
      await expect(last.getByRole("button", { name: "Keep working" })).toBeVisible();
      await last.getByRole("button", { name: "Keep working" }).click();
      await expect(last.getByRole("button", { name: "Keep working" })).toBeHidden();
      const hull = await openHullDimensions(last);
      await expect(hull.getByRole("textbox", { name: "Beam (m)" })).toHaveValue("20.50");
      const widened = await readEngineeringStatus(last);
      expect(widened).not.toEqual(original);
      await closeSectionDrawer(last, "Hull");
      await expect(last.getByRole("button", { name: "Undo" })).toBeEnabled();
    } finally {
      await teardownHarness(third);
    }
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
