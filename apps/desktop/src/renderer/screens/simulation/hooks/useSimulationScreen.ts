import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type {
  BattleManifest,
  BattleResolution,
  CommitMonthResponse,
  LandTargetDamage,
  MinePressure,
  SubmarinePool,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";

import type { BluewaveDesktopBridge } from "../../../../preload/index.js";
import { useBridge } from "../../../lib/bridge-context.js";
import { envelopeOf, stampCommand } from "../../../lib/command-envelope.js";
import { auditInputFromDecisions } from "../../../lib/engine-audit.js";
import { readQuery } from "../../../lib/read-queries.js";
import { SCRIPTED_TACTICAL_ORDERS } from "../simulation-battle-orders.js";
import {
  commandFailureMessage,
  createDesktopSimulationTelemetry,
  runSimulationCommand,
  type SimulationTelemetryPort,
} from "../simulation-command.js";
import {
  initialSimulationScreenState,
  reduceSimulationScreen,
} from "../simulation-screen-state.js";
import { TACTICAL_RESOLVER_MAX_TURNS } from "../tactical-resolver.js";

export interface UseSimulationScreenReturn {
  readonly loading: boolean;
  readonly error: string | null;
  readonly activeTab: string;
  readonly playerNationId: string | null;
  readonly submarinePools: readonly SubmarinePool[];
  readonly minePressure: readonly MinePressure[];
  readonly landTargetDamage: readonly LandTargetDamage[];
  readonly commitResult: CommitMonthResponse | null;
  readonly battleManifest: BattleManifest | null;
  readonly autoResolution: BattleResolution | null;
  readonly tacticalOutcome: TacticalBattleOutcome | null;
  readonly battleLoading: boolean;
  readonly battleError: string | null;
  readonly setActiveTab: (tab: string) => void;
  readonly loadSnapshotData: () => Promise<void>;
  readonly handleAdvanceTurn: () => Promise<void>;
  readonly handleGenerateBattle: () => Promise<void>;
  readonly handleAutoResolve: () => Promise<void>;
  readonly handleTacticalResolve: () => Promise<void>;
}

export type SimulationCommandPort = Pick<BluewaveDesktopBridge, "campaign">;

export interface UseSimulationScreenOptions {
  readonly campaignRevision?: number;
  readonly onMonthCommitted?: () => void;
  readonly bridge?: SimulationCommandPort;
  readonly telemetry?: SimulationTelemetryPort;
}

export function useSimulationScreen(
  sessionId: string,
  options: UseSimulationScreenOptions = {},
): UseSimulationScreenReturn {
  const {
    campaignRevision,
    onMonthCommitted,
    bridge: bridgeOption,
    telemetry: telemetryOption,
  } = options;
  const contextBridge = useBridge();
  const bridge = bridgeOption ?? contextBridge;
  const telemetry = useMemo(
    () => telemetryOption ?? createDesktopSimulationTelemetry(),
    [telemetryOption],
  );

  const [state, dispatch] = useReducer(
    reduceSimulationScreen,
    undefined,
    initialSimulationScreenState,
  );

  const revisionRef = useRef(state.revision);
  revisionRef.current = state.revision;
  const battleManifestRef = useRef(state.battleManifest);
  battleManifestRef.current = state.battleManifest;

  const loadSnapshotData = useCallback(async () => {
    if (bridge === undefined) return;
    dispatch({ type: "load-started" });
    const read = await readQuery(bridge.campaign, "inspectCampaign", sessionId, null);
    if (read.status === "ready") {
      dispatch({
        type: "load-succeeded",
        revision: read.value.projection.revision,
        playerNationId: read.value.projection.playerNationId,
      });
      return;
    }
    dispatch({ type: "load-failed", message: read.reason });
  }, [bridge, sessionId]);

  useEffect(() => {
    void loadSnapshotData();
  }, [loadSnapshotData]);

  useEffect(() => {
    if (campaignRevision !== undefined && campaignRevision !== revisionRef.current) {
      void loadSnapshotData();
    }
  }, [campaignRevision, loadSnapshotData]);

  const handleAdvanceTurn = useCallback(async () => {
    if (bridge === undefined) return;
    dispatch({ type: "commit-started" });
    const result = await runSimulationCommand({
      action: "month_commit",
      sessionId,
      telemetry,
      transportErrorFallback: "Error committing turn",
      run: () =>
        bridge.campaign.execute(
          "commitMonth",
          envelopeOf(sessionId, stampCommand("desktop-commit", revisionRef.current)),
        ),
      audit: (value) => ({
        randomDecisions: value.randomDecisions ?? [],
        domainEvents: value.domainEvents ?? [],
        financialLedger: value.financialLedger ?? [],
      }),
    });
    if (result.status === "success") {
      dispatch({ type: "commit-succeeded", response: result.value });
      onMonthCommitted?.();
      return;
    }
    dispatch({
      type: "commit-failed",
      message: commandFailureMessage(result, "Failed to advance turn"),
    });
  }, [bridge, sessionId, telemetry, onMonthCommitted]);

  const handleGenerateBattle = useCallback(async () => {
    if (bridge === undefined) return;
    dispatch({ type: "battle-generate-started" });
    const result = await runSimulationCommand({
      action: "battle_generate",
      sessionId,
      telemetry,
      transportErrorFallback: "Error generating battle",
      run: () => bridge.campaign.execute("generateBattle", { sessionId }),
      audit: (value) => auditInputFromDecisions(value.randomDecisions ?? []),
    });
    if (result.status === "success") {
      dispatch({ type: "battle-succeeded", manifest: result.value.manifest });
      return;
    }
    dispatch({
      type: "battle-failed",
      message: commandFailureMessage(result, "Failed to generate battle"),
    });
  }, [bridge, sessionId, telemetry]);

  const handleAutoResolve = useCallback(async () => {
    const manifest = battleManifestRef.current;
    if (bridge === undefined || manifest === null) return;
    dispatch({ type: "battle-resolve-started" });
    const result = await runSimulationCommand({
      action: "battle_resolve",
      sessionId,
      telemetry,
      transportErrorFallback: "Error resolving battle",
      run: () =>
        bridge.campaign.execute("resolveBattle", { sessionId, battleId: manifest.battleId }),
    });
    if (result.status === "success") {
      dispatch({ type: "resolve-succeeded", resolution: result.value.resolution });
      return;
    }
    dispatch({
      type: "battle-failed",
      message: commandFailureMessage(result, "Failed to resolve", { includeDiagnostics: false }),
    });
  }, [bridge, sessionId, telemetry]);

  const handleTacticalResolve = useCallback(async () => {
    const manifest = battleManifestRef.current;
    if (bridge === undefined || manifest === null) return;
    dispatch({ type: "battle-resolve-started" });
    const result = await runSimulationCommand({
      action: "battle_resolve_tactical",
      sessionId,
      telemetry,
      transportErrorFallback: "Error resolving tactical battle",
      run: () =>
        bridge.campaign.execute("resolveTacticalBattle", {
          sessionId,
          battleId: manifest.battleId,
          turnCount: TACTICAL_RESOLVER_MAX_TURNS,
          scriptedOrders: SCRIPTED_TACTICAL_ORDERS,
        }),
      audit: (value) => auditInputFromDecisions(value.randomDecisions ?? []),
    });
    if (result.status === "success") {
      dispatch({ type: "tactical-succeeded", outcome: result.value.outcome });
      return;
    }
    dispatch({
      type: "battle-failed",
      message: commandFailureMessage(result, "Failed to resolve tactically", {
        includeDiagnostics: false,
      }),
    });
  }, [bridge, sessionId, telemetry]);

  const setActiveTab = useCallback((tab: string) => dispatch({ type: "tab-selected", tab }), []);

  return {
    loading: state.loading,
    error: state.error,
    activeTab: state.activeTab,
    playerNationId: state.playerNationId,
    submarinePools: state.submarinePools,
    minePressure: state.minePressure,
    landTargetDamage: state.landTargetDamage,
    commitResult: state.commitResult,
    battleManifest: state.battleManifest,
    autoResolution: state.autoResolution,
    tacticalOutcome: state.tacticalOutcome,
    battleLoading: state.battleLoading,
    battleError: state.battleError,
    setActiveTab,
    loadSnapshotData,
    handleAdvanceTurn,
    handleGenerateBattle,
    handleAutoResolve,
    handleTacticalResolve,
  };
}
