import type { Page } from "@playwright/test";
import { test, expect, openCampaign } from "./fixtures.js";
import { openDesignSection, openShipbuilding } from "./flows.js";

const SECTIONS = [
  "Overview",
  "Hull",
  "Machinery",
  "Protection",
  "Armament",
  "Systems",
  "Review",
] as const;

const WINDOWS = [
  { width: 1600, height: 900 },
  { width: 1280, height: 720 },
] as const;

interface Layout {
  readonly pageScrollbar: number;
  readonly drawerLeft: number;
  readonly contentLeft: number;
  readonly contentWidth: number;
}

async function layoutOf(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const scroller = document.querySelector('[data-testid="drawer-scroll"]');
    const content = scroller?.firstElementChild;
    if (main === null || scroller === null || scroller === undefined || !content)
      throw new Error("the design drawer is not open");
    return {
      pageScrollbar: main.offsetWidth - main.clientWidth,
      drawerLeft: Math.round(scroller.getBoundingClientRect().left),
      contentLeft: Math.round(content.getBoundingClientRect().left),
      contentWidth: Math.round(content.getBoundingClientRect().width),
    };
  });
}

for (const { width, height } of WINDOWS) {
  test(`switching design sections never shifts the screen sideways at ${width}x${height}`, async ({
    e2e,
    campaignTemplate,
  }) => {
    const page = e2e.page;
    await openCampaign(e2e, campaignTemplate);
    await e2e.app.evaluate(
      ({ BrowserWindow }, size) => {
        const [window] = BrowserWindow.getAllWindows();
        window?.setMinimumSize(1, 1);
        window?.setContentSize(size.width, size.height);
      },
      { width, height },
    );
    await expect
      .poll(() => page.evaluate((w) => Math.abs(window.innerWidth - w) <= 1, width))
      .toBe(true);
    await openShipbuilding(page);

    const seen = new Map<string, Layout>();
    for (const section of SECTIONS) {
      await openDesignSection(page, section);
      seen.set(section, await layoutOf(page));
    }

    const first = seen.get(SECTIONS[0])!;
    for (const [section, layout] of seen) {
      expect(layout.pageScrollbar, `${section}: page scrollbar`).toBe(0);
      expect(layout.drawerLeft, `${section}: drawer position`).toBe(first.drawerLeft);
      expect(layout.contentLeft, `${section}: drawer content position`).toBe(first.contentLeft);
      expect(layout.contentWidth, `${section}: drawer content width`).toBe(first.contentWidth);
    }
  });
}
