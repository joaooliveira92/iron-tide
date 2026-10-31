import type { Page } from "@playwright/test";
import { test, expect, openCampaign } from "./fixtures.js";
import { advanceMonths } from "./flows.js";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

async function openMap(page: Page) {
  await navigateTo(page, "Map");
  await expect(page.getByRole("application", { name: /world map/i })).toBeVisible({
    timeout: 30_000,
  });
  const panel = page.getByTestId("map-orders-panel");
  await expect(panel).toBeVisible();
  return panel;
}

test("the Map reads the compiled campaign and states what it does not model", async ({
  e2e,
  campaignTemplate,
}) => {
  await openCampaign(e2e, campaignTemplate);
  await test.step("reachable:read-world-map", async () => {
    const panel = await openMap(e2e.page);

    await expect(panel.getByRole("button", { name: /Home Fleet/ })).toBeVisible();
    const overscroll = await e2e.page
      .locator("main")
      .evaluate((main) => main.scrollHeight - main.clientHeight);
    expect(overscroll).toBe(0);

    const tabs = e2e.page.getByRole("navigation", { name: "Strategic affairs" });
    await tabs.getByRole("button", { name: /^Intelligence/ }).click();
    const intelligence = e2e.page.getByRole("dialog", { name: "Intelligence" });
    await expect(intelligence.getByText(/Foreign fleet positions are not known/)).toBeVisible();
    await expect(intelligence.getByText(/Invasion range is not modelled yet/)).toBeVisible();

    await tabs.getByRole("button", { name: /^Foreign stations/ }).click();
    const stations = e2e.page.getByRole("dialog", { name: "Foreign stations" });
    await expect(stations.getByText(/\d+ t short/).first()).toBeVisible();
    await stations.getByRole("button", { name: "Close Foreign stations" }).click();
    await expect(e2e.page.getByRole("table", { name: "Area control" })).toBeAttached();
  });
});

test("a fleet ordered from the Map panel sails one hop when the month advances", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  await test.step("reachable:move-fleet", async () => {
    const panel = await openMap(page);

    await panel.getByRole("button", { name: /Home Fleet/ }).click();
    await panel.getByRole("button", { name: "English Channel" }).click();
    await expect(panel.getByText(/Ordered: sails for English Channel/)).toBeVisible();

    await advanceMonths(page, 1);
    const after = await openMap(page);
    await expect(after.getByText("In English Channel")).toBeVisible();
    await expect(after.getByText(/Ordered: sails for/)).toBeHidden();
  });
});

test("a keyboard-only player can select a fleet and choose a destination", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const panel = await openMap(page);

  const fleetButton = panel.getByRole("button", { name: /Home Fleet/ });
  await fleetButton.focus();
  await page.keyboard.press("Enter");
  const destination = panel.getByRole("button", { name: "English Channel" });
  await destination.focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByText(/Ordered: sails for English Channel/)).toBeVisible();
});

async function pointInside(page: Page, mapAreaId: string) {
  return page.evaluate((id) => {
    const path = document.querySelector(`[data-map-area="${id}"]`);
    if (path === null) return null;
    const box = path.getBoundingClientRect();
    for (let row = 1; row < 12; row += 1) {
      for (let column = 1; column < 12; column += 1) {
        const x = box.x + (box.width * column) / 12;
        const y = box.y + (box.height * row) / 12;
        const hit = document
          .elementFromPoint(x, y)
          ?.closest("[data-map-area]")
          ?.getAttribute("data-map-area");
        if (hit === id) return { x, y };
      }
    }
    return null;
  }, mapAreaId);
}

async function visibleFleetMarker(page: Page, fleetId: string) {
  const markers = page.locator(`[data-map-fleet="${fleetId}"]`);
  const count = await markers.count();
  const viewport = await page.evaluate(() => ({
    width: globalThis.innerWidth,
    height: globalThis.innerHeight,
  }));
  for (let index = 0; index < count; index += 1) {
    const marker = markers.nth(index);
    const box = await marker.boundingBox();
    if (box === null) continue;
    const onScreen =
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= viewport.width &&
      box.y + box.height <= viewport.height;
    if (!onScreen) continue;
    const uncovered = await marker.evaluate((element) => {
      const at = element.getBoundingClientRect();
      const top = document.elementFromPoint(at.x + at.width / 2, at.y + at.height / 2);
      return top?.closest("[data-map-fleet]") === element;
    });
    if (uncovered) return box;
  }
  return null;
}

async function useLegacyChart(page: Page) {
  await page.evaluate(() => {
    globalThis.location.hash = "#legacy-renderer";
  });
  await expect(page.locator("[data-map-fleet]").first()).toBeAttached();
}

type FleetMarkerBox = NonNullable<Awaited<ReturnType<typeof visibleFleetMarker>>>;

async function settledFleetMarker(page: Page, fleetId: string) {
  await page.getByRole("application", { name: /world map/i }).focus();
  const seen: { box: FleetMarkerBox | null } = { box: null };
  await expect
    .poll(async () => {
      const box = await visibleFleetMarker(page, fleetId);
      if (box === null) {
        await page.keyboard.press("ArrowDown");
        seen.box = null;
        return false;
      }
      const settled = seen.box !== null && box.x === seen.box.x && box.y === seen.box.y;
      seen.box = box;
      return settled;
    })
    .toBe(true);
  return seen.box;
}

async function dragFleet(page: Page, toAreaId: string) {
  const from = await settledFleetMarker(page, "fleet_gbr_home");
  const to = await pointInside(page, toAreaId);
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 12, from!.y + from!.height / 2, { steps: 3 });
  await page.mouse.move(to!.x, to!.y, { steps: 8 });
  await page.mouse.up();
}

test("dragging a fleet marker onto a legal area queues the same order", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const panel = await openMap(page);
  await useLegacyChart(page);

  await dragFleet(page, "area_western_approaches");

  await expect(panel.getByText(/Ordered: sails for/)).toBeVisible();
});

test("dropping a fleet on an illegal area queues nothing", async ({ e2e, campaignTemplate }) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const panel = await openMap(page);
  await useLegacyChart(page);

  await dragFleet(page, "area_baltic");

  await expect(panel.getByRole("button", { name: "Home Fleet" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(panel.getByText(/Ordered: sails for/)).toBeHidden();
});
