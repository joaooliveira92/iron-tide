/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  BattleManifest,
  BattleResolution,
  ReplayBattleBoundaryResponse,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../../../preload/index.js";
import { SandboxProvider } from "./SandboxProvider.js";
import { useSandbox } from "./sandbox-context.js";

const manifest = { battleId: "battle_1" } as unknown as BattleManifest;

const resolution = { battleId: "battle_1" } as unknown as BattleResolution;

const outcome = {
  battleId: "battle_1",
  turnsResolved: 12,
} as unknown as TacticalBattleOutcome;

const boundaryReplay: ReplayBattleBoundaryResponse = {
  matches: true,
  diagnostics: ["boundary matches"],
};

const generateBattle = vi.fn();
const resolveBattle = vi.fn();
const resolveTacticalBattle = vi.fn();
const replayBattleBoundary = vi.fn();

const execute = vi.fn(async (name: string, input: unknown) => {
  switch (name) {
    case "generateBattle":
      return generateBattle(input);
    case "resolveBattle":
      return resolveBattle(input);
    case "resolveTacticalBattle":
      return resolveTacticalBattle(input);
    case "replayBattleBoundary":
      return replayBattleBoundary(input);
    default:
      throw new Error(`unexpected command: ${name}`);
  }
});

const bridge = { campaign: { execute } } as unknown as BluewaveDesktopBridge;

function Probe() {
  const { state, actions } = useSandbox();
  return (
    <div>
      <span data-testid="warId">{state.warId}</span>
      <span data-testid="turnCount">{state.turnCount}</span>
      <span data-testid="manifest">{state.manifest?.battleId ?? "none"}</span>
      <span data-testid="autoResolution">{state.autoResolution?.battleId ?? "none"}</span>
      <span data-testid="tacticalOutcome">{state.tacticalOutcome?.battleId ?? "none"}</span>
      <span data-testid="boundaryReplay">
        {state.boundaryReplay === null ? "none" : String(state.boundaryReplay.matches)}
      </span>
      <span data-testid="generateError">{state.generateError ?? "none"}</span>
      <span data-testid="resolveError">{state.resolveError ?? "none"}</span>
      <span data-testid="boundaryReplayError">{state.boundaryReplayError ?? "none"}</span>
      <button onClick={() => actions.generateBattle()}>generate</button>
      <button onClick={() => actions.autoResolve()}>auto-resolve</button>
      <button onClick={() => actions.tacticalResolve()}>tactical-resolve</button>
      <button onClick={() => actions.replayBoundary()}>replay-boundary</button>
      <button onClick={() => actions.updateWarId("war_custom")}>update-war</button>
      <button onClick={() => actions.updateTurnCount(50)}>update-turns</button>
      <button onClick={() => actions.updateScriptedOrdersText("not json")}>invalid-orders</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <SandboxProvider sessionId="session-1">
      <Probe />
    </SandboxProvider>,
  );
}

