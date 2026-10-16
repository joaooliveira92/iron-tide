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

/** Every key the turn-message projection can emit (parity with @bluewave/messages policy). */
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
  "messages.decision.title",
  "messages.decision.body",
  "messages.system.unknown.title",
  "messages.system.unknown.body",
  "messages.generic.body",
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
