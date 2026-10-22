import type { Locator } from "@playwright/test";
import { test, expect, openCampaign } from "./fixtures.js";
import { advanceMonths } from "./flows.js";

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

  await expect(strip.getByText("Prestige")).toHaveCount(0);
  await strip.getByRole("button", { name: /Not yet modelled \(\d+\)/ }).click();
  const popover = page.getByRole("dialog", { name: "Not yet modelled" });
  await expect(popover.getByText("Prestige", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();

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

test("a clicked status strip card stays pinned, two can be compared, and a click away closes them", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const strip = page.getByRole("region", { name: "Status strip" });
  if ((await strip.getAttribute("data-expanded")) !== "true") {
    await strip.getByRole("button", { name: /expand/i }).click();
  }
  const popup = (heading: string) =>
    page.locator("[data-open][data-side][tabindex='-1']").filter({ hasText: heading });

  const maintenance = strip.getByText("Maintenance", { exact: true });
  await maintenance.click();
  await expect(popup("Over a year")).toBeVisible();

  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  await expect(popup("Over a year")).toBeVisible();
  await expect(popup("Over a year").getByText(/Pinned\. Press Esc/)).toBeVisible();

  await strip.getByText("Monthly balance (projected)", { exact: true }).click();
  await expect(popup("Balance breakdown")).toBeVisible();
  await expect(popup("Over a year")).toBeVisible();

  await popup("Balance breakdown").getByText("Monthly balance", { exact: true }).click();
  await expect(popup("Over a year")).toBeVisible();

  await page.mouse.click(5, 300);
  await expect(popup("Over a year")).toBeHidden();
  await expect(popup("Balance breakdown")).toBeHidden();

  await maintenance.click();
  await expect(popup("Over a year")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup("Over a year")).toBeHidden();
});

test("the status strip shows a treasury trend only after a month has been advanced", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const strip = page.getByRole("region", { name: "Status strip" });
  if ((await strip.getAttribute("data-expanded")) !== "true") {
    await strip.getByRole("button", { name: /expand/i }).click();
  }
  await expect(strip.locator("[data-trend-delta]")).toHaveCount(0);

  await advanceMonths(page, 1);
  await expect(strip.locator("[data-trend-delta]")).toHaveCount(1);

  await strip.getByText("Treasury", { exact: true }).hover();
  const card = page
    .locator("[data-open][data-side][tabindex='-1']")
    .filter({ hasText: "Next month end" });
  await expect(card.locator("[data-trend=treasury]")).toBeVisible();
  await expect(
    card.getByRole("img", { name: /^Treasury: 2 points from Jan 1880 to Feb 1880/ }),
  ).toBeVisible();
});
