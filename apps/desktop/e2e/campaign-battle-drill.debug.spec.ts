import type { Page } from "@playwright/test";
import { SEED, test, expect } from "./fixtures.js";
import { advanceMonths, dismissTour, startNewCampaign } from "./flows.js";

interface BridgeResultLike {
  readonly outcome: "success" | "error" | "rejected";
  readonly value?: unknown;
  readonly reason?: string;
  readonly diagnostics?: readonly string[];
}

interface BattleHistoryLike {
  readonly revision: number;
  readonly history: {
    readonly battles: readonly {
      readonly battleId: string;
      readonly attackerName: string;
      readonly defenderName: string;
      readonly involvesPlayer: boolean;
      readonly outcomeForPlayer: string;
      readonly playerLossCount: number;
      readonly enemyLossCount: number;
      readonly lostShipIds: readonly string[];
    }[];
  };
}

interface DiplomacyLike {
  readonly wars: readonly {
    readonly warId: string;
    readonly attackerWarScore: number;
    readonly defenderWarScore: number;
  }[];
}

async function readSessionId(page: Page): Promise<string> {
  const heading = page.locator("h1").first();
  await expect(heading).toContainText("Session");
  const text = (await heading.textContent()) ?? "";
  const match = text.match(/Session ([0-9a-f-]{36})/i);
  if (match === null) throw new Error(`No session id in Overview heading: ${text}`);
  return match[1];
}

interface BluewaveBridgeLike {
  readonly campaign: {
    execute(command: string, payload: unknown): Promise<BridgeResultLike>;
  };
}

async function execute(page: Page, command: string, payload: unknown): Promise<BridgeResultLike> {
  return page.evaluate(
    ([cmd, body]) => {
      const bridge = (globalThis as { bluewave?: BluewaveBridgeLike }).bluewave;
      if (bridge === undefined) throw new Error("window.bluewave is unavailable");
      return bridge.campaign.execute(cmd as string, body);
    },
    [command, payload] as const,
  );
}

async function advanceThroughBattleOffer(page: Page): Promise<void> {
  const calendar = page.getByText(/^Bluewave — [A-Za-z]+ \d{4}$/).first();
  const before = await calendar.textContent();
  await page.getByRole("button", { name: /^advance month$/i }).click();
  await page.getByRole("button", { name: /^advance to /i }).click();
  await page.getByTestId("offer-delegate").click();
  await expect(page.getByTestId("offer-delegate")).toBeHidden();
  await expect(calendar).not.toHaveText(before ?? "");
}

test("declared war → generated battle → resolved and surfaced in campaign state", async ({
  e2e,
}) => {
  const { page } = e2e;

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await startNewCampaign(page, { seed: SEED });
  await expect(page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
  await dismissTour(page);
  const sessionId = await readSessionId(page);

  await page
    .getByTestId("bottom-nav")
    .getByRole("button", { name: "Diplomacy & War", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Diplomacy & War" })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Nations" })
    .getByRole("button", { name: /^French Republic, / })
    .click();
  const dossier = page.getByTestId("nation-dossier");
  await expect(dossier.getByRole("heading", { name: "French Republic" })).toBeVisible();
  await dossier.getByRole("button", { name: /^Declare war/ }).click();

  const orders = page.getByRole("group", { name: "Orders" });
  const queueAlert = orders.getByRole("alert").filter({ hasText: /cannot be cancelled/ });
  await expect(queueAlert).toBeVisible();
  await orders.getByRole("button", { name: "Declare war", exact: true }).click();
  await expect(page.getByText("Command queued", { exact: true })).toBeVisible();

  await advanceMonths(page, 1);

  const drill = await execute(page, "seedCampaignBattleDrill", { sessionId });
  expect(drill, JSON.stringify(drill)).toMatchObject({ outcome: "success" });

  await advanceThroughBattleOffer(page);

  await page
    .getByTestId("bottom-nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page
    .getByTestId("bottom-nav")
    .getByRole("button", { name: "Diplomacy & War", exact: true })
    .click();

  await page.getByRole("tab", { name: "Battles" }).click();
  await expect(page.getByText("No battles fought yet")).not.toBeVisible();
  const summary = page.getByTestId("battle-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(/battle/);
  await expect(page.getByTestId("war-score-bar")).toBeVisible();

  const history = (await execute(page, "inspectBattleHistory", sessionId)) as BridgeResultLike;
  expect(history.outcome).toBe("success");
  const view = history.value as BattleHistoryLike;
  const playerBattles = view.history.battles.filter((b) => b.involvesPlayer);
  expect(playerBattles.length).toBeGreaterThanOrEqual(1);
  const battle = playerBattles[0]!;
  expect(battle.attackerName).toBe("United Kingdom");
  expect(battle.defenderName).toBe("French Republic");
  expect(battle.lostShipIds.length).toBeGreaterThanOrEqual(1);

  const diplomacy = (await execute(page, "inspectDiplomacyScreen", sessionId)) as BridgeResultLike;
  expect(diplomacy.outcome).toBe("success");
  const war = (diplomacy.value as DiplomacyLike).wars.find((w) =>
    w.warId.startsWith("war_uk_france"),
  );
  expect(war).toBeDefined();
  expect(war!.attackerWarScore !== 0 || war!.defenderWarScore !== 0).toBe(true);

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
