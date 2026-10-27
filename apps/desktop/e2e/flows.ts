import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export interface NewCampaignOptions {
  readonly nation?: string;
  readonly archetype?: string;
  readonly admiral?: string;
  readonly campaign?: string;
  readonly seed?: string;
}

const click = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).click();

export async function reachFleetMethodScreen(
  page: Page,
  opts: NewCampaignOptions = {},
): Promise<void> {
  const { nation = "United Kingdom", archetype = "Shipyard Baron" } = opts;
  await click(page, "New Campaign");
  await page.getByRole("option", { name: nation }).click();
  await page.getByRole("listbox", { name: "Playable nations" }).press("Enter");
  if (opts.seed !== undefined) await page.getByLabel("Campaign Seed").fill(opts.seed);
  await click(page, "Next: Choose Archetype");
  const deck = page.getByRole("listbox", { name: "Archetype presets" });
  const target = await page.getByRole("option", { name: archetype }).getAttribute("id");
  for (let step = 0; step < 4; step++) {
    if ((await deck.getAttribute("aria-activedescendant")) === target) break;
    await deck.press("ArrowRight");
  }
  await deck.press("Enter");
  await click(page, "Choose Nation");
  await page.getByLabel("Admiral name").fill(opts.admiral ?? "John Fisher");
  await page.getByLabel("Campaign name").fill(opts.campaign ?? "Test Run");
  await click(page, "Next");
}

export async function startNewCampaign(page: Page, opts: NewCampaignOptions = {}): Promise<void> {
  await reachFleetMethodScreen(page, opts);
  await click(page, "Next: Review Campaign");
  await click(page, "Begin Commission");

  for (const label of [
    "Review Naval Estimates",
    "Continue to Treasury Position",
    "Continue to Foreign Intelligence",
    "Continue to Immediate Concerns",
    "Take command",
  ]) {
    await click(page, label);
  }
}

export async function advanceMonths(page: Page, count: number): Promise<void> {
  const calendar = page.getByText(/^Bluewave — [A-Za-z]+ \d{4}$/).first();
  for (let i = 0; i < count; i++) {
    const before = await calendar.textContent();
    expect(before).not.toBeNull();
    await page.getByRole("button", { name: /^advance month$/i }).click();
    await page.getByRole("button", { name: /^advance to /i }).click();
    await page.getByRole("dialog", { name: "Pre-turn review" }).waitFor({ state: "hidden" });
    await expect(calendar).not.toHaveText(before!);
  }
}

export async function openShipbuilding(page: Page): Promise<Locator> {
  await page.getByTestId("bottom-nav").getByRole("button", { name: "Ship design" }).click();
  const dialog = page.getByTestId("shipbuilding-dialog");
  await dialog.getByTestId("shipbuilding-workspace").waitFor({ timeout: 15_000 });
  return dialog;
}

export async function dismissTour(page: Page): Promise<void> {
  await page.getByRole("button", { name: "End inspection" }).click();
}

export async function expandStatusStrip(page: Page): Promise<Locator> {
  const strip = page.getByRole("region", { name: "Status strip" });
  if ((await strip.getAttribute("data-expanded")) !== "true") {
    await strip.getByRole("button", { name: /expand/i }).click();
    await expect(strip).toHaveAttribute("data-expanded", "true");
  }
  return strip;
}

export const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();
