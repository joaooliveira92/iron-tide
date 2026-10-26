import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { SaveStore } from "@bluewave/persistence";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { CampaignConfiguration } from "@bluewave/campaign-engine";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { CompileCampaignResult } from "../../shared/campaign-contract.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { IdGenerator, NativeDialog } from "../runtime/platform.js";
import { compileCampaignProgram } from "./compileCampaign.js";

let chooseSaveDirectoryAnswer: string | null = null;
let chooseSaveDirectoryCalls = 0;

let idCounter = 0;
const nextTestId = () => `test-session-${String(idCounter++)}`;

const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    desktopMainLayer(),
    Layer.succeed(NativeDialog, {
      chooseSaveDirectory: () => {
        chooseSaveDirectoryCalls += 1;
        return Effect.succeed(chooseSaveDirectoryAnswer);
      },
      choosePackageDirectory: () => Effect.succeed(null),
      chooseCopyDirectory: () => Effect.succeed(null),
    }),
    Layer.succeed(IdGenerator, { next: () => Effect.sync(nextTestId) }),
  ),
);

async function compileCampaign(
  configuration: CampaignConfiguration,
): Promise<BridgeResult<CompileCampaignResult>> {
  return projectCommandExit(
    await runtime.runPromiseExit(compileCampaignProgram(configuration)),
  ) as BridgeResult<CompileCampaignResult>;
}

function baseConfiguration(overrides: Partial<CampaignConfiguration> = {}): CampaignConfiguration {
  return {
    scenarioId: "scen_1880",
    playerSlotId: "uk",
    continuityModeId: "historical",
    fleetSizeSettingId: "standard",
    researchSpeedSettingId: "standard",
    technologyVariationSettingId: "none",
    historicalBudgetOptionId: "standard",
    legacyFleetModeId: "historical",
    tacticalRealismModeId: "standard",
    difficultyProfileId: "easy",
    campaignSeed: "a".repeat(32),
    configurationSchemaVersion: "campaign_configuration_v1",
    ...overrides,
  } as CampaignConfiguration;
}

describe("compileCampaign", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-compile-"));
    chooseSaveDirectoryAnswer = resolve(saveRoot, "save");
    chooseSaveDirectoryCalls = 0;
    idCounter = 0;
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
  });

  it("compiles the real production pack, saves it, and returns a session id", async () => {
    const result = await compileCampaign(baseConfiguration());
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    expect(typeof result.value.sessionId).toBe("string");
    expect(result.value.sessionId.length).toBeGreaterThan(0);
  });

  it("takes the session id from the injected IdGenerator (deterministic in tests)", async () => {
    const result = await compileCampaign(baseConfiguration());
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    expect(result.value.sessionId).toBe("test-session-0");
  });

  it("round-trips nations/designs/designFamilies through SaveStore.load intact (Map-serialization fix)", async () => {
    const saveDir = resolve(saveRoot, "save");
    const result = await compileCampaign(baseConfiguration());
    expect(result.outcome).toBe("success");

    const store = new SaveStore();
    const loaded = Effect.runSync(store.load(saveDir)).state;

    expect(loaded.snapshot.nations).toBeInstanceOf(Map);
    expect(loaded.snapshot.nations.size).toBe(14);
    expect(loaded.snapshot.nations.get("uk")?.name).toBe("United Kingdom");

    expect(loaded.snapshot.designs).toBeInstanceOf(Map);
    expect(loaded.snapshot.designs.size).toBeGreaterThan(0);

    expect(loaded.snapshot.designFamilies).toBeInstanceOf(Map);
    expect(loaded.snapshot.designFamilies.size).toBeGreaterThan(0);

    expect(loaded.snapshot.nations.get("uk")?.research.activeCandidates).toBeInstanceOf(Map);
  });

  it("rejects a configuration that fails DESIGN-03 validation before compiling anything", async () => {
    const result = await compileCampaign(baseConfiguration({ campaignSeed: "not-hex" }));
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("INVALID_CAMPAIGN_CONFIGURATION");
    expect(chooseSaveDirectoryCalls).toBe(0);
  });

  it("accepts Spain — a playable nation with 1880 content — as a player slot", async () => {
    const result = await compileCampaign(baseConfiguration({ playerSlotId: "spain" }));
    expect(result.outcome).toBe("success");
  });

  it("rejects a non-playable nation as a player slot", async () => {
    const result = await compileCampaign(baseConfiguration({ playerSlotId: "ottoman_empire" }));
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("PLAYER_SLOT_NOT_SUPPORTED");
    expect(chooseSaveDirectoryCalls).toBe(0);
  });

  it("rejects an unknown player slot", async () => {
    const result = await compileCampaign(baseConfiguration({ playerSlotId: "atlantis" }));
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("UNKNOWN_PLAYER_SLOT");
  });

  it("rejects without writing a save when the user cancels the save-location dialog", async () => {
    chooseSaveDirectoryAnswer = null;
    const result = await compileCampaign(baseConfiguration());
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("SAVE_LOCATION_CANCELLED");
  });
});
