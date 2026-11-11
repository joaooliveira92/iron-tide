import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CampaignConfiguration } from "@bluewave/campaign-engine";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  CompileCampaignResult,
  ExportGenerationReportResult,
} from "../../shared/campaign-contract.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { IdGenerator, NativeDialog } from "../runtime/platform.js";
import { compileCampaignProgram } from "./compileCampaign.js";
import { exportGenerationReportProgram } from "./exportGenerationReport.js";

let chooseSaveDirectoryAnswer: string | null = null;
let idCounter = 0;

const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    desktopMainLayer(),
    Layer.succeed(NativeDialog, {
      chooseSaveDirectory: () => Effect.succeed(chooseSaveDirectoryAnswer),
      choosePackageDirectory: () => Effect.succeed(null),
      chooseCopyDirectory: () => Effect.succeed(null),
    }),
    Layer.succeed(IdGenerator, { next: () => Effect.sync(() => `report-session-${idCounter++}`) }),
  ),
);

async function compile(
  configuration: CampaignConfiguration,
): Promise<BridgeResult<CompileCampaignResult>> {
  return projectCommandExit(
    await runtime.runPromiseExit(compileCampaignProgram(configuration)),
  ) as BridgeResult<CompileCampaignResult>;
}

async function exportReport(
  sessionId: string,
): Promise<BridgeResult<ExportGenerationReportResult>> {
  return projectCommandExit(
    await runtime.runPromiseExit(exportGenerationReportProgram(sessionId)),
  ) as BridgeResult<ExportGenerationReportResult>;
}

function configuration(overrides: Partial<CampaignConfiguration> = {}): CampaignConfiguration {
  return {
    scenarioId: "scen_1880",
    playerSlotId: "uk",
    continuityModeId: "historical",
    fleetSizeSettingId: "standard",
    researchSpeedSettingId: "standard",
    technologyVariationSettingId: "none",
    historicalBudgetOptionId: "standard",
    legacyFleetModeId: "generated",
    tacticalRealismModeId: "standard",
    difficultyProfileId: "easy",
    campaignSeed: "b".repeat(32),
    configurationSchemaVersion: "campaign_configuration_v1",
    ...overrides,
  } as CampaignConfiguration;
}

describe("exportGenerationReport", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-report-"));
    chooseSaveDirectoryAnswer = resolve(saveRoot, "save");
    idCounter = 0;
    vi.stubGlobal("__BLUEWAVE_DEBUG__", true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(saveRoot, { recursive: true, force: true });
  });

  it("returns the generator report for a freshly generated campaign", async () => {
    const compiled = await compile(configuration());
    expect(compiled.outcome).toBe("success");
    if (compiled.outcome !== "success") return;

    const result = await exportReport(compiled.value.sessionId);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    expect(result.value.report.campaignSeed).toBe("b".repeat(32));
    expect(result.value.report.nations.length).toBeGreaterThan(0);
    expect(result.value.report.nations.every((nation) => nation.generated >= 0)).toBe(true);
  }, 120_000);

  it("rejects with a domain reason when the campaign used the historical fleet", async () => {
    const compiled = await compile(configuration({ legacyFleetModeId: "historical" }));
    expect(compiled.outcome).toBe("success");
    if (compiled.outcome !== "success") return;

    const result = await exportReport(compiled.value.sessionId);
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("NO_GENERATION_REPORT");
    expect(result.diagnostics[0]).toMatch(/historical/i);
  });

  it("is available only in a debug build", async () => {
    const compiled = await compile(configuration({ legacyFleetModeId: "historical" }));
    expect(compiled.outcome).toBe("success");
    if (compiled.outcome !== "success") return;

    vi.stubGlobal("__BLUEWAVE_DEBUG__", false);
    const result = await exportReport(compiled.value.sessionId);
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("DEBUG_ONLY");
  });
});
