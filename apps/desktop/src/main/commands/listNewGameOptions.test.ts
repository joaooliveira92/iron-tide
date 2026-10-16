import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ManagedRuntime } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { NewGameOptions } from "../../shared/new-game-contract.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { contentArtifactLayer } from "../runtime/contentArtifact.js";
import { listNewGameOptionsProgram } from "./listNewGameOptions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

/** Runs the program through a per-test runtime and projects the wire envelope. */
async function listNewGameOptions(artifactDir: string): Promise<BridgeResult<NewGameOptions>> {
  const runtime = ManagedRuntime.make(contentArtifactLayer(artifactDir));
  try {
    return projectCommandExit(await runtime.runPromiseExit(listNewGameOptionsProgram));
  } finally {
    await runtime.dispose();
  }
}

describe("listNewGameOptions", () => {
  it("runs New Game preferences against real content/production/1880 data", async () => {
    const result = await listNewGameOptions(GENERATED_ARTIFACT);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    expect(result.value.scenarios).toHaveLength(1);
    expect(result.value.scenarios[0]?.id).toBe("scen_1880");
    expect(result.value.scenarios[0]?.startYear).toBe(1880);
    expect(result.value.scenarios[0]?.startMonth).toBe(1);
    expect(result.value.scenarios[0]?.participantNationIds).toHaveLength(14);

    expect(result.value.nations).toHaveLength(14);
    expect(result.value.nations.some((n) => n.id === "uk")).toBe(true);
    expect(result.value.nations.some((n) => n.id === "spain")).toBe(true);
    const uk = result.value.nations.find((n) => n.id === "uk");
    expect(uk?.regimeType).toBe("constitutional_monarchy");
    expect(uk?.regimeName).toBe("Constitutional Monarchy");
  });

  it("offers only the content-backed 1880 scenario and the ten-nation playable roster", async () => {
    const result = await listNewGameOptions(GENERATED_ARTIFACT);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    // Only 1880 is selectable; the declared 1900/1920/1935/1960 ids are not
    // offered anywhere (DR-004 / ADR-0204).
    expect(result.value.scenarios.map((scenario) => scenario.id)).toEqual(["scen_1880"]);
    expect(result.value.supportedValues.scenarioId).toEqual(["scen_1880"]);
    for (const removed of ["scen_1900", "scen_1920", "scen_1935", "scen_1960"]) {
      expect(result.value.supportedValues.scenarioId).not.toContain(removed);
    }

    // Ten playable nations per DR-013 / ADR-0214; the USA is promoted from
    // AI-only to playable.
    expect(result.value.scenarios[0]?.playableNationIds).toEqual([
      "austria_hungary",
      "france",
      "germany",
      "italy",
      "japan",
      "qing",
      "russia",
      "spain",
      "uk",
      "usa",
    ]);
  });

  it("offers every playable nation with its own content as a player slot", async () => {
    const result = await listNewGameOptions(GENERATED_ARTIFACT);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    // N-1 (f966c06) gave every 1880 nation a starting design, so the
    // zero-content "empty-nation" gap that once excluded Spain no longer applies:
    // every playable nation offers a player slot. The four AI-only nations
    // remain excluded because they are not playable.
    const playerSlotId = result.value.supportedValues.playerSlotId;
    expect([...playerSlotId].sort()).toEqual([
      "austria_hungary",
      "france",
      "germany",
      "italy",
      "japan",
      "qing",
      "russia",
      "spain",
      "uk",
      "usa",
    ]);
  });

  it("only lists supportedValues.playerSlotId nations among the scenario's playable nations", async () => {
    const result = await listNewGameOptions(GENERATED_ARTIFACT);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    const scenario = result.value.scenarios[0]!;
    for (const nationId of result.value.supportedValues.playerSlotId) {
      expect(scenario.playableNationIds).toContain(nationId);
    }
  });

  it("derives supportedValues from the real canonical id catalogs", async () => {
    const result = await listNewGameOptions(GENERATED_ARTIFACT);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    expect(result.value.supportedValues.fleetSize).toEqual([
      "small",
      "standard",
      "large",
      "very_large",
    ]);
    expect(result.value.supportedValues.researchSpeed).toEqual([
      "slow",
      "standard",
      "fast",
      "very_fast",
    ]);
    expect(result.value.supportedValues.technologyVariation).toEqual([
      "none",
      "some",
      "considerable",
    ]);
    expect(result.value.supportedValues.continuityMode).toEqual([
      "historical",
      "alternate_continuity_v1",
    ]);
  });

  it("reports a compile failure rather than fabricating options for a missing pack", async () => {
    const result = await listNewGameOptions(resolve(REPO_ROOT, "content", "does-not-exist"));
    expect(result.outcome).toBe("error");
  });
});
