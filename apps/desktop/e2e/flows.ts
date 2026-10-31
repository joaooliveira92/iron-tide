import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export interface NewCampaignOptions {
  readonly nation?: string;
  readonly archetype?: string;
  readonly admiral?: string;
  readonly campaign?: string;
  readonly seed?: string;
  readonly onBriefingPage?: (pageIndex: number) => Promise<void>;
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

  const forwardLabels = [
    "Review Naval Estimates",
    "Continue to Treasury Position",
    "Continue to Foreign Intelligence",
    "Continue to Immediate Concerns",
    "Take command",
  ];
  for (const [pageIndex, label] of forwardLabels.entries()) {
    await page.getByRole("button", { name: label, exact: true }).waitFor();
    await opts.onBriefingPage?.(pageIndex);
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

export async function openFleetDepartment(page: Page, department: string): Promise<Locator> {
  const drawer = page.getByRole("dialog", { name: department });
  if (!(await drawer.isVisible())) {
    await page
      .getByRole("navigation", { name: "Fleet departments" })
      .getByRole("button", { name: new RegExp(`^${department}`) })
      .click();
  }
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function closeFleetDepartment(page: Page, department: string): Promise<void> {
  await page.getByRole("button", { name: `Close ${department}` }).click();
  await expect(page.getByRole("dialog", { name: department })).toBeHidden();
}

export async function openRoster(page: Page, workspace: Locator): Promise<Locator> {
  await workspace.getByRole("button", { name: "Start from a reference design" }).click();
  return page
    .getByRole("dialog", { name: "Start from a reference design" })
    .getByRole("listbox", { name: "Ship types" });
}

export async function selectRosterOption(roster: Locator, name: string): Promise<void> {
  const targetId = await roster.getByRole("option", { name }).getAttribute("id");
  expect(targetId).not.toBeNull();
  await roster.focus();
  const activeId = () => roster.getAttribute("aria-activedescendant");
  for (let step = 0; step < 6; step++) {
    const before = await activeId();
    if (before === targetId) break;
    await roster.press("ArrowRight");
    await expect.poll(activeId).not.toBe(before);
  }
  await expect(roster).toHaveAttribute("aria-activedescendant", targetId!);
  await roster.press("Enter");
}

export async function submitReferenceDesign(
  page: Page,
  referenceName: string,
  className: string,
): Promise<void> {
  const workspace = await openShipbuilding(page);
  await selectRosterOption(await openRoster(page, workspace), referenceName);
  const replace = page.getByRole("button", { name: "Replace my design" });
  const classNameField = workspace
    .getByRole("group", { name: "Design commands" })
    .getByRole("textbox", { name: "Class name" });
  await replace.or(classNameField).first().waitFor();
  if (await replace.isVisible()) await replace.click();
  await classNameField.fill(className);
  await expect(workspace.getByText("Can be submitted")).toBeVisible();
  await workspace.getByRole("button", { name: "Finish design" }).click();
  await workspace.getByRole("button", { name: "Submit design" }).click();
  await expect(workspace.getByText(new RegExp(`Design queued\\. .*"${className}"`))).toBeVisible();
  await workspace.getByRole("button", { name: "Close", exact: true }).click();
}

export async function orderDesignFromCatalog(page: Page, className: string): Promise<void> {
  await navigateTo(page, "Construction");
  await page
    .getByRole("navigation", { name: "Yard" })
    .getByRole("button", { name: /^Design catalog/ })
    .click();
  await page.getByRole("radio", { name: new RegExp(className) }).click();
  await page.getByRole("button", { name: "Submit Construction Command" }).click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText(/Command \S+ is submitted/)).toBeVisible();
}
