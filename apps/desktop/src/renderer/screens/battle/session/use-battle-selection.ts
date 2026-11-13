import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import { useCallback, useMemo, useState } from "react";
import type { WorldPoint } from "../tactical/tactical-geometry.js";
import type {
  CoursePreview,
  MapOverlays,
  NameFilter,
  OverlayKey,
} from "../tactical/tactical-map-types.js";
import { selectedShip, shipPoint } from "../tactical/tactical-model.js";

const INITIAL_OVERLAYS: MapOverlays = { labels: "all", tracks: true, rings: true, fire: true };

export interface BattleSelection {
  readonly selectedShipId: string | null;
  readonly selected: PlayerBattleShipView | null;
  readonly selectedPoint: WorldPoint | null;
  readonly selectedDivisionId: string | null;
  readonly preview: CoursePreview | null;
  readonly overlays: MapOverlays;
  readonly selectShip: (shipId: string | null) => void;
  readonly selectDivision: (divisionId: string) => void;
  readonly previewCourse: (headingDeg: number | null) => void;
  readonly setOverlay: (overlay: OverlayKey, on: boolean) => void;
  readonly setNames: (labels: NameFilter) => void;
}

export function useBattleSelection(view: PlayerBattleView | null): BattleSelection {
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [coursePreview, setCoursePreview] = useState<number | null>(null);
  const [overlays, setOverlays] = useState<MapOverlays>(INITIAL_OVERLAYS);

  const selected = view === null ? null : selectedShip(view, selectedShipId);
  const selectedPoint = useMemo(() => (selected === null ? null : shipPoint(selected)), [selected]);
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

  const setOverlay = useCallback((overlay: OverlayKey, on: boolean) => {
    setOverlays((current) => ({ ...current, [overlay]: on }));
  }, []);

  const setNames = useCallback((labels: NameFilter) => {
    setOverlays((current) => ({ ...current, labels }));
  }, []);

  return {
    selectedShipId,
    selected,
    selectedPoint,
    selectedDivisionId: selected?.divisionId ?? null,
    preview,
    overlays,
    selectShip: setSelectedShipId,
    selectDivision,
    previewCourse: setCoursePreview,
    setOverlay,
    setNames,
  };
}
