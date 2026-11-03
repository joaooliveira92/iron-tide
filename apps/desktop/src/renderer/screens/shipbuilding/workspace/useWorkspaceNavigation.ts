import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import type { ArmourRegionId, DesignDraft } from "@bluewave/ship-design";
import type { BoardFinding } from "../../../components/design-workspace/validation/boardFindings.js";
import { useFindingsView } from "../../../components/design-workspace/validation/FindingsControl.js";
import { useFormNavigation } from "../../../components/design-workspace/selection/useFormNavigation.js";
import { handleUndoShortcut } from "../../../components/design-workspace/undoShortcut.js";
import { findDrawingControl } from "../../../components/design-workspace/selection/navigation.js";
import { planModel } from "../../../components/design-workspace/panels/hull-plan/planModel.js";
import { useHullPlanEditing } from "../../../components/design-workspace/panels/hull-plan/useHullPlanEditing.js";
import {
  DEFAULT_VIEW,
  SHIP_VIEWS,
  toggleOverlay,
  type ShipOverlay,
  type ShipView,
} from "../../../components/design-workspace/panels/hull-plan/ship-view.js";
import {
  IDLE_TOOL,
  type PlanTool,
} from "../../../components/design-workspace/panels/hull-plan/PlanToolbar.js";
import type { IsoSide } from "../components/ViewToolbar.js";
import {
  sameEntity,
  type ShipEntity,
} from "../../../components/design-workspace/selection/store.js";
import type { EntityContext } from "../../../components/design-workspace/selection/facts.js";
import { useLeaveGuard } from "../../../shell/CampaignShellContext.js";
import { useScreenHeaderHost } from "../../../shell/screen-header.js";
import { useMinWidth } from "../../../lib/use-min-width.js";
import { COMMAND_OVERLAY_MIN_WIDTH } from "../../overview/hooks/useOverviewModel.js";
import { placeForDestination } from "../destination-place.js";
import { placeForEntity, focusEntityControl } from "../selection.js";
import {
  categoriesOf,
  placeOf,
  SECTIONS,
  type DesignSectionId,
  type InspectorPlace,
} from "../design-sections.js";
import { viewForEntity } from "../flaw.js";
import { focusesArcs, layersFor } from "../stage-layers.js";
import { aluminiumModel } from "../aluminium-view.js";
import { antiAircraftModel } from "../anti-aircraft-view.js";
import { armamentEntries } from "../armament.js";
import { colonialServiceModel } from "../colonial-service-view.js";
import { machineryModel, plantDeltas } from "../machinery-view.js";
import { overviewModel } from "../overview.js";
import { protectionModel } from "../protection-view.js";
import { systemsModel } from "../systems-view.js";
import type { WorkspaceSession } from "./useWorkspaceSession.js";
import { TAB_BATTERY, isTyping, tabLabel } from "./inspector-place.js";

export type WorkspaceDialog = "start" | "file" | "history" | "alternatives" | "names";

