import { expect } from "@playwright/test";
import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { openDesignSection } from "./flows.js";

export interface EngineeringStatus {
  readonly displacement: number;
  readonly capacity: number;
  readonly cost: number;
  readonly speed: number;
}

const toNumber = (field: string, text: string | undefined): number => {
  const value = Number((text ?? "").replaceAll(",", ""));
  if (text === undefined || !Number.isFinite(value)) {
    throw new Error(`Engineering status: could not read ${field}`);
  }
  return value;
};

export async function readEngineeringStatus(page: Page): Promise<EngineeringStatus> {
  const text = await page.getByRole("region", { name: "Engineering status" }).innerText();
  const displacement = /Displacement\s+([\d,]+)\s*t\s*\/\s*([\d,]+)\s*t/.exec(text);
  return {
    displacement: toNumber("displacement", displacement?.[1]),
    capacity: toNumber("capacity", displacement?.[2]),
    cost: toNumber("cost", /Cost\s+([\d,]+)\s*units?\b/.exec(text)?.[1]),
    speed: toNumber("speed", /Speed\s+([\d.]+)\s*kn/.exec(text)?.[1]),
  };
}

export async function setNumber(scope: Locator, name: string, value: string): Promise<void> {
  const field = scope.getByRole("textbox", { name, exact: true });
  await field.fill(value);
  await field.press("Enter");
}

export async function openArmamentTab(page: Page, tab: string): Promise<Locator> {
  const drawer = await openDesignSection(page, "Armament");
  await drawer.getByRole("tab", { name: tab }).click();
  return drawer.getByRole("tabpanel", { name: tab });
}

export async function openHullDimensions(page: Page): Promise<Locator> {
  const drawer = await openDesignSection(page, "Hull");
  await drawer.getByRole("tab", { name: "Dimensions" }).click();
  return drawer.getByRole("tabpanel", { name: "Dimensions" });
}

export async function openOverviewBrief(page: Page): Promise<Locator> {
  const drawer = await openDesignSection(page, "Overview");
  await drawer.getByRole("tab", { name: "Brief" }).click();
  return drawer.getByRole("tabpanel", { name: "Brief" });
}

export async function fittingRows(panel: Locator): Promise<string[]> {
  return panel
    .getByRole("table")
    .getByRole("rowheader")
    .evaluateAll((cells) => cells.map((cell) => (cell.textContent ?? "").trim()));
}

export async function openFileDialog(page: Page): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: "Import or export design" });
  if (!(await dialog.isVisible())) {
    await page.getByRole("button", { name: "More design actions" }).click();
    await page.getByRole("menuitem", { name: /Import or export design/ }).click();
  }
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function closeWorkspaceDialog(page: Page, name: string): Promise<void> {
  const dialog = page.getByRole("dialog", { name });
  await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(dialog).toBeHidden();
}

export async function closeSectionDrawer(page: Page, section: string): Promise<void> {
  await page.getByRole("button", { name: `Close ${section}` }).click();
  await expect(page.getByRole("dialog", { name: section })).toBeHidden();
}

export const closeFileDialog = (page: Page) =>
  closeWorkspaceDialog(page, "Import or export design");

export async function chooseDesignAction(page: Page, item: RegExp): Promise<void> {
  await page.getByRole("button", { name: "More design actions" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

export async function addFitting(
  panel: Locator,
  page: Page,
  zone: string,
  fitting: RegExp,
): Promise<void> {
  await panel.getByRole("combobox", { name: "Add to zone" }).click();
  await page.getByRole("option", { name: zone, exact: true }).click();
  await panel.getByRole("button", { name: "Add component" }).click();
  await page.getByRole("menuitem", { name: fitting }).first().click();
}

export async function saveDesignFile(
  app: ElectronApplication,
  page: Page,
  path: string,
): Promise<void> {
  await rm(path, { force: true });
  await app.evaluate(({ session }, target) => {
    session.defaultSession.once("will-download", (_event, item) => {
      item.setSavePath(target);
    });
  }, path);
  const dialog = await openFileDialog(page);
  await dialog.getByRole("button", { name: "Save design file" }).click();
  await expect(dialog.getByRole("status")).toContainText(/^Saved /);
  await expect
    .poll(async () => {
      if (!existsSync(path)) return false;
      try {
        JSON.parse(await readFile(path, "utf8"));
        return true;
      } catch {
        return false;
      }
    })
    .toBe(true);
}

export async function openDesignFile(
  page: Page,
  path: string,
  options: { readonly replacingEdits: boolean },
): Promise<void> {
  const dialog = await openFileDialog(page);
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Open design file" }).click();
  if (options.replacingEdits) {
    const confirm = page.getByRole("alertdialog", { name: "Open a design file?" });
    await confirm.getByRole("button", { name: "Choose a file" }).click();
  }
  await (await chooser).setFiles(path);
}
