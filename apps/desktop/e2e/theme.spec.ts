import { expect, test } from "./fixtures.js";
import type { Page } from "@playwright/test";

// Regression guard for "the Fleet Dispatch surface follows the active theme":
// its command surface, the globe's panel frame, and the globe ocean must all
// resolve to the `.dark` palette when the theme is dark, and the light palette
// when it is light. The theme is set through the app's own storage key before
// reload, exactly as the user's toggle would persist it.

const LIGHT_SURFACE = "rgb(238, 243, 248)"; // --color-admiralty-surface (light)
const DARK_SURFACE = "rgb(3, 5, 9)"; // --color-admiralty-surface (dark)
const LIGHT_OCEAN = "rgb(234, 244, 253)"; // --globe-ocean-inner (light)
const DARK_OCEAN = "rgb(14, 22, 34)"; // --globe-ocean-inner (dark)

async function openFleetDispatchInTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((t) => localStorage.setItem("bluewave-theme", t), theme);
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

  await openFleetDispatchInTheme(page, "light");
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(
    false,
  );
  const lightSurface = await background(page, "fleet-dispatch-surface");
  const lightGlobePanel = await background(page, "globe-panel");
  const lightOcean = await oceanInner(page);

  await openFleetDispatchInTheme(page, "dark");
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  const darkSurface = await background(page, "fleet-dispatch-surface");
  const darkGlobePanel = await background(page, "globe-panel");
  const darkOcean = await oceanInner(page);

  // The whole surface inverts...
  expect(lightSurface).toBe(LIGHT_SURFACE);
  expect(darkSurface).toBe(DARK_SURFACE);
  expect(lightSurface).not.toBe(darkSurface);

  // ...the globe's frame shares the same active theme as the surface...
  expect(lightGlobePanel).toBe(lightSurface);
  expect(darkGlobePanel).toBe(darkSurface);

  // ...and the globe sphere itself follows the theme too.
  expect(lightOcean).toBe(LIGHT_OCEAN);
  expect(darkOcean).toBe(DARK_OCEAN);
});
