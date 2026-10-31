import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect, relaunchAndOpen, teardownHarness, openCampaign } from "./fixtures.js";
import {
  advanceMonths,
  navigateTo,
  openDesignSection,
  openRoster,
  openShipbuilding,
  selectRosterOption,
} from "./flows.js";

const CLASS_NAME = "Predread E2E";
const BATTLESHIP = "Pre-dreadnought battleship (B)";

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
  await test.step("reachable:submit-design", async () => {
    const workspace = await openShipbuilding(page);

    const roster = await openRoster(page, workspace);
    await selectRosterOption(roster, BATTLESHIP);
    const replace = page.getByRole("button", { name: "Replace my design" });
    const className = workspace
      .getByRole("group", { name: "Design commands" })
      .getByRole("textbox", { name: "Class name" });
    await replace.or(className).first().waitFor();
    if (await replace.isVisible()) await replace.click();
    await className.fill(CLASS_NAME);
    await expect(workspace.getByText("Can be submitted")).toBeVisible();

    await openDesignSection(page, "Protection");
    await workspace.getByRole("tab", { name: "Armour" }).click();
    const belt = workspace.getByRole("textbox", { name: "Thickness of BELT_MAIN (mm)" });
    const original = await belt.inputValue();
    await belt.fill("100");
    await belt.press("Enter");
    const explanation = page.getByRole("alertdialog");
    await expect(explanation.getByText("This change breaks the design")).toBeVisible();
    await explanation.getByRole("button", { name: "Keep it and fix it myself" }).click();
    const status = page.getByRole("region", { name: "Engineering status" });
    await expect(status.getByText("Cannot be built")).toBeVisible();

    await belt.fill(original);
    await belt.press("Enter");
    await expect(status.getByText("Can be submitted")).toBeVisible();

    await workspace.getByRole("button", { name: "Finish design" }).click();
    await workspace.getByRole("button", { name: "Submit design" }).click();
    await expect(
      workspace.getByText(new RegExp(`Design queued\\. .*"${CLASS_NAME}"`)),
    ).toBeVisible();
    await expect(workspace.getByRole("button", { name: "Queued" })).toBeDisabled();
  });

  await e2e.app.close();
  const second = await relaunchAndOpen(pkg);
  try {
    const next = second.page;
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

  const third = await relaunchAndOpen(pkg);
  try {
    const last = third.page;
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
