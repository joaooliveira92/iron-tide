import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import { BluewaveError } from "@bluewave/contracts";
import { createContext, use, useCallback, useMemo, type ReactNode } from "react";
import type { PlayerBattleResultDto } from "../../../../shared/player-battle-contract.js";
import type { DivisionOrder, DivisionOrders } from "../../../../shared/player-battle-orders.js";
import type { AppPreferences } from "../../../../shared/preferences-contract.js";
import { usePreferences } from "../../../lib/preferences-context.js";
import type {
  TacticalCamera,
  TacticalViewport,
  WorldPoint,
} from "../tactical/tactical-geometry.js";
import { projectCombatLog, transientMarkers } from "../tactical/tactical-log.js";
import type { CombatLogEntry, TransientMarkers } from "../tactical/tactical-log.js";
import type {
  CoursePreview,
  MapOverlays,
  NameFilter,
  OverlayKey,
  StandingCourse,
} from "../tactical/tactical-map-types.js";
import type { Trails } from "../tactical/tactical-model.js";
import { stepIntervalMs, type TacticalTimeScale } from "../tactical/tactical-time.js";
import { usePlayerBattle, type BattleResume } from "../usePlayerBattle.js";
import { useBattleCamera } from "./use-battle-camera.js";
import { useBattleClock } from "./use-battle-clock.js";
import { useBattleSelection } from "./use-battle-selection.js";

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
  readonly camera: TacticalCamera;
  readonly viewport: TacticalViewport;
  readonly trails: Trails;
  readonly entries: readonly CombatLogEntry[];
  readonly markers: TransientMarkers;
  readonly standingCourses: readonly StandingCourse[];
  readonly acceptedOrders: DivisionOrders;
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
  readonly orderFor: (divisionId: string) => DivisionOrder;
  readonly setOrder: (divisionId: string, patch: Partial<DivisionOrder>) => void;
  readonly releaseCourse: (divisionId: string) => void;
  readonly submit: () => void;
}

export interface BattleSessionMeta {
  readonly areaId: string | undefined;
  readonly locale: AppPreferences["formattingLocale"];
}

export interface BattleSessionValue {
  readonly state: BattleSessionState;
  readonly actions: BattleSessionActions;
  readonly meta: BattleSessionMeta;
}

const BattleSessionContext = createContext<BattleSessionValue | null>(null);

export function useBattleSession(): BattleSessionValue {
  const value = use(BattleSessionContext);
  if (value === null) throw new BluewaveError("BATTLE_SESSION_PROVIDER_MISSING", {});
  return value;
}

export interface BattleSessionProviderProps {
  readonly sessionId: string;
  readonly battleId: string;
  readonly areaId: string | undefined;
  readonly onSubmitResult: (result: PlayerBattleResultDto) => void;
  readonly children: ReactNode;
}

export function BattleSessionProvider({
  sessionId,
  battleId,
  areaId,
  onSubmitResult,
  children,
}: BattleSessionProviderProps) {
  const { preferences } = usePreferences();
  const battle = usePlayerBattle(sessionId, battleId, onSubmitResult);
  const { view, acceptedOrders, busy, advance } = battle;
  const ended = view?.ended ?? false;

  const selection = useBattleSelection(view);
  const camera = useBattleCamera(view, selection.selectedPoint);
  const clock = useBattleClock({
    busy,
    ended,
    loaded: view !== null,
    onStep: () => advance("minute"),
  });

  const { pause } = clock;
  const step = useCallback(() => advance("minute"), [advance]);
  const fightToEnd = useCallback(() => {
    pause();
    advance("to_end");
  }, [pause, advance]);

  const entries = useMemo(() => (view === null ? [] : projectCombatLog(view)), [view]);
  const markers = useMemo(
    () => (view === null ? { firing: [], impacts: [] } : transientMarkers(entries, view.minute)),
    [entries, view],
  );
  const standingCourses = useMemo<readonly StandingCourse[]>(() => {
    if (view === null) return [];
    return view.divisions.flatMap((division) => {
      const course = acceptedOrders[division.divisionId]?.courseDeg;
      return course === undefined ? [] : [{ shipId: division.flagshipId, headingDeg: course }];
    });
  }, [view, acceptedOrders]);

  const value: BattleSessionValue = {
    state: {
      view,
      resume: battle.resume,
      error: battle.error,
      busy,
      ended,
      running: clock.running,
      scale: clock.scale,
      stepIntervalMs: stepIntervalMs(clock.scale),
      selectedShipId: selection.selectedShipId,
      selected: selection.selected,
      selectedPoint: selection.selectedPoint,
      selectedDivisionId: selection.selectedDivisionId,
      preview: selection.preview,
      overlays: selection.overlays,
      camera: camera.camera,
      viewport: camera.viewport,
      trails: camera.trails,
      entries,
      markers,
      standingCourses,
      acceptedOrders,
    },
    actions: {
      toggleRunning: clock.toggleRunning,
      setScale: clock.setScale,
      step,
      fightToEnd,
      zoomIn: camera.zoomIn,
      zoomOut: camera.zoomOut,
      fit: camera.fit,
      focus: camera.focus,
      changeCamera: camera.changeCamera,
      setViewport: camera.setViewport,
      setOverlay: selection.setOverlay,
      setNames: selection.setNames,
      selectShip: selection.selectShip,
      selectDivision: selection.selectDivision,
      previewCourse: selection.previewCourse,
      orderFor: battle.orderFor,
      setOrder: battle.setOrder,
      releaseCourse: battle.releaseCourse,
      submit: battle.submit,
    },
    meta: { areaId: view?.areaId ?? areaId, locale: preferences.formattingLocale },
  };

  return <BattleSessionContext value={value}>{children}</BattleSessionContext>;
}
