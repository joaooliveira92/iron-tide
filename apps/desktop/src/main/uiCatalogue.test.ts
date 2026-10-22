import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import type { UiCatalogueDto } from "../shared/content-contract.js";
import { dispatchCampaignCommand } from "./campaignBridge.js";

const REPO_ROOT = resolve(process.cwd(), "../..");
const CATALOGUE_PATH = resolve(REPO_ROOT, "content", "production", "1880", "ui", "en-US.yaml");

interface AuthoredCatalogue {
  locale: string;
  strings: Record<string, string>;
}

const authored = parse(readFileSync(CATALOGUE_PATH, "utf8")) as AuthoredCatalogue;

const REQUIRED_KEYS = [
  "messages.finance.budgetChanged.title",
  "messages.finance.budgetChanged.body",
  "messages.finance.deficit.title",
  "messages.finance.deficit.body",
  "messages.finance.noChange.title",
  "messages.finance.noChange.body",
  "messages.construction.progress.title",
  "messages.construction.progress.body",
  "messages.construction.noProgress.title",
  "messages.construction.noProgress.body",
  "messages.construction.rebuilt.title",
  "messages.construction.rebuilt.body",
  "messages.construction.delayed.title",
  "messages.construction.delayed.body",
  "messages.construction.cancelled.title",
  "messages.construction.cancelled.body",
  "messages.research.progress.title",
  "messages.research.progress.body",
  "messages.research.noProgress.title",
  "messages.research.noProgress.body",
  "messages.research.breakthrough.title",
  "messages.research.breakthrough.body",
  "messages.battle.initiated.title",
  "messages.battle.initiated.body",
  "messages.battle.resolved.title",
  "messages.battle.resolved.body",
  "messages.battle.request.title",
  "messages.battle.request.body",
  "messages.offer.request.title",
  "messages.offer.request.body",
  "messages.battle.declined.title",
  "messages.battle.declined.body",
  "messages.battle.declineThreshold.title",
  "messages.battle.declineThreshold.body",
  "messages.battle.enemyDeclined.title",
  "messages.battle.enemyDeclined.body",
  "messages.prestige.changed.title",
  "messages.prestige.changed.body",
  "ui.offer.support.present",
  "ui.offer.support.presentFrom",
  "ui.offer.support.absent",
  "ui.offer.decline.costsVictoryPoints",
  "ui.offer.decline.mayCostPrestige",
  "messages.decision.title",
  "messages.decision.body",
  "messages.system.unknown.title",
  "messages.system.unknown.body",
  "messages.generic.body",
  "ui.turnSummary.title",
  "ui.turnSummary.loading",
  "ui.turnSummary.empty",
  "ui.turnSummary.searchPlaceholder",
  "ui.turnSummary.searchLabel",
  "ui.turnSummary.allCategories",
  "ui.turnSummary.categoryLabel",
  "ui.turnSummary.allSeverities",
  "ui.turnSummary.severityLabel",
  "ui.turnSummary.actionable",
  "ui.turnSummary.details",
  "ui.turnSummary.less",
  "ui.turnSummary.pin",
  "ui.turnSummary.unpin",
  "ui.turnSummary.read",
  "ui.turnSummary.unread",
  "ui.turnSummary.noMatch",
  "ui.turnSummary.sources",
  "ui.turnSummary.unavailableEntity",
  "ui.turnSummary.category.DECISION",
  "ui.turnSummary.category.DIPLOMACY",
  "ui.turnSummary.category.WAR",
  "ui.turnSummary.category.BATTLE",
  "ui.turnSummary.category.CONSTRUCTION",
  "ui.turnSummary.category.RESEARCH",
  "ui.turnSummary.category.INTELLIGENCE",
  "ui.turnSummary.category.FINANCE",
  "ui.turnSummary.category.SYSTEM",
  "ui.turnSummary.severity.CRITICAL",
  "ui.turnSummary.severity.HIGH",
  "ui.turnSummary.severity.NORMAL",
  "ui.turnSummary.severity.LOW",
  "ui.turnSummary.severity.TRACE",
  "ui.decision.choose",
  "ui.decision.hint",
  "ui.decision.result",
  "ui.decision.result.treasury",
  "ui.decision.result.noEffect",
  "ui.effect.direction.increase",
  "ui.effect.direction.decrease",
  "ui.effect.direction.none",
  "ui.effect.magnitude.minor",
  "ui.effect.magnitude.moderate",
  "ui.effect.magnitude.major",
  "ui.battle.accept",
  "ui.battle.decline",
  "ui.battle.delegate",
  "ui.interruption.abandon",
  "ui.pendingTurn.label",
  "ui.pendingTurn.unavailableTitle",
  "ui.pendingTurn.unavailableBody",
  "ui.pendingTurn.title",
  "ui.pendingTurn.body",
  "ui.pendingTurn.bodyWithDate",
  "ui.pendingTurn.resume",
  "ui.pendingTurn.discard",
] as const;

describe("UI catalogue over the content IPC (ADR-0209)", () => {
  it("serves the authored en-US catalogue as a data-only DTO", async () => {
    const result = await dispatchCampaignCommand("inspectUiCatalogue", undefined);
    expect(result.outcome).toBe("success");
    const dto = (result as { value: UiCatalogueDto }).value;
    expect(dto.locale).toBe("en-US");
    expect(dto.strings).toEqual(authored.strings);
  });

  it("covers every key the projection emits", () => {
    for (const key of REQUIRED_KEYS) {
      expect(authored.strings[key], `missing catalogue key: ${key}`).toBeDefined();
    }
  });

  it("emits no raw-key placeholders", () => {
    for (const [key, text] of Object.entries(authored.strings)) {
      expect(text.trim().length, `empty text for ${key}`).toBeGreaterThan(0);
    }
  });
});
