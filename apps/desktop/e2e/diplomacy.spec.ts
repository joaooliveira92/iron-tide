import type { Page } from "@playwright/test";
import { test, expect, openCampaign } from "./fixtures.js";
import { advanceMonths, navigateTo } from "./flows.js";

const openDiplomacy = async (page: Page) => {
  await navigateTo(page, "Diplomacy & War");
  await expect(page.getByRole("heading", { name: "Diplomacy & War" })).toBeVisible();
};

const nationRow = (page: Page, nation: string) =>
  page
    .getByRole("navigation", { name: "Nations" })
    .getByRole("button", { name: new RegExp(`^${nation}, `) });

const selectNation = async (page: Page, nation: string) => {
  await nationRow(page, nation).click();
  await expect(
    page.getByTestId("nation-dossier").getByRole("heading", { name: nation }),
  ).toBeVisible();
};

const draftAction = async (page: Page, action: RegExp) => {
  const button = page.getByTestId("nation-dossier").getByRole("button", { name: action });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
};

const submitDrafted = async (page: Page, label: string) => {
  await page
    .getByRole("group", { name: "Orders" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "Command queued" })).toBeVisible();
};

const orderOn = async (page: Page, nation: string, action: RegExp) => {
  await selectNation(page, nation);
  await draftAction(page, action);
  await submitDrafted(page, "Submit command");
};

const declareWar = async (page: Page, nation: string) => {
  await selectNation(page, nation);
  await draftAction(page, /^Declare war/);
  await expect(page.getByText(/declaration of war cannot be cancelled/)).toBeVisible();
  await submitDrafted(page, "Declare war");
};

test("one diplomatic order a month: war, blockade, alliance and pact are formed, then both treaties broken", async ({
  e2e,
  campaignTemplate,
}) => {
  const page = e2e.page;
  await openCampaign(e2e, campaignTemplate);
  const dossier = page.getByTestId("nation-dossier");
  const war = page.getByTestId("war-front");

  await test.step("reachable:declare-war", async () => {
    await openDiplomacy(page);
    await expect(war).toHaveCount(0);
    await expect(nationRow(page, "French Republic")).toHaveAccessibleName(/Neutral/);

    await declareWar(page, "French Republic");
    await expect(war).toHaveCount(0);
  });

  await advanceMonths(page, 1);
  await openDiplomacy(page);

  await test.step("the war stands open", async () => {
    await expect(war).toContainText("Declared");
    await expect(war).toContainText("Attacker, you");
    await expect(war).toContainText("French Republic");
    await expect(war.getByRole("img", { name: /^War score: / })).toBeVisible();
    await expect(nationRow(page, "French Republic")).toHaveAccessibleName(/At war/);

    await selectNation(page, "French Republic");
    await expect(dossier.getByRole("button", { name: /^Declare war/ })).toHaveCount(0);
    await expect(dossier.getByRole("button", { name: /^Blockade/ })).toBeVisible();
  });

  let areaName = "";
  let scoreBefore: string | null = null;

  await test.step("reachable:declare-blockade", async () => {
    await expect(war.getByRole("list", { name: "Blockades in this war" })).toHaveCount(0);
    scoreBefore = await war.getByRole("img", { name: /^War score: / }).getAttribute("aria-label");

    await draftAction(page, /^Blockade/);
    const area = page.getByRole("combobox", { name: "Blockade area" });
    await expect(area).toBeVisible();
    areaName = (await area.innerText()).trim();
    expect(areaName).not.toBe("");
    await submitDrafted(page, "Submit command");
  });

  await advanceMonths(page, 1);
  await openDiplomacy(page);

  await test.step("the blockade shows on the war front", async () => {
    const blockades = war.getByRole("list", { name: "Blockades in this war" });
    await expect(blockades.getByRole("listitem")).toHaveCount(1);
    await expect(blockades).toContainText(areaName);
    await expect(blockades).toContainText("since 1880-02");
    await selectNation(page, "French Republic");
    await expect(
      dossier.getByRole("list", { name: "Blockades involving this nation" }),
    ).toBeVisible();
    await expect(war.getByRole("img", { name: /^War score: / })).not.toHaveAttribute(
      "aria-label",
      scoreBefore!,
    );
  });

  await test.step("reachable:form-or-break-alliance", async () => {
    await expect(nationRow(page, "Netherlands")).toHaveAccessibleName(/Neutral/);
    await orderOn(page, "Netherlands", /^Form alliance/);
  });

  await advanceMonths(page, 1);
  await openDiplomacy(page);

  await test.step("the alliance is in force", async () => {
    await expect(nationRow(page, "Netherlands")).toHaveAccessibleName(/Allied/);
    await selectNation(page, "Netherlands");
    await expect(dossier.getByText("Allied", { exact: true })).toBeVisible();
    await expect(dossier.getByRole("button", { name: /^Form alliance/ })).toHaveCount(0);
  });

  await test.step("reachable:form-or-break-non-aggression-pact", async () => {
    await selectNation(page, "Russian Empire");
    await expect(dossier.getByText("Pact")).toBeVisible();
    await expect(dossier.getByText("None", { exact: true }).first()).toBeVisible();
    await draftAction(page, /^Form NAP/);
    await submitDrafted(page, "Submit command");
  });

  await advanceMonths(page, 1);
  await openDiplomacy(page);

  await test.step("the pact is in force and the alliance is broken", async () => {
    await expect(nationRow(page, "Russian Empire")).toContainText("NAP");
    await selectNation(page, "Russian Empire");
    await expect(dossier.getByText("Non-aggression", { exact: true })).toBeVisible();
    await expect(dossier.getByRole("button", { name: /^Form NAP/ })).toHaveCount(0);

    await selectNation(page, "Netherlands");
    await draftAction(page, /^Break alliance/);
    await submitDrafted(page, "Submit command");
  });

  await advanceMonths(page, 1);
  await openDiplomacy(page);

  await test.step("the alliance is dissolved and the pact is broken", async () => {
    await expect(nationRow(page, "Netherlands")).toHaveAccessibleName(/Neutral/);
    await selectNation(page, "Netherlands");
    await expect(dossier.getByRole("button", { name: /^Form alliance/ })).toBeVisible();
    await expect(dossier.getByRole("button", { name: /^Break alliance/ })).toHaveCount(0);

    await selectNation(page, "Russian Empire");
    await draftAction(page, /^Break NAP/);
    await submitDrafted(page, "Submit command");
  });

  await advanceMonths(page, 1);
  await openDiplomacy(page);

  await test.step("the pact is dissolved", async () => {
    await expect(nationRow(page, "Russian Empire")).not.toContainText("NAP");
    await selectNation(page, "Russian Empire");
    await expect(dossier.getByText("Non-aggression", { exact: true })).toHaveCount(0);
    await expect(dossier.getByRole("button", { name: /^Form NAP/ })).toBeVisible();
  });
});
