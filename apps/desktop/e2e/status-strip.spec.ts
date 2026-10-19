import { SEED, test, expect } from "./fixtures.js";
import { dismissTour, startNewCampaign } from "./flows.js";

// The expanded status strip: Nation, Budget and Outlook cards over the real campaign projection.
// Deterministic seed; asserts what the player sees (cards, budget wording, the deferred popover)
// and that nothing overflows the window at its minimum supported width.
test("the status strip expands into Nation, Budget and Outlook cards that fit the minimum window", async ({
  e2e,
}) => {
  const page = e2e.page;
  await startNewCampaign(page, { seed: SEED });
  await expect(page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
  await dismissTour(page);

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
