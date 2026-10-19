import type { Locator } from "@playwright/test";
import { test, expect, openCampaign } from "./fixtures.js";

// The expanded status strip: Nation, Budget and Outlook cards over the real campaign projection.
// Deterministic seed; asserts what the player sees (cards, budget wording, the deferred popover)
// and that nothing overflows the window at its minimum supported width.
test("the status strip expands into Nation, Budget and Outlook cards that fit the minimum window", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  const strip = page.getByRole("region", { name: "Status strip" });
  if ((await strip.getAttribute("data-expanded")) !== "true") {
    await strip.getByRole("button", { name: /expand/i }).click();
  }
  for (const name of ["Nation", "Budget", "Outlook"]) {
    await expect(strip.getByRole("group", { name })).toBeVisible();
  }

  const budget = strip.getByRole("group", { name: "Budget" });
  await expect(budget.getByRole("img", { name: /of the monthly appropriation of/ })).toBeVisible();
  await expect(budget.getByText("Committed expenses")).toBeVisible();
  await expect(
    strip.getByRole("group", { name: "Outlook" }).getByText(/^(Healthy|Narrow|Deficit|Critical)$/),
  ).toBeVisible();

  // The deferred readouts live behind one popover and are never shown as numbers.
  await expect(strip.getByText("Prestige")).toHaveCount(0);
  await strip.getByRole("button", { name: /Not yet modelled \(\d+\)/ }).click();
  const popover = page.getByRole("dialog", { name: "Not yet modelled" });
  await expect(popover.getByText("Prestige", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();

  // Minimum supported window: the strip must stay inside the viewport.
  await e2e.app.evaluate(({ BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows();
    window?.setContentSize(960, 640);
  });
  await expect
    .poll(() => page.evaluate(() => window.innerWidth <= 960 && window.innerHeight <= 640))
    .toBe(true);
  const overflow = await page.evaluate(() => {
    const strip = document.querySelector('[data-testid="status-strip"]');
    if (strip === null) return Number.NaN;
    const rect = strip.getBoundingClientRect();
    return Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      Math.ceil(rect.right - window.innerWidth),
      strip.scrollWidth - strip.clientWidth,
    );
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

// The hover cards are portalled and placed against the viewport, so at the smallest supported
// window each one must still open fully on screen, from both the expanded and collapsed strip.
test("every status strip hover card opens inside the minimum window", async ({
  e2e,
  campaignTemplate,
}, testInfo) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await e2e.app.evaluate(({ BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows();
    window?.setContentSize(960, 640);
  });
  await expect.poll(() => page.evaluate(() => window.innerWidth <= 960)).toBe(true);

  const strip = page.getByRole("region", { name: "Status strip" });
  if ((await strip.getAttribute("data-expanded")) !== "true") {
    await strip.getByRole("button", { name: /expand/i }).click();
  }

  const expectCardOnScreen = async (trigger: Locator, heading: string, shot: string) => {
    await trigger.scrollIntoViewIfNeeded();
    await trigger.hover();
    const card = page.locator("[data-open][data-side][tabindex='-1']").filter({ hasText: heading });
    await expect(card).toBeVisible();
    // The open animation scales the card, so wait until its box stops moving.
    await expect
      .poll(async () => {
        const a = await card.boundingBox();
        await page.waitForTimeout(0);
        const b = await card.boundingBox();
        return a !== null && b !== null && a.x === b.x && a.width === b.width;
      })
      .toBe(true);
    const box = await card.boundingBox();
    const viewport = page.viewportSize() ?? { width: 960, height: 640 };
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: testInfo.outputPath(`${shot}.png`) });
    await page.mouse.move(0, 0);
    await expect(card).toBeHidden();
  };

  await expectCardOnScreen(strip.getByText("Maintenance", { exact: true }), "Over a year", "line");
  await expectCardOnScreen(
    strip.getByText("Monthly balance (projected)", { exact: true }),
    "Balance breakdown",
    "balance",
  );
  await expectCardOnScreen(
    strip.getByText("Shipyard capacity (port levels)", { exact: true }),
    "The sum of your ports",
    "shipyard",
  );
  await expectCardOnScreen(
    strip.getByText("Ships on foreign stations", { exact: true }),
    "Foreign stations",
    "stations",
  );

  await strip.getByRole("button", { name: /collapse/i }).click();
  await expectCardOnScreen(
    strip.getByRole("button", { name: /^Monthly balance/ }),
    "Balance breakdown",
    "chip-balance",
  );
  await expectCardOnScreen(
    strip.getByRole("button", { name: /^Treasury/ }),
    "Next month end",
    "chip-treasury",
  );
  await expectCardOnScreen(
    strip.getByRole("button", { name: /^Priorities/ }),
    "Strategic priorities",
    "chip-alerts",
  );
});
