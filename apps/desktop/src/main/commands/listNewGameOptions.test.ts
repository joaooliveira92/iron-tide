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

// Ticket 02/06's research: content/production/1880 has 14 nations, 10
// playable, and 5 zero-design/zero-construction nations (spain plus 4
// non-playable). See docs/research/content-4-desktop-mvp-pack-readiness.md.
const ZERO_CONTENT_NATIONS = ["spain", "ottoman_empire", "netherlands", "portugal", "brazil"];

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

  it("excludes Spain and the 4 other zero-design/zero-construction nations from playerSlotId", async () => {
    const result = await listNewGameOptions(GENERATED_ARTIFACT);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    const playerSlotId = result.value.supportedValues.playerSlotId;
    for (const excluded of ZERO_CONTENT_NATIONS) {
      expect(playerSlotId).not.toContain(excluded);
    }
    // uk has both designs and construction projects; still a valid slot.
    expect(playerSlotId).toContain("uk");
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
