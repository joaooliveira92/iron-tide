import { expect, test } from "./fixtures.js";
import { writeAppPreferences } from "./preferences-fixture.js";
import type { Page } from "@playwright/test";

const LIGHT_SURFACE = "rgb(238, 243, 248)";
const DARK_SURFACE = "rgb(3, 5, 9)";
const LIGHT_OCEAN = "rgb(234, 244, 253)";
const DARK_OCEAN = "rgb(14, 22, 34)";

async function openFleetDispatchInTheme(
  page: Page,
  userDataDir: string,
  theme: "light" | "dark",
): Promise<void> {
  writeAppPreferences(userDataDir, { theme });
  await page.reload();
  await page.getByText("Bluewave Naval Staff").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "New Campaign" }).click();
  await page.getByTestId("fleet-dispatch-surface").waitFor({ timeout: 30_000 });
}

const background = (page: Page, testId: string): Promise<string> =>
  page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor);

const oceanInner = (page: Page): Promise<string> =>
  page
    .locator("#svg-globe-ocean stop")
    .first()
    .evaluate((el) => getComputedStyle(el).getPropertyValue("stop-color"));

test("Fleet Dispatch surface, globe frame, and globe ocean follow the active theme", async ({
  e2e,
}) => {
  const page = e2e.page;

  await openFleetDispatchInTheme(page, e2e.userDataDir, "light");
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(
    false,
  );
  const lightSurface = await background(page, "fleet-dispatch-surface");
  const lightGlobePanel = await background(page, "globe-panel");
  const lightOcean = await oceanInner(page);

  await openFleetDispatchInTheme(page, e2e.userDataDir, "dark");
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  const darkSurface = await background(page, "fleet-dispatch-surface");
  const darkGlobePanel = await background(page, "globe-panel");
  const darkOcean = await oceanInner(page);

  expect(lightSurface).toBe(LIGHT_SURFACE);
  expect(darkSurface).toBe(DARK_SURFACE);
  expect(lightSurface).not.toBe(darkSurface);

  expect(lightGlobePanel).toBe(lightSurface);
  expect(darkGlobePanel).toBe(darkSurface);

  expect(lightOcean).toBe(LIGHT_OCEAN);
  expect(darkOcean).toBe(DARK_OCEAN);
});
