import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import { BluewaveError } from "@bluewave/contracts";
import { createContext, use } from "react";
import type { DivisionOrder, DivisionOrders } from "../../../../shared/player-battle-orders.js";
import type { AppPreferences } from "../../../../shared/preferences-contract.js";
import type {
  TacticalCamera,
  TacticalViewport,
  WorldPoint,
} from "../tactical/tactical-geometry.js";
import type { CombatLogEntry, TransientMarkers } from "../tactical/tactical-log.js";
import type {
  CoursePreview,
  MapOverlays,
  NameFilter,
  OverlayKey,
  StandingCourse,
} from "../tactical/tactical-map-types.js";
import type { Trails } from "../tactical/tactical-model.js";
import type { TacticalTimeScale } from "../tactical/tactical-time.js";
import type { BattleResume } from "../usePlayerBattle.js";

export interface BattleSessionState {
  readonly view: PlayerBattleView | null;
  readonly resume: BattleResume;
  readonly error: string | null;
  readonly busy: boolean;
  readonly ended: boolean;
  readonly running: boolean;
  readonly scale: TacticalTimeScale;
  readonly stepIntervalMs: number;
  readonly selectedShipId: string | null;
  readonly selected: PlayerBattleShipView | null;
  readonly selectedPoint: WorldPoint | null;
  readonly selectedDivisionId: string | null;
  readonly preview: CoursePreview | null;
  readonly overlays: MapOverlays;
  readonly trails: Trails;
  readonly entries: readonly CombatLogEntry[];
  readonly markers: TransientMarkers;
  readonly standingCourses: readonly StandingCourse[];
  readonly acceptedOrders: DivisionOrders;
  readonly orderFor: (divisionId: string) => DivisionOrder;
}

export interface BattleSessionCamera {
  readonly camera: TacticalCamera;
  readonly viewport: TacticalViewport;
}

export interface BattleSessionActions {
  readonly toggleRunning: () => void;
  readonly setScale: (scale: TacticalTimeScale) => void;
  readonly step: () => void;
  readonly fightToEnd: () => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly fit: () => void;
  readonly focus: () => void;
  readonly changeCamera: (camera: TacticalCamera) => void;
  readonly setViewport: (viewport: TacticalViewport) => void;
  readonly setOverlay: (overlay: OverlayKey, on: boolean) => void;
  readonly setNames: (labels: NameFilter) => void;
  readonly selectShip: (shipId: string | null) => void;
  readonly selectDivision: (divisionId: string) => void;
  readonly previewCourse: (headingDeg: number | null) => void;
  readonly setOrder: (divisionId: string, patch: Partial<DivisionOrder>) => void;
  readonly releaseCourse: (divisionId: string) => void;
  readonly submit: () => void;
}

export interface BattleSessionMeta {
  readonly areaId: string | undefined;
  readonly locale: AppPreferences["formattingLocale"];
}

export const BattleStateContext = createContext<BattleSessionState | null>(null);
export const BattleCameraContext = createContext<BattleSessionCamera | null>(null);
export const BattleActionsContext = createContext<BattleSessionActions | null>(null);
export const BattleMetaContext = createContext<BattleSessionMeta | null>(null);

function required<Value>(value: Value | null): Value {
  if (value === null) throw new BluewaveError("BATTLE_SESSION_PROVIDER_MISSING", {});
  return value;
}

export const useBattleState = (): BattleSessionState => required(use(BattleStateContext));
export const useBattleCameraState = (): BattleSessionCamera => required(use(BattleCameraContext));
export const useBattleActions = (): BattleSessionActions => required(use(BattleActionsContext));
export const useBattleMeta = (): BattleSessionMeta => required(use(BattleMetaContext));