export function useWorkspaceNavigation({ state, actions: session }: WorkspaceSession) {
  const { format, draft, view, content, env, batteries, findings, selection } = state;
  const month = state.month;

  const wide = useMinWidth(COMMAND_OVERLAY_MIN_WIDTH);
  const hosted = useScreenHeaderHost();
  const [findingsView, setFindingsView] = useFindingsView();
  const [shipView, setShipView] = useState<ShipView>(DEFAULT_VIEW);
  const [isoSide, setIsoSide] = useState<IsoSide>("starboard");
  const [overlays, setOverlays] = useState<ReadonlySet<ShipOverlay>>(() => layersFor(null));
  const [planTool, setPlanTool] = useState<PlanTool>(IDLE_TOOL);
  const [place, setPlace] = useState<InspectorPlace | null>(null);
  const [showSystemsUnavailable, setShowSystemsUnavailable] = useState(false);
  const [armourHighlight, setArmourHighlight] = useState<ArmourRegionId | null>(null);
  const [dialog, setDialog] = useState<WorkspaceDialog | null>(null);
  const [pendingLeave, setPendingLeave] = useState<Parameters<typeof leave>[0] | null>(null);
  const drawerBodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef(place);
  placeRef.current = place;

  const leave = useLeaveGuard((target) => {
    if (!state.autosave.unsaved || target === "ship-design") return true;
    setPendingLeave(target);
    return false;
  });

  const model = useMemo(
    () => planModel(draft, content, view, month, findings),
    [draft, content, view, month, findings],
  );
  const editing = useHullPlanEditing({
    draft,
    content,
    month,
    frame: model.frame,
    zones: model.zones,
    entryOf: model.entryOf,
    edit: session.edit,
    givenTool: planTool,
    onTool: setPlanTool,
  });
  const selectedEntity = useSyncExternalStore(
    (onStoreChange) => selection.subscribe(onStoreChange),
    () => selection.get().selected,
  );
  const selectedInstanceId = selectedEntity?.kind === "fitting" ? selectedEntity.instanceId : null;

  const lastPinned = useRef<ShipEntity | null>(null);
  const pendingFocus = useRef<ShipEntity | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const contentRef = useRef(content);
  contentRef.current = content;
  useEffect(
    () =>
      selection.subscribe(() => {
        const pinned = selection.get().selected;
        if (sameEntity(pinned, lastPinned.current)) return;
        lastPinned.current = pinned;
        if (pinned === null) return;
        const at = placeForEntity(pinned, { draft: draftRef.current, content: contentRef.current });
        if (at === null) return;
        pendingFocus.current = pinned;
        flushSync(() => {
          if (placeRef.current?.section !== at.section) setOverlays(layersFor(at.section));
          setPlace(at);
        });
      }),
    [selection],
  );
  useEffect(() => {
    const pinned = pendingFocus.current;
    if (pinned === null) return;
    pendingFocus.current = null;
    focusEntityControl(drawerBodyRef.current ?? document, pinned);
  }, [selectedEntity, place]);

  const placeSection = place?.section;
  const placeTab = place?.tab;
  const aluminium = useMemo(
    () => aluminiumModel(view, env.ctx.balance.aluminiumSuperstructure, month),
    [view, env, month],
  );
  const antiAircraft = useMemo(
    () => antiAircraftModel(draft, view, env.ctx.balance.antiAircraft, month),
    [draft, view, env, month],
  );
  const overview = useMemo(
    () =>
      placeSection === "overview" ? overviewModel(draft, view, batteries, month, format) : null,
    [placeSection, draft, view, batteries, month, format],
  );
  const machinery = useMemo(
    () => (placeSection === "machinery" ? machineryModel(draft, view, env, format) : null),
    [placeSection, draft, view, env, format],
  );
  const protection = useMemo(
    () =>
      placeSection === "protection"
        ? protectionModel(draft, view, state.armourMaterials, Number(month.slice(0, 4)))
        : null,
    [placeSection, draft, view, state.armourMaterials, month],
  );
  const armament = useMemo(() => {
    const role =
      placeSection === "armament" && placeTab !== undefined ? TAB_BATTERY[placeTab] : undefined;
    return role === undefined
      ? null
      : armamentEntries(role, batteries, draft, view, content, format);
  }, [placeSection, placeTab, batteries, draft, view, content, format]);
  const systemCategories = useMemo(
    () => (placeSection === "systems" && place !== null ? categoriesOf(place) : null),
    [placeSection, place],
  );
  const systems = useMemo(
    () =>
      systemCategories === null
        ? null
        : systemsModel(
            systemCategories,
            draft,
            content,
            month,
            env.ctx.unlockedTechs,
            showSystemsUnavailable,
          ),
    [systemCategories, draft, content, month, env, showSystemsUnavailable],
  );
  const colonial = useMemo(
    () =>
      placeSection === "systems" && placeTab === "accommodation"
        ? colonialServiceModel(view)
        : null,
    [placeSection, placeTab, view],
  );
  const machineryDeltas = useMemo(
    () => (placeSection === "machinery" ? plantDeltas(draft, state.nationEnv, view, format) : null),
    [placeSection, draft, state.nationEnv, view, format],
  );
  const entityCtx: EntityContext = useMemo(
    () => ({ draft, view, content, zones: model.zones, batteries, findings }),
    [draft, view, content, model.zones, batteries, findings],
  );

  const section = place === null ? null : SECTIONS[place.section];
  const tab = place === null ? null : tabLabel(place);
  const tabId = place === null ? null : place.tab;

  const openSection = (id: DesignSectionId, tabId?: string) => {
    if (placeRef.current?.section !== id) setOverlays(layersFor(id));
    setPlace(placeOf(id, tabId));
  };
  const closeDrawer = () => {
    setPlace(null);
    setOverlays(layersFor(null));
  };
  const selectArmourRegion = (region: ArmourRegionId | null) => {
    setArmourHighlight(region);
    if (region !== null) setOverlays((current) => new Set(current).add("armour"));
  };
  const flipOverlay = (overlay: ShipOverlay) =>
    setOverlays((current) => toggleOverlay(current, overlay));
  const showOnShip = (f: BoardFinding) => {
    const target = f.entities[0];
    if (target === undefined) return;
    setShipView((current) => viewForEntity(target, current));
    selection.select(target, f.key);
  };
  const clearSelection = () => {
    const was = selection.get().selected;
    selection.clear();
    if (was !== null && rootRef.current !== null) findDrawingControl(rootRef.current, was)?.focus();
  };
  const goTo = useFormNavigation((destination) => {
    const at = placeForDestination(destination.target, { draft, content, batteries });
    if (placeRef.current?.section !== at.section) setOverlays(layersFor(at.section));
    setPlace(at);
  }, drawerBodyRef);
  const finish = () => {
    openSection("review", "finish");
    if (state.needsName) session.focusClassName();
  };
  const loadDesign = (design: DesignDraft, name: string | null) => {
    session.loadDraft(design);
    if (name !== null) session.setShipClassName(name);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    handleUndoShortcut(e, {
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      undo: session.undo,
      redo: session.redo,
    });
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    const picked = SHIP_VIEWS[Number(e.key) - 1];
    if (picked !== undefined) setShipView(picked);
  };
  const onKeyDownCapture = (e: ReactKeyboardEvent) => {
    if (e.key !== "Escape") return;
    const s = selection.get();
    if (s.selected === null || s.preview !== null || s.markerPreview) return;
    if (!(e.target instanceof Element) || !e.target.closest("[data-selection-scope]")) return;
    e.preventDefault();
    e.stopPropagation();
    if (s.finding !== null) selection.clearFinding();
    else selection.clear();
  };

  return {
    actions: {
      openSection,
      closeDrawer,
      selectArmourRegion,
      flipOverlay,
      showOnShip,
      clearSelection,
      goTo,
      finish,
      loadDesign,
      setShipView,
      setIsoSide,
      setFindingsView,
      setShowSystemsUnavailable,
      setDialog,
      setPendingLeave,
      leave,
      onKeyDown,
      onKeyDownCapture,
    },
    meta: {
      wide,
      hosted,
      place,
      section,
      tab,
      tabId,
      shipView,
      isoSide,
      overlays,
      planTool,
      findingsView,
      showSystemsUnavailable,
      armourHighlight,
      dialog,
      pendingLeave,
      rootRef,
      drawerBodyRef,
      model,
      editing,
      entityCtx,
      selectedEntity,
      selectedInstanceId,
      aluminium,
      antiAircraft,
      overview,
      machinery,
      protection,
      armament,
      systems,
      colonial,
      machineryDeltas,
      focusArcs: focusesArcs(placeSection ?? null),
    },
  };
}

export type WorkspaceNavigation = ReturnType<typeof useWorkspaceNavigation>;
