import type {
  BattleManifest,
  BattleResolution,
  CommitMonthResponse,
  LandTargetDamage,
  MinePressure,
  SubmarinePool,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";

/**
 * The simulation screen's single source of truth. Every entry point folds its
 * result through `reduceSimulationScreen`, so loading flags, revision adoption,
 * and battle-output resets stay in one place rather than scattered setters.
 */
export interface SimulationScreenState {
  readonly loading: boolean;
  readonly error: string | null;
  readonly activeTab: string;
  readonly revision: number;
  /** The session's player nation id, captured from the projection; never guessed from side order. */
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
}

export type SimulationScreenAction =
  | { readonly type: "load-started" }
  | {
      readonly type: "load-succeeded";
      readonly revision: number;
      readonly playerNationId: string | null;
    }
  | { readonly type: "load-failed"; readonly message: string }
  | { readonly type: "commit-started" }
  | { readonly type: "commit-succeeded"; readonly response: CommitMonthResponse }
  | { readonly type: "commit-failed"; readonly message: string }
  | { readonly type: "battle-generate-started" }
  | { readonly type: "battle-resolve-started" }
  | { readonly type: "battle-succeeded"; readonly manifest: BattleManifest }
  | { readonly type: "resolve-succeeded"; readonly resolution: BattleResolution }
  | { readonly type: "tactical-succeeded"; readonly outcome: TacticalBattleOutcome }
  | { readonly type: "battle-failed"; readonly message: string }
  | { readonly type: "tab-selected"; readonly tab: string };

export function initialSimulationScreenState(): SimulationScreenState {
  return {
    loading: false,
    error: null,
    activeTab: "overview",
    revision: 0,
    playerNationId: null,
    submarinePools: [],
    minePressure: [],
    landTargetDamage: [],
    commitResult: null,
    battleManifest: null,
    autoResolution: null,
    tacticalOutcome: null,
    battleLoading: false,
    battleError: null,
  };
}

export function reduceSimulationScreen(
  state: SimulationScreenState,
  action: SimulationScreenAction,
): SimulationScreenState {
  switch (action.type) {
    case "load-started":
      return { ...state, loading: true };
    case "load-succeeded":
      return {
        ...state,
        loading: false,
        revision: action.revision,
        playerNationId: action.playerNationId,
      };
    case "load-failed":
      return { ...state, loading: false, error: action.message };
    case "commit-started":
      return { ...state, loading: true, error: null };
    case "commit-succeeded": {
      const snapshot = action.response.closingSnapshot;
      return {
        ...state,
        loading: false,
        error: null,
        revision: Number(snapshot.revision),
        submarinePools: snapshot.submarinePools ?? [],
        minePressure: snapshot.minePressure ?? [],
        landTargetDamage: snapshot.landTargetDamage ?? [],
        commitResult: action.response,
        battleManifest: null,
        autoResolution: null,
        tacticalOutcome: null,
        activeTab: "report",
      };
    }
    case "commit-failed":
      return { ...state, loading: false, error: action.message };
    case "battle-generate-started":
      return {
        ...state,
        battleLoading: true,
        battleError: null,
        autoResolution: null,
        tacticalOutcome: null,
      };
    case "battle-resolve-started":
      return { ...state, battleLoading: true, battleError: null };
    case "battle-succeeded":
      return {
        ...state,
        battleLoading: false,
        battleError: null,
        battleManifest: action.manifest,
      };
    case "resolve-succeeded":
      return {
        ...state,
        battleLoading: false,
        battleError: null,
        autoResolution: action.resolution,
      };
    case "tactical-succeeded":
      return {
        ...state,
        battleLoading: false,
        battleError: null,
        tacticalOutcome: action.outcome,
      };
    case "battle-failed":
      return { ...state, battleLoading: false, battleError: action.message };
    case "tab-selected":
      return { ...state, activeTab: action.tab };
  }
}
