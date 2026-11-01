import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InterruptionRequestDto } from "../../../shared/turn-message-contract.js";
import type { PlayerBattleResultDto } from "../../../shared/player-battle-contract.js";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
} from "../../components/ui/alert-dialog.js";
import { Button } from "../../components/ui/button.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { usePreferences } from "../../lib/preferences-context.js";
import { translate } from "../../lib/strings.js";
import { CombatLogPanel } from "./tactical/CombatLogPanel.js";
import { OrderOfBattle } from "./tactical/OrderOfBattle.js";
import { TacticalMap, type CoursePreview, type MapOverlays } from "./tactical/TacticalMap.js";
import { TacticalStatusBar } from "./tactical/TacticalStatusBar.js";
import { TacticalToolbar } from "./tactical/TacticalToolbar.js";
import { UnitCommandPanel } from "./tactical/UnitCommandPanel.js";
import {
  PROVISIONAL_ZOOM_STEP,
  centreCameraOn,
  fitCamera,
  zoomCameraAt,
  type TacticalCamera,
  type TacticalViewport,
} from "./tactical/tactical-geometry.js";
import { projectCombatLog, transientMarkers } from "./tactical/tactical-log.js";
import {
  appendTrails,
  knownPositions,
  selectedShip,
  shipPoint,
  type Trails,
} from "./tactical/tactical-model.js";
import {
  DEFAULT_TIME_SCALE,
  stepIntervalMs,
  type TacticalTimeScale,
} from "./tactical/tactical-time.js";
import { useTacticalPacer } from "./tactical/useTacticalPacer.js";
import { usePlayerBattle } from "./usePlayerBattle.js";

const INITIAL_CAMERA: TacticalCamera = { centreX: 0, centreY: 0, metresPerPixel: 400 };
const INITIAL_VIEWPORT: TacticalViewport = { width: 800, height: 480 };
const INITIAL_OVERLAYS: MapOverlays = { labels: true, tracks: true, rings: true, fire: true };

