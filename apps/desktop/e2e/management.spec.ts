import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect, openCampaign, relaunchAndOpen, teardownHarness } from "./fixtures.js";
import { advanceMonths, navigateTo, openFleetDepartment } from "./flows.js";

test("management orders are queued together, take effect next month, and the commander is reassigned", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);

  await test.step("reachable:set-research-priority", async () => {
    await navigateTo(page, "Research & Technology");
    await expect(page.getByRole("heading", { name: "Research & Technology" })).toBeVisible();
    await expect(page.getByRole("img", { name: "1 of 5 High priority slots used" })).toBeVisible();

    await page.getByRole("button", { name: /^Gunnery, Medium priority/ }).click();
    await page.getByRole("button", { name: "Gunnery High", exact: true }).first().click();
    await expect(page.getByRole("img", { name: "2 of 5 High priority slots used" })).toBeVisible();
    await page.getByRole("button", { name: /^Set priorities/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Priorities queued" })).toBeVisible();
  });

  await test.step("reachable:set-budget-allocation", async () => {
    await navigateTo(page, "Treasury");
    const research = page.getByRole("slider", { name: "Research budget per month" });
    await expect(research).toHaveValue("5");
    await expect(page.getByRole("button", { name: /^Research: 5 — show detail/ })).toBeVisible();

    const increase = page.getByRole("button", { name: "Increase research budget per month" });
    await increase.click();
    await increase.click();
    await expect(research).toHaveValue("7");
    await page.getByRole("button", { name: "Apply allocation" }).click();
    await expect(page.getByText(/Budget allocation queued/)).toBeVisible();
  });

  await test.step("reachable:fund-special-training", async () => {
    await navigateTo(page, "Fleet");
    await openFleetDepartment(page, "Training");
    const training = page.getByRole("region", { name: "Special training" });
    await expect(training.getByText("0 of 2")).toBeVisible();

    await training.getByRole("checkbox", { name: "Fund Gunnery" }).check();
    await training.getByRole("button", { name: "Apply training" }).click();
    await expect(training.getByText(/Special training queued/)).toBeVisible();
  });

  await test.step("reachable:hold-fleet-exercise", async () => {
    await openFleetDepartment(page, "Exercises");
    const exercise = page.getByRole("region", { name: "Annual fleet exercise" });
    await expect(exercise.getByText("0 of 1 in 1880")).toBeVisible();

    await exercise.getByRole("checkbox", { name: "Exercise HMS Alexandra" }).check();
    await exercise.getByRole("button", { name: "Hold fleet exercise" }).click();
    await expect(exercise.getByText(/Fleet exercise queued for 1 ship/)).toBeVisible();
  });

  await test.step("reachable:assign-or-relieve-officer", async () => {
    await openFleetDepartment(page, "Organization");
    const organization = page.getByTestId("fleet-organization");
    const relieve = organization.getByRole("button", { name: "Relieve commander" });
    await expect(relieve).toHaveCount(2);
    await expect(organization.getByText("Commander vacant")).toHaveCount(0);

    await relieve.first().click();
    await expect(organization.getByText(/Relieve commander queued/)).toBeVisible();
  });

  await advanceMonths(page, 1);

  await test.step("the research priority holds after the month", async () => {
    await navigateTo(page, "Research & Technology");
    await expect(page.getByRole("button", { name: /^Gunnery, High priority/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "2 of 5 High priority slots used" })).toBeVisible();
  });

  await test.step("the budget allocation shows on the treasury", async () => {
    await navigateTo(page, "Treasury");
    await expect(page.getByRole("button", { name: /^Research: 7 — show detail/ })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Research budget per month" })).toHaveValue("7");
  });

  await test.step("special training and the fleet exercise accrue a month", async () => {
    await navigateTo(page, "Fleet");
    await openFleetDepartment(page, "Training");
    const training = page.getByRole("region", { name: "Special training" });
    await expect(training.getByText("1 of 2")).toBeVisible();
    await expect(training.getByRole("checkbox", { name: "Fund Gunnery" })).toBeChecked();
    await expect(training.getByText("1 of 12 months")).toBeVisible();

    await openFleetDepartment(page, "Exercises");
    const exercise = page.getByRole("region", { name: "Annual fleet exercise" });
    await expect(exercise.getByText("1 of 1 in 1880")).toBeVisible();
    await expect(exercise.getByText("Exercise set for 1880-02 with 1 ship.")).toBeVisible();
    await expect(
      exercise.getByText("The exercise for 1880 has already been ordered."),
    ).toBeVisible();
  });

  await test.step("a new division commander is assigned after the relief", async () => {
    await openFleetDepartment(page, "Organization");
    const organization = page.getByTestId("fleet-organization");
    const relieve = organization.getByRole("button", { name: "Relieve commander" });
    const vacant = organization.getByText("Commander vacant");
    await expect(vacant).toHaveCount(1);
    await expect(relieve).toHaveCount(1);

    await organization.getByRole("button", { name: "Assign commander" }).click();
    await expect(organization.getByText(/Assign commander queued/)).toBeVisible();

    await advanceMonths(page, 1);
    await navigateTo(page, "Fleet");
    await openFleetDepartment(page, "Organization");
    await expect(vacant).toHaveCount(0);
    await expect(relieve).toHaveCount(2);
  });
});

test("preferences and the guided inspection state survive a restart", async ({
  e2e,
  campaignTemplate,
}) => {
  const pkg = await openCampaign(e2e, campaignTemplate);
  const preference = (page: typeof e2e.page) =>
    page.getByRole("button", { name: "Toggle Show Unit Fatigue" });
  const openDisplayPreferences = async (page: typeof e2e.page) => {
    await navigateTo(page, "Campaign Preferences");
    await page
      .getByRole("navigation", { name: "Campaign preference sections" })
      .getByRole("button", { name: "Display preferences" })
      .click();
  };

  await test.step("reachable:persist-ui-state", async () => {
    await openDisplayPreferences(e2e.page);
    const before = await preference(e2e.page).getAttribute("aria-pressed");
    await preference(e2e.page).click();
    await expect(preference(e2e.page)).not.toHaveAttribute("aria-pressed", before!);
    await e2e.page.getByTestId("restart-guided-inspection").click();
    await expect(e2e.page.getByText(/Guided inspection will reappear/)).toBeVisible();
    await e2e.app.close();

    const second = await relaunchAndOpen(pkg);
    try {
      await expect(second.page.getByRole("button", { name: "End inspection" })).toBeVisible();
      await second.page.getByRole("button", { name: "End inspection" }).click();
      await openDisplayPreferences(second.page);
      await expect(preference(second.page)).not.toHaveAttribute("aria-pressed", before!);
    } finally {
      await teardownHarness(second);
    }

    const third = await relaunchAndOpen(pkg);
    try {
      await openDisplayPreferences(third.page);
      await expect(preference(third.page)).not.toHaveAttribute("aria-pressed", before!);
      await expect(third.page.getByRole("button", { name: "End inspection" })).toHaveCount(0);
      expect(await readFile(join(pkg, "ui-state.json"), "utf8")).toMatch(/"status":\s*"dismissed"/);
    } finally {
      await teardownHarness(third);
    }
  });
});
