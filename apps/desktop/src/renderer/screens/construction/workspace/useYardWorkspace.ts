import { useCallback, useId, useMemo, useState, type KeyboardEvent } from "react";
import type { CompiledDesignVersion, ConstructionCommand } from "@bluewave/campaign-engine";
import type { EngineeringReadout } from "../../shipbuilding/engineering-status.js";
import {
  useInspectorLayout,
  type UseInspectorLayoutResult,
} from "../../shipbuilding/useInspectorLayout.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { useScreenHeaderHost } from "../../../shell/screen-header.js";
import type { UseConstructionScreenReturn } from "../hooks/useConstructionScreen.js";
import { projectRows, type ProjectRow } from "../project-progress.js";
import {
  nextProjectSelection,
  placeOf,
  railMarks,
  yardReadouts,
  type RailMark,
  type YardFigures,
  type YardPlace,
  type YardPlaceId,
  type YardTab,
} from "../yard-workspace.js";

export interface YardWorkspaceState {
  readonly place: YardPlaceId;
  readonly tabs: Readonly<Record<YardPlaceId, string>>;
  readonly selectedProjectId: string | null;
  readonly selectedCommandId: string | null;
}

export interface YardWorkspaceActions {
  readonly navigate: (place: YardPlaceId) => void;
  readonly setTab: (place: YardPlaceId, tab: string) => void;
  readonly selectProject: (projectId: string) => void;
  readonly selectDesign: (designId: string) => void;
  readonly selectCommand: (commandId: string) => void;
  readonly browseCatalog: () => void;
  readonly refresh: () => void;
  readonly clearSelection: () => void;
  readonly toggleInspector: () => void;
  readonly setInspectorWidth: (px: number) => void;
  readonly onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export interface YardWorkspaceMeta {
  readonly hosted: boolean;
  readonly place: YardPlaceId;
  readonly rows: readonly ProjectRow[];
  readonly selectedDesign: CompiledDesignVersion | null;
  readonly selectedRow: ProjectRow | undefined;
  readonly selectedCommand: ConstructionCommand | null;
  readonly figures: YardFigures | null;
  readonly marks: Readonly<Record<YardPlaceId, RailMark>> | null;
  readonly readouts: readonly EngineeringReadout[] | null;
  readonly currentPlace: YardPlace;
  readonly tab: YardTab;
  readonly selectedCommandId: string | null;
  readonly reviewing: boolean;
  readonly monthLabel: string;
  readonly busy: boolean;
  readonly inspector: UseInspectorLayoutResult;
  readonly inspectorId: string;
}

export interface YardWorkspace {
  readonly state: YardWorkspaceState;
  readonly actions: YardWorkspaceActions;
  readonly meta: YardWorkspaceMeta;
}

export function useYardWorkspace(
  session: UseConstructionScreenReturn,
  orderOpen: boolean,
  sessionId: string,
): YardWorkspace {
  const { state, selectedDesignId, setSelectedDesignId, loadScreen } = session;
  const format = usePresentationFormat();
  const hosted = useScreenHeaderHost();
  const inspectorLayout = useInspectorLayout(sessionId);
  const inspector = useMemo<UseInspectorLayoutResult>(
    () => ({
      layout: inspectorLayout.layout,
      setWidth: inspectorLayout.setWidth,
      toggleCollapsed: inspectorLayout.toggleCollapsed,
    }),
    [inspectorLayout.layout, inspectorLayout.setWidth, inspectorLayout.toggleCollapsed],
  );
  const inspectorId = useId();
  const [place, setPlace] = useState<YardPlaceId>("slipways");
  const [tabs, setTabs] = useState<Readonly<Record<YardPlaceId, string>>>(() => ({
    slipways: "project",
    catalog: "design",
    orders: "command",
    dock: "yard",
  }));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);

