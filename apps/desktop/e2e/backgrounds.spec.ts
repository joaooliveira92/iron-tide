import { expect, test } from "./fixtures.js";
import { writeAppPreferences } from "./preferences-fixture.js";
import type { Page } from "@playwright/test";

const ANIMATED_BACKGROUNDS = ["auralis", "nebulore"] as const;

async function openWithBackground(
  page: Page,
  userDataDir: string,
  background: (typeof ANIMATED_BACKGROUNDS)[number],
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
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );

    expect(await contextLost(page)).toBe(false);
  });
}
