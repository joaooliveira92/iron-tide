import { useCallback, useMemo, useState } from "react";

import type { BridgeResult } from "../../../../shared/bridge-contract.js";
import { useBridge } from "../../../lib/bridge-context.js";
import { parseScriptedOrders } from "../scripted-orders.js";
import {
  applyAutoResolution,
  applyBoundaryReplayed,
  applyBoundaryReplayFailed,
  applyGenerateFailed,
  applyManifestGenerated,
  applyResolveFailed,
  applyTacticalOutcome,
  beginRequest,
  initialTacticalSandboxScreenState,
  updateScriptedOrdersText,
  updateTurnCount,
  updateWarId,
  type TacticalSandboxScreenState,
} from "../tactical-sandbox-screen-state.js";
import { foldSandboxResult } from "./sandbox-command.js";
import type { SandboxActions, SandboxBridge, SandboxContextValue } from "./sandbox-context.js";

export function useSandboxController(
  sessionId: string,
  bridgeOption?: SandboxBridge,
): SandboxContextValue {
  const contextBridge = useBridge();
  const bridge = bridgeOption ?? contextBridge;
  const [state, setState] = useState(initialTacticalSandboxScreenState);

  const runCommand = useCallback(
    async <Value>(
      run: () => Promise<BridgeResult<Value>>,
      applySuccess: (state: TacticalSandboxScreenState, value: Value) => TacticalSandboxScreenState,
      applyFailure: (
        state: TacticalSandboxScreenState,
        error: string,
      ) => TacticalSandboxScreenState,
    ): Promise<void> => {
      if (bridge === undefined) return;
      setState((current) => beginRequest(current));
      try {
        const result = await run();
        setState(foldSandboxResult(result, { success: applySuccess, failure: applyFailure }));
      } catch (error) {
        setState((current) =>
          applyFailure(current, error instanceof Error ? error.message : "unknown transport error"),
        );
      }
    },
    [bridge],
  );

  const generateBattle = useCallback(async () => {
    if (bridge === undefined) return;
    await runCommand(
      () => bridge.campaign.execute("generateBattle", { sessionId, warId: state.warId }),
      (current, value) => applyManifestGenerated(current, value.manifest),
      applyGenerateFailed,
    );
  }, [bridge, runCommand, sessionId, state.warId]);

  const autoResolve = useCallback(async () => {
    const manifest = state.manifest;
    if (bridge === undefined || manifest === null) return;
    await runCommand(
      () => bridge.campaign.execute("resolveBattle", { sessionId, battleId: manifest.battleId }),
      (current, value) => applyAutoResolution(current, value.resolution),
      applyResolveFailed,
    );
  }, [bridge, runCommand, sessionId, state.manifest]);

  const tacticalResolve = useCallback(async () => {
    const manifest = state.manifest;
    if (bridge === undefined || manifest === null) return;
    const parsed = parseScriptedOrders(state.scriptedOrdersText);
    if (!parsed.ok) {
      setState((current) => applyResolveFailed(current, parsed.error));
      return;
    }
    await runCommand(
      () =>
        bridge.campaign.execute("resolveTacticalBattle", {
          sessionId,
          battleId: manifest.battleId,
          turnCount: state.turnCount,
          scriptedOrders: parsed.orders,
        }),
      (current, value) => applyTacticalOutcome(current, value.outcome),
      applyResolveFailed,
    );
  }, [bridge, runCommand, sessionId, state.manifest, state.scriptedOrdersText, state.turnCount]);

  const replayBoundary = useCallback(async () => {
    const manifest = state.manifest;
    if (bridge === undefined || manifest === null) return;
    await runCommand(
      () =>
        bridge.campaign.execute("replayBattleBoundary", {
          sessionId,
          battleId: manifest.battleId,
        }),
      applyBoundaryReplayed,
      applyBoundaryReplayFailed,
    );
  }, [bridge, runCommand, sessionId, state.manifest]);

  const actions = useMemo<SandboxActions>(
    () => ({
      updateWarId: (warId) => setState((current) => updateWarId(current, warId)),
      updateTurnCount: (turnCount) => setState((current) => updateTurnCount(current, turnCount)),
      updateScriptedOrdersText: (text) =>
        setState((current) => updateScriptedOrdersText(current, text)),
      generateBattle: () => void generateBattle(),
      autoResolve: () => void autoResolve(),
      tacticalResolve: () => void tacticalResolve(),
      replayBoundary: () => void replayBoundary(),
    }),
    [generateBattle, autoResolve, tacticalResolve, replayBoundary],
  );

  return useMemo<SandboxContextValue>(() => ({ state, actions }), [state, actions]);
}