  const rows = useMemo(
    () => projectRows(state.projects, state.steering),
    [state.projects, state.steering],
  );
  const selectedDesign = useMemo(
    () => state.designs.find((design) => design.designId === selectedDesignId) ?? null,
    [state.designs, selectedDesignId],
  );
  const figures = useMemo(
    () =>
      state.workspace === null || state.economy === null
        ? null
        : {
            projects: rows,
            designs: state.designs,
            commands: state.workspace.commands,
            economy: state.economy,
          },
    [rows, state.designs, state.workspace, state.economy],
  );
  const marks = useMemo(() => (figures === null ? null : railMarks(figures)), [figures]);
  const readouts = useMemo(
    () =>
      figures === null || state.workspace === null
        ? null
        : yardReadouts(figures, state.workspace, format),
    [figures, state.workspace, format],
  );

  const setTab = useCallback(
    (target: YardPlaceId, tab: string) => setTabs((current) => ({ ...current, [target]: tab })),
    [],
  );
  const navigate = useCallback((target: YardPlaceId) => setPlace(target), []);
  const selectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      setTab("slipways", "project");
    },
    [setTab],
  );
  const selectDesign = useCallback(
    (designId: string) => {
      setSelectedDesignId(designId);
      setTab("catalog", "design");
    },
    [setSelectedDesignId, setTab],
  );
  const selectCommand = useCallback(
    (commandId: string) => {
      setSelectedCommandId(commandId);
      setTab("orders", "command");
    },
    [setTab],
  );
  const browseCatalog = useCallback(() => setPlace("catalog"), []);
  const refresh = useCallback(() => void loadScreen(), [loadScreen]);
  const clearSelection = useCallback(() => {
    if (place === "slipways") setSelectedProjectId(null);
    if (place === "orders") setSelectedCommandId(null);
  }, [place]);
  const onKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        inspector.toggleCollapsed();
        return;
      }
      if (
        event.key === "Escape" &&
        event.target instanceof Element &&
        !event.target.closest("[role='dialog'],[role='listbox']")
      ) {
        if (place === "slipways") setSelectedProjectId(null);
        if (place === "orders") setSelectedCommandId(null);
      }
    },
    [inspector.toggleCollapsed, place],
  );

  const currentPlace = placeOf(place);
  const tab =
    currentPlace.tabs.find((candidate) => candidate.id === tabs[place]) ?? currentPlace.tabs[0]!;
  const selectedRow = rows.find(
    (row) => row.projectId === nextProjectSelection(selectedProjectId, rows),
  );
  const selectedCommand =
    state.workspace?.commands.find((command) => command.commandId === selectedCommandId) ?? null;

  const monthLabel = `${state.month?.year ?? ""}-${String(state.month?.month ?? 0).padStart(2, "0")}`;
  const busy = state.pendingRequest !== null || state.requiresRefresh;

  const workspaceState = useMemo<YardWorkspaceState>(
    () => ({ place, tabs, selectedProjectId, selectedCommandId }),
    [place, tabs, selectedProjectId, selectedCommandId],
  );
  const workspaceActions = useMemo<YardWorkspaceActions>(
    () => ({
      navigate,
      setTab,
      selectProject,
      selectDesign,
      selectCommand,
      browseCatalog,
      refresh,
      clearSelection,
      toggleInspector: inspector.toggleCollapsed,
      setInspectorWidth: inspector.setWidth,
      onKeyDownCapture,
    }),
    [
      navigate,
      setTab,
      selectProject,
      selectDesign,
      selectCommand,
      browseCatalog,
      refresh,
      clearSelection,
      inspector.toggleCollapsed,
      inspector.setWidth,
      onKeyDownCapture,
    ],
  );
  const workspaceMeta = useMemo<YardWorkspaceMeta>(
    () => ({
      hosted,
      place,
      rows,
      selectedDesign,
      selectedRow,
      selectedCommand,
      figures,
      marks,
      readouts,
      currentPlace,
      tab,
      selectedCommandId,
      reviewing: orderOpen,
      monthLabel,
      busy,
      inspector,
      inspectorId,
    }),
    [
      hosted,
      place,
      rows,
      selectedDesign,
      selectedRow,
      selectedCommand,
      figures,
      marks,
      readouts,
      currentPlace,
      tab,
      selectedCommandId,
      orderOpen,
      monthLabel,
      busy,
      inspector,
      inspectorId,
    ],
  );

  return { state: workspaceState, actions: workspaceActions, meta: workspaceMeta };
}
