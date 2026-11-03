import type { Page } from "@playwright/test";
import { SEED, test, expect, expectOverview } from "./fixtures.js";
import { advanceMonths, dismissTour, startNewCampaign } from "./flows.js";

interface BridgeResultLike {
  readonly outcome: "success" | "error" | "rejected";
  readonly reason?: string;
}

interface BluewaveBridgeLike {
  readonly campaign: {
    execute(command: string, payload: unknown): Promise<BridgeResultLike>;
  };
}

async function readSessionId(page: Page): Promise<string> {
  const heading = page.locator("h1").first();
  await expect(heading).toContainText("Session");
  const text = (await heading.textContent()) ?? "";
  const match = text.match(/Session ([0-9a-f-]{36})/i);
  if (match === null) throw new Error(`No session id in Overview heading: ${text}`);
  return match[1]!;
}

async function execute(page: Page, command: string, payload: unknown): Promise<BridgeResultLike> {
  return page.evaluate(
    ([name, body]) => {
      const bridge = (globalThis as { bluewave?: BluewaveBridgeLike }).bluewave;
      if (bridge === undefined) throw new Error("window.bluewave is unavailable");
      return bridge.campaign.execute(name as string, body);
    },
    [command, payload] as const,
  );
}

async function elapsedMinute(page: Page): Promise<number> {
  const text = (await page.getByTestId("tactical-elapsed").textContent()) ?? "";
  const match = text.match(/Elapsed (\d+):(\d+)/);
  if (match === null) throw new Error(`No elapsed clock in: ${text}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

test("fight a real-time tactical battle through the production app", async ({ e2e }, testInfo) => {
  test.setTimeout(240_000);
  const { page } = e2e;
  const shot = (name: string) => page.screenshot({ path: testInfo.outputPath(`${name}.png`) });

  await startNewCampaign(page, { seed: SEED });
  await expectOverview(page);
  await dismissTour(page);
  const sessionId = await readSessionId(page);

  await page
    .getByTestId("bottom-nav")
    .getByRole("button", { name: "Diplomacy & War", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Nations" })
    .getByRole("button", { name: /^French Republic, / })
    .click();
  await page
    .getByTestId("nation-dossier")
    .getByRole("button", { name: /^Declare war/ })
    .click();
  await page.getByRole("button", { name: "Declare war", exact: true }).click();
  await expect(page.getByText("Command queued", { exact: true })).toBeVisible();
  await advanceMonths(page, 1);

  const drill = await execute(page, "seedCampaignBattleDrill", { sessionId });
  expect(drill, JSON.stringify(drill)).toMatchObject({ outcome: "success" });

  await page.getByRole("button", { name: /^advance month$/i }).click();
  await page.getByRole("button", { name: /^advance to /i }).click();
  await page.getByTestId("offer-accept").click();

  const battle = page.getByTestId("player-battle");
  await expect(battle).toBeVisible();
  await expect(page.getByTestId("tactical-run-state")).toHaveText("PAUSED");
  await expect(page.getByTestId("tactical-map")).toBeVisible();
  await shot("01-loaded-paused");

  const startMinute = await elapsedMinute(page);
  await page.waitForTimeout(1_500);
  expect(await elapsedMinute(page)).toBe(startMinute);

  const ownShip = page.locator('[data-testid^="tactical-ship-"][data-side="own"]').first();
  await ownShip.click();
  await expect(page.getByTestId("unit-panel")).toContainText("Selected:");
  await shot("02-selected-ship");

  await page.getByTestId("unit-course-input").fill("045");
  await page.getByTestId("unit-speed-input").fill("10");
  await page.getByTestId("unit-apply").click();
  await expect(page.getByTestId("unit-order-state")).toHaveAttribute("data-state", "pending");
  await shot("03-order-pending");

  await page.getByTestId("battle-advance").click();
  await expect(page.getByTestId("unit-order-state")).toHaveAttribute("data-state", "accepted");
  expect(await elapsedMinute(page)).toBe(startMinute + 1);

  await page.getByTestId("tactical-speed-8").click();
  await page.getByTestId("tactical-run-toggle").click();
  await expect(page.getByTestId("tactical-run-state")).toContainText("Running at 8");
  await expect.poll(() => elapsedMinute(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
  await shot("04-running");

  await page.getByTestId("tactical-run-toggle").click();
  await expect(page.getByTestId("tactical-run-state")).toHaveText("PAUSED");
  await expect(page.getByTestId("battle-advance")).toBeEnabled();
  const frozen = await elapsedMinute(page);
  await page.waitForTimeout(2_000);
  expect(await elapsedMinute(page)).toBe(frozen);

  await page.getByTestId("tactical-speed-8").click();
  await page.getByTestId("tactical-run-toggle").click();
  await expect(page.getByTestId("tactical-firing-line").first()).toBeVisible({ timeout: 120_000 });
  await shot("05-engagement");
  await page.getByTestId("tactical-run-toggle").click();

  await page.getByRole("tab", { name: "Combat log" }).click();
  await expect(page.getByTestId("battle-log-entry").first()).toBeVisible();
  await shot("06-combat-log");

  await page.setViewportSize({ width: 1024, height: 700 });
  await shot("07-narrow-window");

  await page.getByTestId("battle-auto").click();
  await expect(page.getByTestId("tactical-run-state")).toHaveText("Battle over", {
    timeout: 60_000,
  });
  await shot("08-battle-complete");
  await page.getByTestId("battle-submit").click();
  await expect(battle).toBeHidden();
});
