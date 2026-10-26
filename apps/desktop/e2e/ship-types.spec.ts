import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect, launchHarness, teardownHarness, openCampaign } from "./fixtures.js";
import { advanceMonths, openShipbuilding } from "./flows.js";

const CLASS_NAME = "Predread E2E";
const BATTLESHIP = "Pre-dreadnought battleship (B)";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

async function openRoster(page: Page, workspace: Locator): Promise<Locator> {
  await workspace.getByRole("button", { name: "Start from a reference design" }).click();
  return page
    .getByRole("dialog", { name: "Start from a reference design" })
    .getByRole("listbox", { name: "Ship types" });
}

async function selectRosterOption(roster: Locator, name: string): Promise<void> {
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

test("the opening roster offers exactly the six pre-dreadnought types", async ({
  e2e,
  campaignTemplate,
}) => {
  await openCampaign(e2e, campaignTemplate);
  const workspace = await openShipbuilding(e2e.page);
  const roster = await openRoster(e2e.page, workspace);

  await expect(roster.getByRole("option")).toHaveCount(6);
  const labels = await roster
    .getByRole("option")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  expect(labels).toEqual([
    "Pre-dreadnought battleship (B)",
    "Armoured cruiser (CA)",
    "Protected cruiser (CL)",
    "Torpedo boat / early destroyer (DD)",
    "Corvette / colonial gunboat (KE)",
    "Armed merchant cruiser (AMC)",
  ]);
  await expect(
    e2e.page.getByRole("dialog", { name: "Start from a reference design" }),
  ).not.toContainText(/battlecruiser|aircraft|carrier|submarine/i);
});

test("a battleship design is built, submitted, studied, ordered and survives a restart", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  const root = await mkdtemp(join(tmpdir(), "bluewave-shiptypes-"));
  const pkg = await openCampaign(e2e, campaignTemplate, root);
  const workspace = await openShipbuilding(page);

  const roster = await openRoster(page, workspace);
  await selectRosterOption(roster, BATTLESHIP);
  const replace = page.getByRole("button", { name: "Replace my design" });
  if (await replace.isVisible().catch(() => false)) await replace.click();
  await workspace
    .getByRole("group", { name: "Design commands" })
    .getByRole("textbox", { name: "Class name" })
    .fill(CLASS_NAME);
  await expect(workspace.getByText("Can be submitted")).toBeVisible();

  await workspace.getByRole("button", { name: /^Protection, / }).click();
  await workspace.getByRole("tab", { name: "Armour" }).click();
  const belt = workspace.getByRole("textbox", { name: "Thickness of BELT_MAIN (mm)" });
  const original = await belt.inputValue();
  await belt.fill("100");
  await belt.press("Enter");
  const explanation = page.getByRole("alertdialog");
  await expect(explanation.getByText("This change breaks the design")).toBeVisible();
  await explanation.getByRole("button", { name: "Keep it and fix it myself" }).click();
  await expect(workspace.getByText("Cannot be built")).toBeVisible();

  await belt.fill(original);
  await belt.press("Enter");
  await expect(workspace.getByText("Can be submitted")).toBeVisible();

  await workspace.getByRole("button", { name: "Finish design" }).click();
  await workspace.getByRole("button", { name: "Submit design" }).click();
  await expect(workspace.getByText(new RegExp(`Design queued\\. .*"${CLASS_NAME}"`))).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Queued" })).toBeDisabled();

  await e2e.app.close();
  const second = await launchHarness({ saveDir: pkg });
  try {
    const next = second.page;
    await next.getByRole("button", { name: "Open Campaign" }).click();
    await expect(next.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
      timeout: 30_000,
    });
    await advanceMonths(next, 4);
    await navigateTo(next, "Construction");
    await next
      .getByRole("navigation", { name: "Yard" })
      .getByRole("button", { name: /^Design catalog/ })
      .click();
    await next.getByRole("radio", { name: new RegExp(CLASS_NAME) }).click();
    await next.getByRole("button", { name: "Submit Construction Command" }).click();
    await next.getByRole("button", { name: "Confirm order" }).click();
    await expect(next.getByText(/Command \S+ is submitted/)).toBeVisible();
  } finally {
    await teardownHarness(second);
  }

  const third = await launchHarness({ saveDir: pkg });
  try {
    const last = third.page;
    await last.getByRole("button", { name: "Open Campaign" }).click();
    await expect(last.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
      timeout: 30_000,
    });
    await navigateTo(last, "Construction");
    await last
      .getByRole("navigation", { name: "Yard" })
      .getByRole("button", { name: /^Orders/ })
      .click();
    await expect(last.getByRole("row").filter({ hasText: "submitted" })).toBeVisible();
    await last
      .getByRole("navigation", { name: "Yard" })
      .getByRole("button", { name: /^Design catalog/ })
      .click();
    await expect(last.getByRole("radio", { name: new RegExp(CLASS_NAME) })).toBeVisible();
  } finally {
    await teardownHarness(third);
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
