import type { PlayerBattleResultDto } from "../../../../shared/player-battle-contract.js";
import { useMemo, type ReactNode } from "react";
import { usePreferences } from "../../../lib/preferences-context.js";
import { projectCombatLog, transientMarkers } from "../tactical/tactical-log.js";
import type { StandingCourse } from "../tactical/tactical-map-types.js";
import { stepIntervalMs } from "../tactical/tactical-time.js";
import { usePlayerBattle } from "../usePlayerBattle.js";
import {
  BattleActionsContext,
  BattleCameraContext,
  BattleMetaContext,
  BattleStateContext,
  type BattleSessionActions,
  type BattleSessionCamera,
  type BattleSessionMeta,
  type BattleSessionState,
} from "./battle-session-contexts.js";
import { useBattleCamera } from "./use-battle-camera.js";
import { useBattleClock } from "./use-battle-clock.js";
import { useBattleSelection } from "./use-battle-selection.js";
import { useStableCallback } from "./use-stable-callback.js";

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
  const step = useStableCallback(() => advance("minute"));
  const fightToEnd = useStableCallback(() => {
    pause();
    advance("to_end");
  });
  const zoomIn = useStableCallback(camera.zoomIn);
  const zoomOut = useStableCallback(camera.zoomOut);
  const fit = useStableCallback(camera.fit);
  const focus = useStableCallback(camera.focus);
  const selectDivision = useStableCallback(selection.selectDivision);
  const setOrder = useStableCallback(battle.setOrder);
  const releaseCourse = useStableCallback(battle.releaseCourse);
  const submit = useStableCallback(battle.submit);

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

  const { running, scale } = clock;
  const state = useMemo<BattleSessionState>(
    () => ({
      view,
      resume: battle.resume,
      error: battle.error,
      busy,
      ended,
      running,
      scale,
      stepIntervalMs: stepIntervalMs(scale),
      selectedShipId: selection.selectedShipId,
      selected: selection.selected,
      selectedPoint: selection.selectedPoint,
      selectedDivisionId: selection.selectedDivisionId,
      preview: selection.preview,
      overlays: selection.overlays,
      trails: camera.trails,
      entries,
      markers,
      standingCourses,
      acceptedOrders,
      orderFor: battle.orderFor,
    }),
    [
      view,
      battle.resume,
      battle.error,
      battle.orderFor,
      busy,
      ended,
      running,
      scale,
      selection.selectedShipId,
      selection.selected,
      selection.selectedPoint,
      selection.selectedDivisionId,
      selection.preview,
      selection.overlays,
      camera.trails,
      entries,
      markers,
      standingCourses,
      acceptedOrders,
    ],
  );

  const cameraState = useMemo<BattleSessionCamera>(
    () => ({ camera: camera.camera, viewport: camera.viewport }),
    [camera.camera, camera.viewport],
  );

  const { toggleRunning, setScale } = clock;
  const { changeCamera, setViewport } = camera;
  const { setOverlay, setNames, selectShip, previewCourse } = selection;
  const actions = useMemo<BattleSessionActions>(
    () => ({
      toggleRunning,
      setScale,
      step,
      fightToEnd,
      zoomIn,
      zoomOut,
      fit,
      focus,
      changeCamera,
      setViewport,
      setOverlay,
      setNames,
      selectShip,
      selectDivision,
      previewCourse,
      setOrder,
      releaseCourse,
      submit,
    }),
    [
      toggleRunning,
      setScale,
      step,
      fightToEnd,
      zoomIn,
      zoomOut,
      fit,
      focus,
      changeCamera,
      setViewport,
      setOverlay,
      setNames,
      selectShip,
      selectDivision,
      previewCourse,
      setOrder,
      releaseCourse,
      submit,
    ],
  );

  const locale = preferences.formattingLocale;
  const resolvedAreaId = view?.areaId ?? areaId;
  const meta = useMemo<BattleSessionMeta>(
    () => ({ areaId: resolvedAreaId, locale }),
    [resolvedAreaId, locale],
  );

  return (
    <BattleActionsContext value={actions}>
      <BattleMetaContext value={meta}>
        <BattleStateContext value={state}>
          <BattleCameraContext value={cameraState}>{children}</BattleCameraContext>
        </BattleStateContext>
      </BattleMetaContext>
    </BattleActionsContext>
  );
}
