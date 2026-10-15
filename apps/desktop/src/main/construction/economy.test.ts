import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignState } from "@bluewave/campaign";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import {
  DOCK_EXPANSION_BASE_DURATION_MONTHS,
  builderDockRecord,
  constructionCapacityUtilization,
  dockExpansionEraStepForMonth,
  nationalConstructionCapacity,
} from "@bluewave/phase-engine";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { toSaveableState } from "../saveHelpers.js";
import { loadShipBuildingContent } from "../shipBuildingContent.js";
import { constructionEconomy } from "./economy.js";
import { campaignMonthKey } from "./commandRecord.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

/**
 * SB3-R33: the construction economy projection carries the compiled dock/capacity readouts. Every value is
 * cross-checked against the engine function it must come from (not a hardcoded number), so a fabricated constant in the
 * desktop layer fails the test.
 */
describe("constructionEconomy dock/capacity readouts", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-economy-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  function registerProductionSession(sessionId: string, saveDir: string): CampaignState {
    const signal = new AbortController().signal;
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });
    return state;
  }

  it("derives the dock size, cap, utilisation split and expansion figures from the engine", () => {
    registerProductionSession("s-economy", resolve(saveRoot, "save"));
    const record = getCampaignSession("s-economy")!;
    const economy = constructionEconomy(record);

    const monthId = campaignMonthKey(record);
    expect(monthId).toBe("1880-01");
    const content = loadShipBuildingContent();
    const dock = builderDockRecord(record.state.snapshot, "uk", content, monthId)!;
    const dockMaxMassKg = dock.maximumNewConstructionMassKg ?? 0;

    expect(dockMaxMassKg).toBeGreaterThan(0);
    expect(economy.dockMaxBuildDisplacementKg).toBe(dockMaxMassKg);

    const balance = content.environmentFor(monthId, "uk").constructionBalance;
    const capacity = nationalConstructionCapacity(balance, dockMaxMassKg);
    const util = constructionCapacityUtilization(record.state.snapshot, "uk", capacity);
    expect(economy.maxConcurrentConstructionMassKg).toBe(capacity.maxConcurrentMassKg);
    expect(economy.committedNewConstructionMassKg).toBe(util.committedMassKg);
    expect(economy.exemptNewConstructionMassKg).toBe(util.exemptMassKg);

    expect(economy.dockExpansionDurationMonths).toBe(DOCK_EXPANSION_BASE_DURATION_MONTHS);
    expect(economy.dockExpansionDurationMonths).toBe(12);
    expect(economy.dockExpansionNextStepKg).toBe(dockExpansionEraStepForMonth(monthId));
    expect(economy.dockExpansionNextStepKg).not.toBeNull();
  });

  it("lists the nation's ports ascending by id as the expansion targets", () => {
    registerProductionSession("s-ports", resolve(saveRoot, "save"));
    const record = getCampaignSession("s-ports")!;
    const economy = constructionEconomy(record);

    const expected = record.state.snapshot.world.ports
      .filter((port) => port.nationId === "uk")
      .map((port) => ({ id: port.id, name: port.name }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(economy.dockPossessions.length).toBeGreaterThan(0);
    expect(economy.dockPossessions).toEqual(expected);
    expect([...economy.dockPossessions].map((p) => p.id)).toEqual(
      [...economy.dockPossessions].map((p) => p.id).sort(),
    );
  });
});