export function PlayerBattleScreen({
  request,
  sessionId,
  onSubmitResult,
  onAbandon,
}: {
  readonly request: InterruptionRequestDto;
  readonly sessionId: string;
  readonly onSubmitResult: (result: PlayerBattleResultDto) => void;
  readonly onAbandon: () => void;
}) {
  const battleId = request.battleId ?? "";
  const { preferences } = usePreferences();
  const {
    view,
    resume,
    acceptedOrders,
    error,
    busy,
    orderFor,
    setOrder,
    releaseCourse,
    advance,
    submit,
  } = usePlayerBattle(sessionId, battleId, onSubmitResult);

  const [running, setRunning] = useState(false);
  const [scale, setScale] = useState<TacticalTimeScale>(DEFAULT_TIME_SCALE);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [camera, setCamera] = useState<TacticalCamera>(INITIAL_CAMERA);
  const [viewport, setViewport] = useState<TacticalViewport>(INITIAL_VIEWPORT);
  const [overlays, setOverlays] = useState<MapOverlays>(INITIAL_OVERLAYS);
  const [trails, setTrails] = useState<Trails>({});
  const [coursePreview, setCoursePreview] = useState<number | null>(null);
  const fittedKey = useRef("");
  const userMoved = useRef(false);

  const ended = view?.ended ?? false;

  useTacticalPacer({
    running,
    scale,
    busy,
    ended: view === null || ended,
    onStep: () => advance("minute"),
  });

  useEffect(() => {
    if (view === null) return;
    setTrails((previous) => appendTrails(previous, view));
    const points = knownPositions(view);
    const key = `${String(points.length)}:${String(view.ended)}`;
    if (!userMoved.current && key !== fittedKey.current) {
      fittedKey.current = key;
      setCamera((current) => fitCamera(points, viewport, current));
    }
  }, [view, viewport]);

  useEffect(() => {
    if (ended) setRunning(false);
  }, [ended]);

  const entries = useMemo(() => (view === null ? [] : projectCombatLog(view)), [view]);
  const markers = useMemo(
    () => (view === null ? { firing: [], impacts: [] } : transientMarkers(entries, view.minute)),
    [entries, view],
  );

  const selected = view === null ? null : selectedShip(view, selectedShipId);
  const selectedPoint = selected === null ? null : shipPoint(selected);
  const selectedDivisionId = selected?.divisionId ?? null;

  const preview: CoursePreview | null =
    selected !== null && coursePreview !== null
      ? { shipId: selected.shipId, headingDeg: coursePreview }
      : null;

  const selectDivision = useCallback(
    (divisionId: string) => {
      const division = view?.divisions.find((entry) => entry.divisionId === divisionId);
      if (division !== undefined) setSelectedShipId(division.flagshipId);
    },
    [view],
  );

  const changeCamera = useCallback((next: TacticalCamera) => {
    userMoved.current = true;
    setCamera(next);
  }, []);

  const toggleOverlay = useCallback((overlay: keyof MapOverlays, on: boolean) => {
    setOverlays((current) => ({ ...current, [overlay]: on }));
  }, []);

  const centre: readonly [number, number] = [viewport.width / 2, viewport.height / 2];

  return (
    <AlertDialog open onOpenChange={() => undefined}>
      <AlertDialogContent size="standard" aria-label="Tactical battle" data-testid="player-battle">
        <AlertDialogBody>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Battle of {view?.areaId ?? request.areaId}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {view === null
                  ? "Projecting the committed battle…"
                  : `${view.campaignMonth} · minute ${String(view.minute)} / ${String(view.maxMinutes)} · sea ${view.weather.seaState}`}
              </p>
              {resume === "resumed" && (
                <p data-testid="battle-resumed" className="mt-1 text-xs text-muted-foreground">
                  Resumed from the saved battle at minute {view?.minute ?? 0}.
                </p>
              )}
            </div>
            <button
              type="button"
              data-testid="battle-abandon"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onAbandon}
            >
              Abandon turn
            </button>
          </div>

          {error !== null && (
            <p data-testid="battle-error" role="alert" className="mt-2 text-xs text-red-400">
              {error}
            </p>
          )}

          {view !== null && (
            <div className="mt-2 flex flex-col gap-2">
              <TacticalToolbar
                running={running}
                scale={scale}
                busy={busy}
                ended={ended}
                canFocus={selectedPoint !== null}
                overlays={overlays}
                onToggleRunning={() => setRunning((current) => !current)}
                onScale={setScale}
                onStep={() => advance("minute")}
                onFightToEnd={() => {
                  setRunning(false);
                  advance("to_end");
                }}
                onZoomIn={() =>
                  setCamera((current) =>
                    zoomCameraAt(current, viewport, PROVISIONAL_ZOOM_STEP, centre),
                  )
                }
                onZoomOut={() =>
                  setCamera((current) =>
                    zoomCameraAt(current, viewport, 1 / PROVISIONAL_ZOOM_STEP, centre),
                  )
                }
                onFit={() =>
                  setCamera((current) => fitCamera(knownPositions(view), viewport, current))
                }
                onFocus={() => {
                  if (selectedPoint !== null) {
                    setCamera((current) => centreCameraOn(current, selectedPoint));
                  }
                }}
                onOverlay={toggleOverlay}
              />

              <div className="grid min-h-0 gap-2 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
                <aside className="min-h-0 rounded border border-border p-2 lg:max-h-[30rem] lg:overflow-auto">
                  <Tabs defaultValue="oob">
                    <TabsList variant="line" aria-label={translate("tactical.tabs.label")}>
                      <TabsTrigger value="oob">{translate("tactical.tabs.oob")}</TabsTrigger>
                      <TabsTrigger value="log">{translate("tactical.tabs.log")}</TabsTrigger>
                      {view.objectives.length > 0 && (
                        <TabsTrigger value="objectives">
                          {translate("tactical.tabs.objectives")}
                        </TabsTrigger>
                      )}
                    </TabsList>
                    <TabsContent value="oob">
                      <OrderOfBattle
                        view={view}
                        locale={preferences.formattingLocale}
                        orderFor={orderFor}
                        setOrder={setOrder}
                        selectedShipId={selectedShipId}
                        selectedDivisionId={selectedDivisionId}
                        onSelectShip={setSelectedShipId}
                        onSelectDivision={selectDivision}
                      />
                    </TabsContent>
                    <TabsContent value="log">
                      <CombatLogPanel entries={entries} onSelectShip={setSelectedShipId} />
                    </TabsContent>
                    {view.objectives.length > 0 && (
                      <TabsContent value="objectives">
                        <ul
                          data-testid="battle-objectives"
                          className="list-disc space-y-1 pl-4 text-xs"
                        >
                          {view.objectives.map((objective) => (
                            <li key={objective}>{objective}</li>
                          ))}
                        </ul>
                      </TabsContent>
                    )}
                  </Tabs>
                </aside>

                <div className="flex min-w-0 flex-col gap-2">
                  <div className="relative h-[min(20rem,36vh)]">
                    <TacticalMap
                      view={view}
                      camera={camera}
                      onCameraChange={changeCamera}
                      onViewportChange={setViewport}
                      selectedShipId={selectedShipId}
                      onSelectShip={setSelectedShipId}
                      overlays={overlays}
                      trails={trails}
                      markers={markers}
                      stepIntervalMs={stepIntervalMs(scale)}
                      paused={!running}
                      coursePreview={preview}
                    />
                    {!running && !ended && (
                      <div
                        aria-hidden="true"
                        data-testid="tactical-paused-banner"
                        className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-amber-500/90 px-4 py-1 text-sm font-bold tracking-widest text-black"
                      >
                        {translate("tactical.status.paused")}
                      </div>
                    )}
                  </div>
                  <UnitCommandPanel
                    view={view}
                    locale={preferences.formattingLocale}
                    selectedShipId={selectedShipId}
                    orderFor={orderFor}
                    acceptedOrders={acceptedOrders}
                    setOrder={setOrder}
                    releaseCourse={releaseCourse}
                    onPreviewCourse={setCoursePreview}
                  />
                  {!running && !ended && (
                    <p className="text-xs text-muted-foreground">
                      {translate("tactical.status.pending_orders")}
                    </p>
                  )}
                </div>
              </div>

              <TacticalStatusBar view={view} running={running} scale={scale} />

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="battle-submit"
                  disabled={!ended || busy}
                  onClick={() => submit()}
                >
                  Submit result
                </Button>
              </div>
            </div>
          )}
        </AlertDialogBody>
      </AlertDialogContent>
    </AlertDialog>
  );
}
