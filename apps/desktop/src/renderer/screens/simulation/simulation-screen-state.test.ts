import { describe, expect, it } from "vite-plus/test";

import type {
  BattleManifest,
  BattleResolution,
  CommitMonthResponse,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";

import { initialSimulationScreenState, reduceSimulationScreen } from "./simulation-screen-state.js";

const commitResponse = {
  closingSnapshot: {
    revision: 7,
    submarinePools: [],
    minePressure: [],
    landTargetDamage: [],
  },
} as unknown as CommitMonthResponse;

const manifest = { battleId: "battle_1" } as unknown as BattleManifest;
const resolution = { battleId: "battle_1" } as unknown as BattleResolution;
const tacticalOutcome = { battleId: "battle_1" } as unknown as TacticalBattleOutcome;

describe("simulation screen state", () => {
  it("starts idle on the overview tab", () => {
    const state = initialSimulationScreenState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.activeTab).toBe("overview");
    expect(state.revision).toBe(0);
    expect(state.playerNationId).toBeNull();
    expect(state.battleManifest).toBeNull();
  });

  it("adopts the loaded revision and player nation id, and clears the loading flag", () => {
    const state = reduceSimulationScreen(
      reduceSimulationScreen(initialSimulationScreenState(), { type: "load-started" }),
      { type: "load-succeeded", revision: 12, playerNationId: "uk" },
    );
    expect(state.loading).toBe(false);
    expect(state.revision).toBe(12);
    expect(state.playerNationId).toBe("uk");
  });

  it("keeps the player nation id across battle and commit actions", () => {
    const loaded = reduceSimulationScreen(initialSimulationScreenState(), {
      type: "load-succeeded",
      revision: 3,
      playerNationId: "france",
    });
    const afterBattle = reduceSimulationScreen(loaded, {
      type: "battle-generate-started",
    });
    expect(afterBattle.playerNationId).toBe("france");
  });

  it("records a load failure without leaving the screen loading", () => {
    const state = reduceSimulationScreen(
      reduceSimulationScreen(initialSimulationScreenState(), { type: "load-started" }),
      { type: "load-failed", message: "boom" },
    );
    expect(state.loading).toBe(false);
    expect(state.error).toBe("boom");
  });

  it("adopts a committed month, resets battle outputs, and switches to the report tab", () => {
    const withBattle = reduceSimulationScreen(
      reduceSimulationScreen(initialSimulationScreenState(), {
        type: "battle-succeeded",
        manifest,
      }),
      { type: "resolve-succeeded", resolution },
    );

    const committed = reduceSimulationScreen(withBattle, {
      type: "commit-succeeded",
      response: commitResponse,
    });

    expect(committed.revision).toBe(7);
    expect(committed.commitResult).toBe(commitResponse);
    expect(committed.battleManifest).toBeNull();
    expect(committed.autoResolution).toBeNull();
    expect(committed.tacticalOutcome).toBeNull();
    expect(committed.activeTab).toBe("report");
    expect(committed.loading).toBe(false);
  });

  it("clears the error and stops loading on a commit failure", () => {
    const started = reduceSimulationScreen(initialSimulationScreenState(), {
      type: "commit-started",
    });
    const failed = reduceSimulationScreen(started, {
      type: "commit-failed",
      message: "nope",
    });
    expect(failed.loading).toBe(false);
    expect(failed.error).toBe("nope");
  });

  it("clears stale battle outputs when a new battle is generated", () => {
    const primed = reduceSimulationScreen(
      reduceSimulationScreen(initialSimulationScreenState(), {
        type: "resolve-succeeded",
        resolution,
      }),
      { type: "tactical-succeeded", outcome: tacticalOutcome },
    );

    const generating = reduceSimulationScreen(primed, { type: "battle-generate-started" });

    expect(generating.battleLoading).toBe(true);
    expect(generating.battleError).toBeNull();
    expect(generating.autoResolution).toBeNull();
    expect(generating.tacticalOutcome).toBeNull();
  });

  it("keeps prior resolutions while a resolve is running", () => {
    const primed = reduceSimulationScreen(initialSimulationScreenState(), {
      type: "resolve-succeeded",
      resolution,
    });

    const resolving = reduceSimulationScreen(primed, { type: "battle-resolve-started" });

    expect(resolving.battleLoading).toBe(true);
    expect(resolving.autoResolution).toBe(resolution);
  });

  it("records each battle outcome on its own slot", () => {
    const generated = reduceSimulationScreen(initialSimulationScreenState(), {
      type: "battle-succeeded",
      manifest,
    });
    expect(generated.battleManifest).toBe(manifest);
    expect(generated.battleLoading).toBe(false);

    const resolved = reduceSimulationScreen(generated, {
      type: "resolve-succeeded",
      resolution,
    });
    expect(resolved.autoResolution).toBe(resolution);

    const tactical = reduceSimulationScreen(resolved, {
      type: "tactical-succeeded",
      outcome: tacticalOutcome,
    });
    expect(tactical.tacticalOutcome).toBe(tacticalOutcome);
  });

  it("records a battle failure and stops the battle spinner", () => {
    const failed = reduceSimulationScreen(initialSimulationScreenState(), {
      type: "battle-failed",
      message: "no manifest",
    });
    expect(failed.battleLoading).toBe(false);
    expect(failed.battleError).toBe("no manifest");
  });

  it("selects a tab", () => {
    const state = reduceSimulationScreen(initialSimulationScreenState(), {
      type: "tab-selected",
      tab: "battle",
    });
    expect(state.activeTab).toBe("battle");
  });
});
