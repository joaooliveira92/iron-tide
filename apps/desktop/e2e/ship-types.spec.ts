import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect, launchHarness, teardownHarness, openCampaign } from "./fixtures.js";
import { advanceMonths, openShipbuilding } from "./flows.js";

// ADR-0088 critical path: the pre-dreadnought roster at the 1880 start, a Pre-dreadnought battleship edited into an
// invalid configuration and corrected, submitted, studied, ordered, and still there after the app is reopened.

const CLASS_NAME = "Predread E2E";
const BATTLESHIP = "Pre-dreadnought battleship (B)";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

/**
 * Opens the reference-design dialog and returns its ship-type roster. The deck's cards overlap, so a
 * test steps the listbox to a type and confirms with Enter (as the new-game flow does).
 */
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
  // The active option moves through React state, so a key press is only complete once the roster reports a new
  // active option: read it again before stepping on, or a stale read overshoots to the last card.
  const activeId = () => roster.getAttribute("aria-activedescendant");
  for (let step = 0; step < 6; step++) {
    const before = await activeId();
    if (before === targetId) break;
    await roster.press("ArrowRight");
    await expect.poll(activeId).not.toBe(before);
  }
  // Enter only on the requested card; any other fails here rather than starting a different design.
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

  // In roster order, and nothing later: no battlecruiser, aircraft, carrier or submarine card.
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
  // The package must outlive the first app instance, so it lives outside e2e.scratch.
  const root = await mkdtemp(join(tmpdir(), "bluewave-shiptypes-"));
  const pkg = await openCampaign(e2e, campaignTemplate, root);
  const workspace = await openShipbuilding(page);

  // Start from the battleship's starter design (a confirmation appears only if the design holds edits).
  const roster = await openRoster(page, workspace);
  await selectRosterOption(roster, BATTLESHIP);
  const replace = page.getByRole("button", { name: "Replace my design" });
  if (await replace.isVisible().catch(() => false)) await replace.click();
  // Inside a campaign an unnamed design reads "Needs a class name": name it, then it can be submitted.
  await workspace
    .getByRole("group", { name: "Design commands" })
    .getByRole("textbox", { name: "Class name" })
    .fill(CLASS_NAME);
  await expect(workspace.getByText("Can be submitted")).toBeVisible();

  // Thin the belt below 6 inches: the design stops qualifying as a battleship and cannot be built.
  await workspace.getByRole("button", { name: /^Protection, / }).click();
  await workspace.getByRole("tab", { name: "Armour" }).click();
  const belt = workspace.getByRole("textbox", { name: "Thickness of BELT_MAIN (mm)" });
  const original = await belt.inputValue();
  await belt.fill("100");
  await belt.press("Enter");
  // The choice is explained at once; the player keeps it and corrects it by hand.
  const explanation = page.getByRole("alertdialog");
  await expect(explanation.getByText("This change breaks the design")).toBeVisible();
  await explanation.getByRole("button", { name: "Keep it and fix it myself" }).click();
  await expect(workspace.getByText("Cannot be built")).toBeVisible();

  // Correct it: the finding clears and the design can be submitted again.
  await belt.fill(original);
  await belt.press("Enter");
  await expect(workspace.getByText("Can be submitted")).toBeVisible();

  // Submit the design; it is queued once and the button cannot send it twice.
  await workspace.getByRole("button", { name: "Finish design" }).click();
  await workspace.getByRole("button", { name: "Submit design" }).click();
  await expect(workspace.getByText(new RegExp(`Design queued\\. .*"${CLASS_NAME}"`))).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Queued" })).toBeDisabled();

  // Once its study is done the design is ordered for construction.
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
    await next.getByRole("tab", { name: "Design Catalog" }).click();
    await next.getByRole("radio", { name: new RegExp(CLASS_NAME) }).click();
    await next.getByRole("button", { name: "Submit Construction Command" }).click();
    await next.getByRole("button", { name: "Confirm order" }).click();
    await expect(next.getByText(/Command \S+ is submitted/)).toBeVisible();
  } finally {
    await teardownHarness(second);
  }

  // After the app is reopened again the design and its construction order are still there.
  const third = await launchHarness({ saveDir: pkg });
  try {
    const last = third.page;
    await last.getByRole("button", { name: "Open Campaign" }).click();
    await expect(last.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
      timeout: 30_000,
    });
    await navigateTo(last, "Construction");
    await last.getByRole("tab", { name: "Command Ledger" }).click();
    await expect(last.getByRole("row").filter({ hasText: "submitted" })).toBeVisible();
    await last.getByRole("tab", { name: "Design Catalog" }).click();
    await expect(last.getByRole("radio", { name: new RegExp(CLASS_NAME) })).toBeVisible();
  } finally {
    await teardownHarness(third);
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});
