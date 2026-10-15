import type { Page } from "@playwright/test";
import { SEED, test, expect } from "./fixtures.js";
import { advanceMonths, dismissTour, startNewCampaign } from "./flows.js";

/**
 * Debug-only acceptance slice (Ticket 01): the player path from declaring war
 * through a CAMPAIGN-GENERATED battle to a surfaced, state-changing result.
 *
 * It runs only against a `VITE_BLUEWAVE_DEBUG=true` build (see
 * `playwright.debug.config.ts`): the drill command and the debug UI (session id
 * in the Overview heading) are debug-gated. The default `pnpm test:e2e` ignores
 * `*.debug.spec.ts` so a normal build stays green.
 *
 * Hard constraints honoured:
 *  - war is declared through the real Diplomacy UI (queued engine envelope);
 *  - the battle is NOT injected: the real month phases `battle_generation`
 *    (order 7.5) + `battle_resolution` (order 8) generate and resolve it on the
 *    second advance;
 *  - the debug drill only does what a real turn cannot with today's content:
 *    co-locate the belligerents' fleets (movement is unimplemented) and scale
 *    their `firepower` for the engine's eligibility floors.
 */

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

/** The debug Overview heading embeds the session id: "… · Session <uuid>". */
async function readSessionId(page: Page): Promise<string> {
  const heading = page.locator("h1").first();
  await expect(heading).toContainText("Session");
  const text = (await heading.textContent()) ?? "";
  const match = text.match(/Session ([0-9a-f-]{36})/i);
  if (match === null) throw new Error(`No session id in Overview heading: ${text}`);
  return match[1];
}

/** The minimal preload surface this spec drives (see `src/preload/index.ts`). */
interface BluewaveBridgeLike {
  readonly campaign: {
    execute(command: string, payload: unknown): Promise<BridgeResultLike>;
  };
}

/** Invokes a main-process command through the preload bridge, as a screen would. */
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

test("declared war → generated battle → resolved and surfaced in campaign state", async ({
  e2e,
}) => {
  const { page } = e2e;

  // The fail-safe path must stay clean: no renderer console errors / page errors.
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  // 1. Start a real campaign (fixed seed → deterministic month outcomes).
  await startNewCampaign(page, { seed: SEED });
  await expect(page.getByRole("heading", { name: "Campaign Overview" })).toBeVisible({
    timeout: 30_000,
  });
  await dismissTour(page);
  const sessionId = await readSessionId(page);

  // 2. Declare war on France through the real UI (a queued engine envelope).
  await page
    .getByTestId("bottom-nav")
    .getByRole("button", { name: "Diplomacy & War", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Diplomacy & War" })).toBeVisible();

  const franceRow = page
    .getByText("French Republic", { exact: true })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'rounded-md')][1]");
  await franceRow.getByRole("button", { name: "Declare war" }).click();

  // The draft warns it takes effect on the next advance; submit it.
  const queueAlert = page.getByRole("alert").filter({ hasText: /cannot be cancelled/ });
  await expect(queueAlert).toBeVisible();
  await queueAlert.locator("xpath=..").getByRole("button", { name: "Declare war" }).click();
  await expect(page.getByText("Command queued", { exact: true })).toBeVisible();

  // 3. Advance one month: command_collection applies the declaration (the war
  // becomes DECLARED_NOT_ACTIVE) and weather_generation commits the month's
  // strategic weather.
  await advanceMonths(page, 1);

  // 4. Stage the live session (debug-only, IPC-validated): co-locate the
  // belligerents and lift their firepower over the engine's eligibility floors.
  // No battle is injected — the drill only prepares the snapshot.
  const drill = await execute(page, "seedCampaignBattleDrill", { sessionId });
  expect(drill, JSON.stringify(drill)).toMatchObject({ outcome: "success" });

  // 5. Advance again: the REAL month phases generate AND resolve the battle,
  // applying real consequences (war score / per-ship losses / history).
  await advanceMonths(page, 1);

  // 6. Re-enter the screen so its projections refetch at the new revision.
  await page
    .getByTestId("bottom-nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page
    .getByTestId("bottom-nav")
    .getByRole("button", { name: "Diplomacy & War", exact: true })
    .click();

  // 7. Surfaced result: a resolved battle, not the empty state.
  await expect(page.getByText("No battles fought yet")).not.toBeVisible();
  const summary = page.getByTestId("battle-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(/battle/);
  await expect(page.getByTestId("war-score-bar")).toBeVisible();

  // 8. Campaign state (engine truth) reflects the resolved battle.
  const history = (await execute(page, "inspectBattleHistory", sessionId)) as BridgeResultLike;
  expect(history.outcome).toBe("success");
  const view = history.value as BattleHistoryLike;
  const playerBattles = view.history.battles.filter((b) => b.involvesPlayer);
  expect(playerBattles.length).toBeGreaterThanOrEqual(1);
  const battle = playerBattles[0]!;
  expect(battle.attackerName).toBe("United Kingdom");
  expect(battle.defenderName).toBe("French Republic");
  // Per-ship consequences landed in the campaign snapshot (losses recorded).
  expect(battle.lostShipIds.length).toBeGreaterThanOrEqual(1);

  // A decided battle moved the war score off its all-zero declaration state.
  const diplomacy = (await execute(page, "inspectDiplomacyScreen", sessionId)) as BridgeResultLike;
  expect(diplomacy.outcome).toBe("success");
  const war = (diplomacy.value as DiplomacyLike).wars.find((w) =>
    w.warId.startsWith("war_uk_france"),
  );
  expect(war).toBeDefined();
  // War score is a two-sided tug-of-war (winner +m, loser -m): a decided battle
  // moves both off the all-zero declaration state.
  expect(war!.attackerWarScore !== 0 || war!.defenderWarScore !== 0).toBe(true);

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
