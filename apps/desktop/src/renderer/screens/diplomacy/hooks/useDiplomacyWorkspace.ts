import type { DiplomacyPeaceTermRef } from "@bluewave/campaign-engine";
import { useCallback, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useScreenHeaderHost } from "../../../shell/screen-header.js";
import type { LocalTab } from "../../shipbuilding/design-sections.js";
import type { InspectorLayout } from "../../shipbuilding/inspector-layout.js";
import { useInspectorLayout } from "../../shipbuilding/useInspectorLayout.js";
import {
  DEFAULT_PLOT_LAYERS,
  toggleLayer,
  type PlotLayer,
  type PlotView,
} from "../components/plot-layers.js";
import { battleRecords, type BattleRecord } from "../diplomacy-hover.js";
import type {
  DiplomacyActionKind,
  DiplomacyScreenIdle,
  DiplomacyScreenState,
} from "../diplomacy-screen-state.js";
import { resolveSelectedNation } from "../diplomacy-selection.js";
import {
  OVERVIEW_PLACE,
  activeTab,
  nationPlace,
  reconcilePlace,
  type DiplomacyPlace,
} from "../diplomacy-sections.js";
import {
  buildDiplomacyViewModel,
  type DiplomacyRelationRow,
  type DiplomacyViewModel,
} from "../diplomacy-view-model.js";
import { useBattleHistory, type BattleHistoryState } from "./useBattleHistory.js";
import { useDiplomacyScreen } from "./useDiplomacyScreen.js";

export interface DiplomacyWorkspace {
  readonly status: "ready";
  readonly state: Exclude<DiplomacyScreenState, DiplomacyScreenIdle>;
  readonly vm: DiplomacyViewModel;
  readonly records: ReadonlyMap<string, BattleRecord>;
  readonly battleHistory: BattleHistoryState;
  readonly hosted: boolean;
  readonly busy: boolean;
  readonly queued: boolean;
  readonly declaringWar: boolean;
  readonly draftPartnerId: string | null;
  readonly canSubmit: boolean;
  readonly currentPlace: DiplomacyPlace;
  readonly selected: DiplomacyRelationRow | null;
  readonly tab: LocalTab;
  readonly plotView: PlotView;
  readonly layers: ReadonlySet<PlotLayer>;
  readonly inspectorId: string;
  readonly inspectorLayout: InspectorLayout;
  readonly setInspectorWidth: (px: number) => void;
  readonly toggleInspector: () => void;
  readonly showOverview: () => void;
  readonly selectNation: (nationId: string) => void;
  readonly selectTab: (tabId: string) => void;
  readonly onWorkspaceKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => void;
  readonly setPlotView: (view: PlotView) => void;
  readonly toggleChartLayer: (layer: PlotLayer) => void;
  readonly setRowAction: (partnerNationId: string, kind: DiplomacyActionKind) => void;
  readonly setBlockadeArea: (areaId: string) => void;
  readonly clearDraft: () => void;
  readonly submit: () => void;
  readonly acceptPeace: (warId: string) => void;
  readonly proposePeaceTerms: (warId: string, term: DiplomacyPeaceTermRef) => void;
}

export type DiplomacyWorkspaceResult =
  | { readonly status: "error"; readonly message: string; readonly retry: () => void }
  | { readonly status: "loading" }
  | DiplomacyWorkspace;

