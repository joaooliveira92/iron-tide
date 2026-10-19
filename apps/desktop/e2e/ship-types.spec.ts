import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { SEED, test, expect } from "./fixtures.js";
import { advanceMonths, dismissTour, openShipbuilding, startNewCampaign } from "./flows.js";

// ADR-0088 critical path: the pre-dreadnought roster at the 1880 start, a Pre-dreadnought battleship edited into an
// invalid configuration and corrected, submitted, studied, ordered, and still there after the app is reopened.
test.describe.configure({ mode: "serial" });

let saveDir = "";
const CLASS_NAME = "Predread E2E";

const navigateTo = (page: Page, label: string) =>
  page.getByTestId("bottom-nav").getByRole("button", { name: label, exact: true }).click();

async function openCampaign(e2e: { page: Page; retargetDialog(d: string): Promise<void> }) {
  await e2e.retargetDialog(saveDir);
  await e2e.page.getByRole("button", { name: "Open Campaign" }).click();
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
  await dismissTour(e2e.page);
}

test("the opening roster offers the six pre-dreadnought types, and a battleship design is built and submitted", async ({
  e2e,
}) => {
  saveDir = join(await mkdtemp(join(tmpdir(), "bluewave-shiptypes-")), "save");
  await e2e.retargetDialog(saveDir);
  await startNewCampaign(e2e.page, { seed: SEED });
  await expect(e2e.page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
  await dismissTour(e2e.page);
  const workspace = await openShipbuilding(e2e.page);

  // 1. The reference-design roster offers exactly the six pre-dreadnought types
  // (in roster order), and nothing later: no battlecruiser, aircraft, carrier or
  // submarine card, and the dialog says more kinds arrive later.
  await workspace.getByRole("button", { name: "Start from a reference design" }).click();
  const startDialog = e2e.page.getByRole("dialog", { name: "Start from a reference design" });
  const roster = startDialog.getByRole("listbox", { name: "Ship types" });
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
  await expect(startDialog).not.toContainText(/battlecruiser|aircraft|carrier|submarine/i);
  await e2e.page.keyboard.press("Escape");

  // 2. Start from the battleship's starter design (a confirmation appears only if the design holds edits).
  // The deck's cards overlap, so step the listbox to the type and confirm with Enter (as the new-game flow does).
  await workspace.getByRole("button", { name: "Start from a reference design" }).click();
  const targetId = await e2e.page
    .getByRole("option", { name: "Pre-dreadnought battleship (B)" })
    .getAttribute("id");
  await roster.focus();
  for (let step = 0; step < 6; step++) {
    if ((await roster.getAttribute("aria-activedescendant")) === targetId) break;
    await roster.press("ArrowRight");
  }
  await roster.press("Enter");
  const replace = e2e.page.getByRole("button", { name: "Replace my design" });
  if (await replace.isVisible().catch(() => false)) await replace.click();
  // Inside a campaign an unnamed design reads "Needs a class name": name it, then it can be submitted.
  await workspace
    .getByRole("group", { name: "Design commands" })
    .getByRole("textbox", { name: "Class name" })
    .fill(CLASS_NAME);
  await expect(workspace.getByText("Can be submitted")).toBeVisible();

  // 3. Thin the belt below 6 inches: the design stops qualifying as a battleship and cannot be built.
  await workspace.getByRole("button", { name: /^Protection, / }).click();
  await workspace.getByRole("tab", { name: "Armour" }).click();
  const belt = workspace.getByRole("textbox", { name: "Thickness of BELT_MAIN (mm)" });
  const original = await belt.inputValue();
  await belt.fill("100");
  await belt.press("Enter");
  await expect(workspace.getByText("Cannot be built")).toBeVisible();

  // 5. Correct it: the finding clears and the design can be submitted again.
  await belt.fill(original);
  await belt.press("Enter");
  await expect(workspace.getByText("Can be submitted")).toBeVisible();

  // 6. Submit the design; it is queued once and the button cannot send it twice.
  await workspace.getByRole("button", { name: "Finish design" }).click();
  await workspace.getByRole("button", { name: "Submit design" }).click();
  await expect(workspace.getByText(new RegExp(`Design queued\\. .*"${CLASS_NAME}"`))).toBeVisible({
    timeout: 15_000,
  });
  await expect(workspace.getByRole("button", { name: "Queued" })).toBeDisabled();
});

test("once its study is done the design is ordered for construction", async ({ e2e }) => {
  expect(saveDir).not.toBe("");
  await openCampaign(e2e);
  await advanceMonths(e2e.page, 4);
  await navigateTo(e2e.page, "Construction");
  await e2e.page.getByRole("tab", { name: "Design Catalog" }).click();
  await e2e.page.getByRole("radio", { name: new RegExp(CLASS_NAME) }).click();
  await e2e.page.getByRole("button", { name: "Submit Construction Command" }).click();
  await e2e.page.getByRole("button", { name: "Confirm order" }).click();
  await expect(e2e.page.getByText(/Command \S+ is submitted/)).toBeVisible();
});

test("after the app is reopened the design and its construction order are still there", async ({
  e2e,
}) => {
  expect(saveDir).not.toBe("");
  await openCampaign(e2e);
  await navigateTo(e2e.page, "Construction");
  await e2e.page.getByRole("tab", { name: "Command Ledger" }).click();
  await expect(e2e.page.getByRole("row").filter({ hasText: "submitted" })).toBeVisible({
    timeout: 15_000,
  });
  await e2e.page.getByRole("tab", { name: "Design Catalog" }).click();
  await expect(e2e.page.getByRole("radio", { name: new RegExp(CLASS_NAME) })).toBeVisible();
});
