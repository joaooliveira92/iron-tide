import { expect, test } from "./fixtures.js";
import { writeAppPreferences } from "./preferences-fixture.js";
import type { Page } from "@playwright/test";

// Regression guard for "toggling the theme at runtime keeps the animated
// backdrop alive". Auralis and Nebulore rebuild their WebGL program when the
// theme changes (their palette is an effect dependency). The effect cleanup
// must not lose the canvas context: a lost context is never restored, so the
// rebuilt program fails to compile and the backdrop vanishes behind a blank
// surface while the rest of the app inverts to the new theme.

const ANIMATED_BACKGROUNDS = ["auralis", "nebulore"] as const;

async function openWithBackground(
  page: Page,
  userDataDir: string,
  background: string,
): Promise<void> {
  writeAppPreferences(userDataDir, { theme: "light", background });
  await page.reload();
  await page.getByText("Bluewave Naval Staff").waitFor({ timeout: 15_000 });
}

const contextLost = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const gl = document.querySelector("canvas")?.getContext("webgl");
    return gl?.isContextLost() ?? true;
  });

for (const background of ANIMATED_BACKGROUNDS) {
  test(`the ${background} backdrop survives a runtime theme change`, async ({ e2e }) => {
    const page = e2e.page;

    await openWithBackground(page, e2e.userDataDir, background);
    expect(await contextLost(page)).toBe(false);

    await page.getByRole("button", { name: /Theme:/ }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
    await page.waitForTimeout(300);

    expect(await contextLost(page)).toBe(false);
  });
}
