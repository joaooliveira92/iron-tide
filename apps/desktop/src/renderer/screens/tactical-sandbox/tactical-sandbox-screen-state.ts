import type {
  BattleManifest,
  BattleResolution,
  ReplayBattleBoundaryResponse,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";

import { DEFAULT_SCRIPTED_ORDERS_TEXT } from "./scripted-orders.js";

export interface TacticalSandboxScreenState {
  readonly warId: string;
  readonly turnCount: number;
  readonly scriptedOrdersText: string;
  readonly manifest: BattleManifest | null;
  readonly generateError: string | null;
  readonly autoResolution: BattleResolution | null;
  readonly tacticalOutcome: TacticalBattleOutcome | null;
  readonly resolveError: string | null;
  readonly boundaryReplay: ReplayBattleBoundaryResponse | null;
  readonly boundaryReplayError: string | null;
  readonly busy: boolean;
}

export function initialTacticalSandboxScreenState(): TacticalSandboxScreenState {
  return {
    warId: "war_uk_germany",
    turnCount: 200,
    scriptedOrdersText: DEFAULT_SCRIPTED_ORDERS_TEXT,
    manifest: null,
    generateError: null,
    autoResolution: null,
    tacticalOutcome: null,
    resolveError: null,
    boundaryReplay: null,
    boundaryReplayError: null,
    busy: false,
  };
}

export function updateWarId(
  state: TacticalSandboxScreenState,
  warId: string,
): TacticalSandboxScreenState {
  return { ...state, warId };
}

export function updateTurnCount(
  state: TacticalSandboxScreenState,
  turnCount: number,
): TacticalSandboxScreenState {
  return { ...state, turnCount };
}

export function updateScriptedOrdersText(
  state: TacticalSandboxScreenState,
  scriptedOrdersText: string,
): TacticalSandboxScreenState {
  return { ...state, scriptedOrdersText };
}

export function beginRequest(state: TacticalSandboxScreenState): TacticalSandboxScreenState {
  return { ...state, busy: true };
}

export function applyManifestGenerated(
  state: TacticalSandboxScreenState,
  manifest: BattleManifest,
): TacticalSandboxScreenState {
  return {
    ...state,
    busy: false,
    manifest,
    generateError: null,
    autoResolution: null,
    tacticalOutcome: null,
    resolveError: null,
    boundaryReplay: null,
    boundaryReplayError: null,
  };
}

export function applyGenerateFailed(
  state: TacticalSandboxScreenState,
  error: string,
): TacticalSandboxScreenState {
  return { ...state, busy: false, generateError: error, manifest: null };
}

export function applyAutoResolution(
  state: TacticalSandboxScreenState,
  resolution: BattleResolution,
): TacticalSandboxScreenState {
  return {
    ...state,
    busy: false,
    autoResolution: resolution,
    resolveError: null,
  };
}

export function applyTacticalOutcome(
  state: TacticalSandboxScreenState,
  outcome: TacticalBattleOutcome,
): TacticalSandboxScreenState {
  return {
    ...state,
    busy: false,
    tacticalOutcome: outcome,
    resolveError: null,
  };
}

export function applyResolveFailed(
  state: TacticalSandboxScreenState,
  error: string,
): TacticalSandboxScreenState {
  return { ...state, busy: false, resolveError: error };
}

export function applyBoundaryReplayed(
  state: TacticalSandboxScreenState,
  boundaryReplay: ReplayBattleBoundaryResponse,
): TacticalSandboxScreenState {
  return { ...state, busy: false, boundaryReplay, boundaryReplayError: null };
}

export function applyBoundaryReplayFailed(
  state: TacticalSandboxScreenState,
  error: string,
): TacticalSandboxScreenState {
  return {
    ...state,
    busy: false,
    boundaryReplayError: error,
    boundaryReplay: null,
  };
}
