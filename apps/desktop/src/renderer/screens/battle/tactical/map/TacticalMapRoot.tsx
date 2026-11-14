import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { playerSideOf } from "../../../../../shared/player-battle-orders.js";
import { niceScaleBar } from "../../../../components/world-map/map-scale.js";
import { UM_PER_METRE, UM_PER_NAUTICAL_MILE } from "../../../../lib/presentation-format/units.js";
import { usePreferences } from "../../../../lib/preferences-context.js";
import { lodBandFor } from "../../../tactical-map/tacticalScale.js";
import {
  useBattleActions,
  useBattleCameraState,
  useBattleState,
} from "../../session/battle-session-contexts.js";
import { worldToScreen, type TacticalViewport } from "../tactical-geometry.js";
import {
  TacticalMapContext,
  createCursorStore,
  type MapMeasurement,
  type TacticalMapGeometry,
} from "./tactical-map-context.js";

const FALLBACK_VIEWPORT: TacticalViewport = { width: 800, height: 480 };
export const SCALE_BAR_MAX_PX = 140;

function symbolSizeFor(band: ReturnType<typeof lodBandFor>): number {
  if (band === "symbols") return 5;
  if (band === "hulls") return 8;
  return 12;
}

export function TacticalMapRoot({ children }: { readonly children: ReactNode }) {
  const { view } = useBattleState();
  if (view === null) return null;
  return <TacticalMapFrame view={view}>{children}</TacticalMapFrame>;
}

function TacticalMapFrame({
  view,
  children,
}: {
  readonly view: PlayerBattleView;
  readonly children: ReactNode;
}) {
  const { running, stepIntervalMs } = useBattleState();
  const { camera } = useBattleCameraState();
  const { setViewport: reportViewport } = useBattleActions();
  const { preferences } = usePreferences();
  const frame = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<TacticalViewport>(FALLBACK_VIEWPORT);
  const [cursor] = useState(createCursorStore);

  useEffect(() => {
    const element = frame.current;
    if (element === null || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) {
        const next = { width: Math.round(width), height: Math.round(height) };
        setViewport(next);
        reportViewport(next);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [reportViewport]);

  const project = useCallback(
    (point: readonly [number, number]) => worldToScreen(camera, viewport, point),
    [camera, viewport],
  );
  const shipsById = useMemo(
    () => new Map(view.ships.map((ship) => [ship.shipId, ship])),
    [view.ships],
  );
  const visibleShips = useMemo(
    () => view.ships.filter((ship) => ship.position !== null),
    [view.ships],
  );
  const measurement: MapMeasurement = {
    locale: preferences.formattingLocale,
    category: "range",
    preset: preferences.measurementPreset,
    selections: preferences.measurementSelections,
  };
  const pixelsPerNm = UM_PER_NAUTICAL_MILE / UM_PER_METRE / camera.metresPerPixel;

  const geometry: TacticalMapGeometry = {
    view,
    viewport,
    project,
    shipsById,
    visibleShips,
    playerSide: playerSideOf(view),
    symbolSize: symbolSizeFor(lodBandFor(camera.metresPerPixel)),
    pixelsPerNm,
    bar: niceScaleBar(pixelsPerNm, SCALE_BAR_MAX_PX),
    measurement,
    moveStyle: running ? `transform ${String(stepIntervalMs)}ms linear` : undefined,
    cursor,
  };

  return (
    <TacticalMapContext value={geometry}>
      <div
        ref={frame}
        className="relative h-full min-h-72 w-full overflow-hidden rounded border border-border bg-slate-950"
      >
        {children}
      </div>
    </TacticalMapContext>
  );
}