describe("SandboxProvider", () => {
  const originalBridge = window.bluewave;

  afterEach(() => {
    cleanup();
    if (originalBridge === undefined) {
      delete window.bluewave;
    } else {
      window.bluewave = originalBridge;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.bluewave = bridge;
  });

  it("exposes the initial screen state", () => {
    renderProvider();
    expect(screen.getByTestId("warId").textContent).toBe("war_uk_germany");
    expect(screen.getByTestId("turnCount").textContent).toBe("200");
    expect(screen.getByTestId("manifest").textContent).toBe("none");
    expect(screen.getByTestId("generateError").textContent).toBe("none");
  });

  it("updates the war id and turn budget through actions", () => {
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "update-war" }));
    fireEvent.click(screen.getByRole("button", { name: "update-turns" }));
    expect(screen.getByTestId("warId").textContent).toBe("war_custom");
    expect(screen.getByTestId("turnCount").textContent).toBe("50");
  });

  it("generates a battle through the bridge and records the manifest", async () => {
    generateBattle.mockResolvedValue({
      outcome: "success",
      value: { manifest },
    });
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    await waitFor(() => expect(screen.getByTestId("manifest").textContent).toBe("battle_1"));
    expect(generateBattle).toHaveBeenCalledWith({
      sessionId: "session-1",
      warId: "war_uk_germany",
    });
    expect(screen.getByTestId("generateError").textContent).toBe("none");
  });

  it("records a generation failure without a manifest", async () => {
    generateBattle.mockResolvedValue({
      outcome: "rejected",
      reason: "WAR_NOT_FOUND",
      diagnostics: [],
    });
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    await waitFor(() =>
      expect(screen.getByTestId("generateError").textContent).toBe("WAR_NOT_FOUND"),
    );
    expect(screen.getByTestId("manifest").textContent).toBe("none");
  });

  it("auto-resolves the generated battle through the bridge", async () => {
    generateBattle.mockResolvedValue({
      outcome: "success",
      value: { manifest },
    });
    resolveBattle.mockResolvedValue({
      outcome: "success",
      value: { resolution },
    });
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    await waitFor(() => expect(screen.getByTestId("manifest").textContent).toBe("battle_1"));
    fireEvent.click(screen.getByRole("button", { name: "auto-resolve" }));
    await waitFor(() => expect(screen.getByTestId("autoResolution").textContent).toBe("battle_1"));
    expect(resolveBattle).toHaveBeenCalledWith({
      sessionId: "session-1",
      battleId: "battle_1",
    });
  });

  it("runs the tactical resolver with the scripted orders", async () => {
    generateBattle.mockResolvedValue({
      outcome: "success",
      value: { manifest },
    });
    resolveTacticalBattle.mockResolvedValue({
      outcome: "success",
      value: { outcome },
    });
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    await waitFor(() => expect(screen.getByTestId("manifest").textContent).toBe("battle_1"));
    fireEvent.click(screen.getByRole("button", { name: "tactical-resolve" }));
    await waitFor(() => expect(screen.getByTestId("tacticalOutcome").textContent).toBe("battle_1"));
    expect(resolveTacticalBattle).toHaveBeenCalledWith({
      sessionId: "session-1",
      battleId: "battle_1",
      turnCount: 200,
      scriptedOrders: [
        {
          issueTurn: 1,
          divisionId: "Channel Squadron",
          orderType: "change_lead_division",
          newLeadShipId: "HMS Majestic",
        },
      ],
    });
  });

  it("rejects unparseable scripted orders without calling the bridge", async () => {
    generateBattle.mockResolvedValue({
      outcome: "success",
      value: { manifest },
    });
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    await waitFor(() => expect(screen.getByTestId("manifest").textContent).toBe("battle_1"));
    fireEvent.click(screen.getByRole("button", { name: "invalid-orders" }));
    fireEvent.click(screen.getByRole("button", { name: "tactical-resolve" }));
    await waitFor(() => expect(screen.getByTestId("resolveError").textContent).not.toBe("none"));
    expect(resolveTacticalBattle).not.toHaveBeenCalled();
  });

  it("replays the battle boundary through the bridge", async () => {
    generateBattle.mockResolvedValue({
      outcome: "success",
      value: { manifest },
    });
    replayBattleBoundary.mockResolvedValue({
      outcome: "success",
      value: boundaryReplay,
    });
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    await waitFor(() => expect(screen.getByTestId("manifest").textContent).toBe("battle_1"));
    fireEvent.click(screen.getByRole("button", { name: "replay-boundary" }));
    await waitFor(() => expect(screen.getByTestId("boundaryReplay").textContent).toBe("true"));
    expect(replayBattleBoundary).toHaveBeenCalledWith({
      sessionId: "session-1",
      battleId: "battle_1",
    });
  });

  it("records a boundary replay failure", async () => {
    generateBattle.mockResolvedValue({
      outcome: "success",
      value: { manifest },
    });
    replayBattleBoundary.mockResolvedValue({
      outcome: "rejected",
      reason: "REPLAY_DIVERGED",
      diagnostics: [],
    });
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    await waitFor(() => expect(screen.getByTestId("manifest").textContent).toBe("battle_1"));
    fireEvent.click(screen.getByRole("button", { name: "replay-boundary" }));
    await waitFor(() =>
      expect(screen.getByTestId("boundaryReplayError").textContent).toBe("REPLAY_DIVERGED"),
    );
    expect(screen.getByTestId("boundaryReplay").textContent).toBe("none");
  });

  it("generating a new battle clears prior resolutions", async () => {
    generateBattle.mockResolvedValue({
      outcome: "success",
      value: { manifest },
    });
    resolveBattle.mockResolvedValue({
      outcome: "success",
      value: { resolution },
    });
    renderProvider();
    const generate = screen.getByRole("button", { name: "generate" });
    fireEvent.click(generate);
    await waitFor(() => expect(screen.getByTestId("manifest").textContent).toBe("battle_1"));
    fireEvent.click(screen.getByRole("button", { name: "auto-resolve" }));
    await waitFor(() => expect(screen.getByTestId("autoResolution").textContent).toBe("battle_1"));
    fireEvent.click(generate);
    await waitFor(() => expect(screen.getByTestId("autoResolution").textContent).toBe("none"));
  });
});