export function useDiplomacyWorkspace(sessionId: string): DiplomacyWorkspaceResult {
  const {
    state,
    loadError,
    setRowAction,
    setPeaceAction,
    setPeaceTerms,
    setBlockadeArea,
    clearDraft,
    submit,
    reload,
    canSubmit,
  } = useDiplomacyScreen(sessionId);
  const battleHistory = useBattleHistory(sessionId, state.revision);
  const [place, setPlace] = useState<DiplomacyPlace>(OVERVIEW_PLACE);
  const [plotView, setPlotView] = useState<PlotView>("plot");
  const [layers, setLayers] = useState<ReadonlySet<PlotLayer>>(DEFAULT_PLOT_LAYERS);
  const {
    layout: inspectorLayout,
    setWidth: setInspectorWidth,
    toggleCollapsed: toggleInspector,
  } = useInspectorLayout(sessionId);
  const inspectorId = useId();
  const hosted = useScreenHeaderHost();
  const projection = state.kind === "idle" ? null : state.projection;
  const draft = state.kind === "idle" ? null : state.draftCommand;
  const vm = useMemo(
    () => (projection === null ? null : buildDiplomacyViewModel(projection, draft)),
    [projection, draft],
  );
  const records = useMemo(
    () =>
      vm === null
        ? null
        : battleRecords(
            battleHistory,
            vm.relations.map((row) => row.partnerName),
          ),
    [vm, battleHistory],
  );
  const partnerNationIds = useMemo(
    () => vm?.relations.map((row) => row.partnerNationId) ?? [],
    [vm],
  );
  const showOverview = useCallback(() => setPlace(OVERVIEW_PLACE), []);
  const selectNation = useCallback((nationId: string) => setPlace(nationPlace(nationId)), []);
  const toggleChartLayer = useCallback(
    (layer: PlotLayer) => setLayers((current) => toggleLayer(current, layer)),
    [],
  );
  const acceptPeace = useCallback(
    (warId: string) => {
      const war = projection?.wars.find((w) => w.warId === warId);
      if (war !== undefined) {
        selectNation(war.playerSide === "attacker" ? war.defenderId : war.attackerId);
      }
      setPeaceAction(warId);
    },
    [projection, selectNation, setPeaceAction],
  );
  const proposePeaceTerms = useCallback(
    (warId: string, term: DiplomacyPeaceTermRef) => {
      const war = projection?.wars.find((w) => w.warId === warId);
      if (war !== undefined) {
        selectNation(war.playerSide === "attacker" ? war.defenderId : war.attackerId);
      }
      setPeaceTerms(warId, term);
    },
    [projection, selectNation, setPeaceTerms],
  );

  if (loadError !== null) {
    return { status: "error", message: loadError, retry: () => void reload() };
  }
  if (state.kind === "idle" || vm === null || records === null) {
    return { status: "loading" };
  }

  const queued = state.kind === "submitted";
  const currentPlace = reconcilePlace(place, partnerNationIds);
  const selected =
    currentPlace.kind === "nation"
      ? resolveSelectedNation(vm.relations, currentPlace.nationId, null)
      : null;
  const selectTab = (tabId: string) =>
    setPlace(
      currentPlace.kind === "nation"
        ? nationPlace(currentPlace.nationId, tabId)
        : { kind: "overview", tab: tabId },
    );
  const onWorkspaceKeyDownCapture = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleInspector();
      return;
    }
    if (
      event.key === "Escape" &&
      currentPlace.kind === "nation" &&
      event.target instanceof Element &&
      !event.target.closest("[role='dialog'],[role='listbox']")
    ) {
      showOverview();
    }
  };
  return {
    status: "ready",
    state,
    vm,
    records,
    battleHistory,
    hosted,
    busy: state.kind === "submitting",
    queued,
    declaringWar: state.draftCommand?.kind === "DeclareWar" && !queued,
    draftPartnerId: state.draftCommand?.partnerNationId ?? null,
    canSubmit,
    currentPlace,
    selected,
    tab: activeTab(currentPlace),
    plotView,
    layers,
    inspectorId,
    inspectorLayout,
    setInspectorWidth,
    toggleInspector,
    showOverview,
    selectNation,
    selectTab,
    onWorkspaceKeyDownCapture,
    setPlotView,
    toggleChartLayer,
    setRowAction,
    setBlockadeArea,
    clearDraft,
    submit,
    acceptPeace,
    proposePeaceTerms,
  };
}
