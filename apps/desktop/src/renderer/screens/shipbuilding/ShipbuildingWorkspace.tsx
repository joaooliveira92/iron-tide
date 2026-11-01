import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { PencilRuler } from "lucide-react";
import type { ArmourRegionId, BatteryRole, ComponentCategory } from "@bluewave/ship-design";
import { Alert } from "../../components/ui/alert.js";
import { toast } from "../../components/ui/toast.js";
import {
  AlternativesPanel,
  BriefPanel,
  ComparePanel,
  ChoiceProblemDialog,
  ConfirmDialog,
  FilePanel,
  FindingsPanel,
  ForecastPanel,
  HistoryPanel,
  HullPanel,
  HullPlanPanel,
  IDLE_TOOL,
  LedgerPanel,
  MetricsPanel,
  PlacementsPanel,
  RebuildPanel,
  RevisionPanel,
  SelectionInspector,
  ShipSelectionProvider,
  ShipViewBoundary,
  SubmitPanel,
  TopsidePanel,
  handleUndoShortcut,
  findDrawingControl,
  linkedEntities,
  mountNameMap,
  planModel,
  plainShipTypeName,
  plural,
  DraftSaveWarning,
  useDraftAutosave,
  useFindingsView,
  useHullPlanEditing,
  useRestoredDraftToast,
  useDesignSession,
  useFormNavigation,
  technologyMonths,
  type EntityContext,
  type PlanTool,
  type RevisionProject,
  shipTypeIcon,
} from "../../components/design-workspace/index.js";
import {
  DEFAULT_VIEW,
  SHIP_VIEWS,
  toggleOverlay,
  type ShipOverlay,
  type ShipView,
} from "../../components/design-workspace/panels/hull-plan/ship-view.js";
import { sameEntity, type ShipEntity } from "../../components/design-workspace/selection/store.js";
import type { BoardFinding } from "../../components/design-workspace/validation/boardFindings.js";
import { ChartDesk, INDEX_TABS_CLEARANCE } from "../../components/slate/ChartDesk.js";
import { DepartmentDrawer } from "../../components/slate/DepartmentDrawer.js";
import { IndexTabs } from "../../components/slate/IndexTabs.js";
import { useMinWidth } from "../../lib/use-min-width.js";
import { useCampaignMonthId, useLeaveGuard } from "../../shell/CampaignShellContext.js";
import { ScreenHeader, useScreenHeaderHost } from "../../shell/screen-header.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { COMMAND_OVERLAY_MIN_WIDTH } from "../overview/hooks/useOverviewModel.js";
import {
  AluminiumSuperstructurePanel,
  AntiAircraftPanel,
  ArmamentEditor,
  ClassNameBrowser,
  ColonialServicePanel,
  CommandBar,
  DesignIdentity,
  DesignStatusChip,
  DrawerBody,
  DEFAULT_PRIORITIES,
  EngineeringStatusBar,
  FlawSlip,
  MachineryEditor,
  NotAvailable,
  OverviewPanel,
  ProtectionEditor,
  ShipStage,
  SystemsPanel,
  ViewToolbar,
  ReferenceDesignBrowser,
  WorkspaceDialog,
  type IsoSide,
  type PriorityLevel,
} from "./components/index.js";
import { aluminiumModel } from "./aluminium-view.js";
import { antiAircraftModel } from "./anti-aircraft-view.js";
import { armamentEntries } from "./armament.js";
import { nameGroups, namePoolFor, suggestClassName } from "./class-name-suggestions.js";
import { colonialServiceModel } from "./colonial-service-view.js";
import { machineryModel, plantDeltas } from "./machinery-view.js";
import { overviewModel, type PriorityId } from "./overview.js";
import { protectionModel } from "./protection-view.js";
import { addSystemEdit, systemsModel } from "./systems-view.js";
import {
  SECTIONS,
  categoriesOf,
  placeOf,
  type DesignSectionId,
  type InspectorPlace,
} from "./design-sections.js";
import { placeForDestination } from "./destination-place.js";
import { DESIGN_SECTION_SUMMARY, designIndexTabs } from "./design-tabs.js";
import { engineeringStatus } from "./engineering-status.js";
import { enteredSessions } from "./entered-sessions.js";
import { flawQueue, viewForEntity, type Flaw } from "./flaw.js";
import { sectionStatuses } from "./section-status.js";
import { focusEntityControl, placeForEntity } from "./selection.js";
import { focusesArcs, layersFor } from "./stage-layers.js";

const VALIDATION_TOAST_ID = "shipbuilding-validation";
const VALIDATION_TOAST_MS = 4000;
const DRAWER_WIDTH = "28rem";
const DRAWER_GAP = "0.75rem";

type OverflowDialog = "start" | "file" | "history" | "alternatives" | "names";

const TAB_BATTERY: { readonly [tab: string]: BatteryRole } = {
  main: "MAIN",
  secondary: "SECONDARY",
  torpedoes: "TORPEDO",
};

const tabLabel = (at: InspectorPlace): string =>
  SECTIONS[at.section].tabs.find((t) => t.id === at.tab)?.label ?? at.tab;

const isTyping = (target: EventTarget): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest("input, textarea, select, [role='combobox'], [role='textbox']") !== null);

export interface ShipbuildingWorkspaceProps {
  readonly sessionId?: string;
  readonly projects?: readonly RevisionProject[];
}

export function ShipbuildingWorkspace({ sessionId, projects = [] }: ShipbuildingWorkspaceProps) {
  const campaignMonth = useCampaignMonthId();
  const format = usePresentationFormat();
  const wide = useMinWidth(COMMAND_OVERLAY_MIN_WIDTH);
  const hosted = useScreenHeaderHost();
  const {
    state,
    actions,
    env,
    batteries,
    findings,
    choiceCheck,
    selection,
    loadPreset,
    loadDraft,
    requestPreset,
    pendingPreset,
    setPendingPreset,
    starters,
    armourMaterials,
  } = useDesignSession(campaignMonth);
  const { draft, view, content } = state;
  const autosave = useDraftAutosave({
    sessionId,
    presetId: state.preset.id,
    log: state.log,
    restore: actions.restore,
  });
  const [findingsView, setFindingsView] = useFindingsView();
  const [shipView, setShipView] = useState<ShipView>(DEFAULT_VIEW);
  const [isoSide, setIsoSide] = useState<IsoSide>("starboard");
  const [overlays, setOverlays] = useState<ReadonlySet<ShipOverlay>>(() => layersFor(null));
  const [planTool, setPlanTool] = useState<PlanTool>(IDLE_TOOL);
  const [selectedEntity, setSelectedEntity] = useState<ShipEntity | null>(null);
  const drawerBodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flipOverlay = (overlay: ShipOverlay) =>
    setOverlays((current) => toggleOverlay(current, overlay));
  const model = useMemo(
    () => planModel(draft, content, view, state.month, findings),
    [draft, content, view, state.month, findings],
  );
  const editing = useHullPlanEditing({
    draft,
    content,
    month: state.month,
    frame: model.frame,
    zones: model.zones,
    entryOf: model.entryOf,
    edit: actions.edit,
    givenTool: planTool,
    onTool: setPlanTool,
  });
  const [place, setPlace] = useState<InspectorPlace | null>(null);
  const placeRef = useRef(place);
  placeRef.current = place;
  const openSection = (section: DesignSectionId, tab?: string) => {
    if (placeRef.current?.section !== section) setOverlays(layersFor(section));
    setPlace(placeOf(section, tab));
  };
  const closeDrawer = () => {
    setPlace(null);
    setOverlays(layersFor(null));
  };
  const [shipClassName, setShipClassName] = useState("");
  const [priorities, setPriorities] =
    useState<Readonly<Record<PriorityId, PriorityLevel>>>(DEFAULT_PRIORITIES);
  const setPriority = (id: PriorityId, level: PriorityLevel) =>
    setPriorities((p) => ({ ...p, [id]: level }));
  const [showSystemsUnavailable, setShowSystemsUnavailable] = useState(false);
  const [armourHighlight, setArmourHighlight] = useState<ArmourRegionId | null>(null);
  const selectArmourRegion = (region: ArmourRegionId | null) => {
    setArmourHighlight(region);
    if (region !== null) setOverlays((current) => new Set(current).add("armour"));
  };
  const [dialog, setDialog] = useState<OverflowDialog | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [nameCursor, setNameCursor] = useState(0);
  const [pendingLeave, setPendingLeave] = useState<Parameters<typeof leave>[0] | null>(null);
  const leave = useLeaveGuard((target) => {
    if (!autosave.unsaved || target === "ship-design") return true;
    setPendingLeave(target);
    return false;
  });

  const [returning] = useState(() => enteredSessions.has(sessionId));
  useEffect(() => {
    enteredSessions.mark(sessionId);
  }, [sessionId]);
  useRestoredDraftToast({
    restored: returning ? null : autosave.restored,
    dismiss: autosave.dismiss,
    startOver: () => loadPreset(state.preset.id),
  });

  const findingCounts = `${view.counts.BLOCKING} blocking · ${view.counts.CRITICAL} critical · ${plural(view.counts.WARNING, "warning")}`;
  const needsName = sessionId !== undefined && shipClassName.trim() === "";
  const status =
    view.valid && needsName
      ? { label: "Needs a class name", tone: "warn" as const, detail: findingCounts }
      : {
          label: view.valid ? "Can be submitted" : "Cannot be built",
          tone: view.valid ? ("ok" as const) : ("bad" as const),
          detail: findingCounts,
        };
  const shipType = draft.requirement.category;
  const ShipTypeIcon = shipTypeIcon(shipType);
  const validate = () => {
    openSection("review", "findings");
    toast(`${view.valid ? "No blocking findings" : "Blocking findings found"}: ${findingCounts}.`, {
      id: VALIDATION_TOAST_ID,
      duration: VALIDATION_TOAST_MS,
    });
  };
  const [focusName, setFocusName] = useState(false);
  useEffect(() => {
    if (!focusName) return;
    nameInputRef.current?.focus();
    setFocusName(false);
  }, [focusName]);
  const finish = () => {
    openSection("review", "finish");
    if (needsName) setFocusName(true);
  };
  const readouts = useMemo(() => engineeringStatus(view, format), [view, format]);

  const fittings = useMemo(() => {
    const category = new Map(content.catalogue.map((e) => [e.id, e.category]));
    return new Map(
      draft.placements.flatMap((p): [string, ComponentCategory][] => {
        const c = category.get(p.componentId);
        return c === undefined ? [] : [[p.instanceId, c]];
      }),
    );
  }, [draft, content]);
  const statuses = useMemo(() => sectionStatuses(findings, fittings), [findings, fittings]);
  const flaws = useMemo(
    () => flawQueue(findings, { draft, content }).filter((flaw) => flaw.tier !== "warning"),
    [findings, draft, content],
  );

  const nationEnv = useMemo(
    () => content.environmentFor(state.month, draft.nationId),
    [content, state.month, draft.nationId],
  );
  const aluminium = aluminiumModel(view, env.ctx.balance.aluminiumSuperstructure, state.month);
  const antiAircraft = antiAircraftModel(draft, view, env.ctx.balance.antiAircraft, state.month);
  const namePool = namePoolFor(nationEnv.ctx.navalProfile, shipType);
  const machineryDeltas = useMemo(
    () => (place?.section === "machinery" ? plantDeltas(draft, nationEnv, view, format) : null),
    [place?.section, draft, nationEnv, view, format],
  );

  const entityCtx: EntityContext = {
    draft,
    view,
    content,
    zones: model.zones,
    batteries,
    findings,
  };
  const lastPinned = useRef<ShipEntity | null>(null);
  useEffect(() => {
    const unsubscribe = selection.subscribe(() => {
      const pinned = selection.get().selected;
      if (sameEntity(pinned, lastPinned.current)) return;
      lastPinned.current = pinned;
      setSelectedEntity(pinned);
      if (pinned === null) return;
      const at = placeForEntity(pinned, { draft, content });
      if (at === null) return;
      flushSync(() => {
        if (placeRef.current?.section !== at.section) setOverlays(layersFor(at.section));
        setPlace(at);
      });
      focusEntityControl(drawerBodyRef.current ?? document, pinned);
    });
    return unsubscribe;
  }, [selection, draft, content]);
  const selectedInstanceId = selectedEntity?.kind === "fitting" ? selectedEntity.instanceId : null;

  const showOnShip = (f: BoardFinding) => {
    const target = f.entities[0];
    if (target === undefined) return;
    setShipView((current) => viewForEntity(target, current));
    selection.select(target, f.key);
  };

  function fittingsPanel(at: InspectorPlace): ReactNode {
    const categories = categoriesOf(at);
    const hasFittings =
      [...fittings.values()].some((c) => categories.has(c)) ||
      content.catalogue.some((e) => categories.has(e.category));
    if (!hasFittings) return null;
    return (
      <PlacementsPanel
        title={`${tabLabel(at)} fittings`}
        categories={categories}
        names={mountNameMap(batteries)}
        draft={draft}
        content={content}
        month={state.month}
        view={view}
        edit={actions.edit}
        onSelect={(instanceId) => selection.select({ kind: "fitting", instanceId })}
        selectedInstanceId={selectedInstanceId}
      />
    );
  }

  function fittingsOnly(at: InspectorPlace): ReactNode {
    return (
      fittingsPanel(at) ?? (
        <NotAvailable title={`${tabLabel(at)}: not available`}>
          Nothing of this kind can be fitted to this design yet.
        </NotAvailable>
      )
    );
  }

  function tabBody(at: InspectorPlace): ReactNode {
    switch (at.section) {
      case "overview":
        return at.tab === "brief" ? (
          <>
            <DesignIdentity
              month={state.month}
              months={campaignMonth !== null ? null : technologyMonths(state.month)}
              onMonth={actions.setMonth}
              names={{
                canSuggest: namePool.length > 0,
                onBrowse: () => setDialog("names"),
                onSuggest: () => {
                  const next = suggestClassName(namePool, shipClassName, nameCursor);
                  if (next === null) return;
                  setShipClassName(next.name);
                  setNameCursor(next.cursor);
                },
              }}
            />
            <BriefPanel
              draft={draft}
              view={view}
              edit={actions.edit}
              errorFor={choiceCheck.errorFor}
              ctx={env.ctx}
            />
          </>
        ) : (
          <>
            <OverviewPanel
              model={overviewModel(draft, view, batteries, state.month, format)}
              priorities={priorities}
              onPriority={setPriority}
            />
            <MetricsPanel view={view} />
            <LedgerPanel view={view} />
            <ForecastPanel view={view} treasuryUnitMicro={content.treasuryUnitMicro} />
          </>
        );
      case "hull":
        return at.tab === "stability" ? (
          <TopsidePanel view={view} />
        ) : (
          <>
            <HullPanel
              draft={draft}
              content={content}
              edit={actions.edit}
              errorFor={choiceCheck.errorFor}
            />
            {aluminium.offered && (
              <AluminiumSuperstructurePanel model={aluminium} edit={actions.edit} />
            )}
            {fittingsPanel(at)}
          </>
        );
      case "machinery":
        return at.tab === "performance" ? (
          <MetricsPanel view={view} />
        ) : (
          <>
            <MachineryEditor
              errorFor={choiceCheck.errorFor}
              model={machineryModel(draft, view, env, format)}
              edit={actions.edit}
              previewDeltas={machineryDeltas ?? undefined}
              recommended={{
                targetSpeedMilliKnots: state.preset.draft.requirement.requiredSpeedMilliKnots,
                cruiseSpeedMilliKnots: state.preset.draft.requirement.cruiseSpeedMilliKnots,
                rangeNm: state.preset.draft.requirement.requiredRangeNm,
              }}
            />
            {fittingsPanel(at)}
          </>
        );
      case "protection":
        return at.tab === "armour" ? (
          <>
            <ProtectionEditor
              errorFor={choiceCheck.errorFor}
              model={protectionModel(draft, view, armourMaterials, Number(state.month.slice(0, 4)))}
              edit={actions.edit}
              onSelectRegion={selectArmourRegion}
              selectedRegion={armourHighlight}
            />
            {fittingsPanel(at)}
          </>
        ) : (
          fittingsOnly(at)
        );
      case "armament": {
        const role = TAB_BATTERY[at.tab];
        if (role === undefined)
          return antiAircraft.offered && at.tab === "other" ? (
            <>
              <AntiAircraftPanel model={antiAircraft} edit={actions.edit} />
              {fittingsPanel(at)}
            </>
          ) : (
            fittingsOnly(at)
          );
        const entries = armamentEntries(role, batteries, draft, view, content, format);
        return (
          <>
            <ArmamentEditor
              entries={entries}
              draft={draft}
              content={content}
              findings={findings}
              month={state.month}
              edit={actions.edit}
              onSelect={selection.select}
              selectedInstanceId={selectedInstanceId}
            />
            {fittingsPanel(at)}
          </>
        );
      }
      case "systems":
        return (
          <>
            {at.tab === "accommodation" && (
              <ColonialServicePanel model={colonialServiceModel(view)} edit={actions.edit} />
            )}
            <SystemsPanel
              groups={systemsModel(
                categoriesOf(at),
                draft,
                content,
                state.month,
                env.ctx.unlockedTechs,
                showSystemsUnavailable,
              )}
              showUnavailable={showSystemsUnavailable}
              onShowUnavailable={setShowSystemsUnavailable}
              onAdd={(id) => {
                const e = addSystemEdit(id, draft, content);
                if (e) actions.edit(e);
              }}
            />
            {fittingsPanel(at)}
          </>
        );
      case "review":
        return at.tab === "findings" ? (
          <FindingsPanel
            view={view}
            findings={findings}
            suggest={actions.suggest}
            onApply={actions.edit}
            onShowOnShip={showOnShip}
          />
        ) : at.tab === "rebuild" ? (
          <RebuildPanel
            sessionId={sessionId}
            draft={draft}
            content={content}
            onLoad={loadDraft}
            dirty={state.editCount > 0}
          />
        ) : (
          <>
            {projects.length > 0 && (
              <RevisionPanel
                sessionId={sessionId}
                projects={projects}
                history={state.history.slice(0, state.editCount)}
                draft={draft}
                startDraft={state.preset.draft}
                content={content}
                onLoad={loadDraft}
                dirty={state.editCount > 0}
              />
            )}
            {sessionId !== undefined ? (
              <SubmitPanel
                sessionId={sessionId}
                draft={draft}
                valid={view.valid}
                name={shipClassName}
                onNameChange={setShipClassName}
              />
            ) : (
              <NotAvailable title="Finishing: not available">
                A design is finished into a campaign; open Ship design from a campaign to submit it.
              </NotAvailable>
            )}
          </>
        );
    }
  }

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

  const section = place === null ? null : SECTIONS[place.section];
  const tab = place === null || section === null ? null : tabLabel(place);
  const tabId = place === null || section === null ? null : place.tab;
  const body = place === null ? null : tabBody(place);

  const commandBar = (
    <CommandBar
      embedded={hosted}
      shipClassName={shipClassName}
      onShipClassName={setShipClassName}
      nameInputRef={nameInputRef}
      onStartFromReference={() => setDialog("start")}
      shipTypeName={plainShipTypeName(shipType)}
      shipTypeIcon={<ShipTypeIcon aria-hidden="true" className="size-4" />}
      canUndo={state.canUndo}
      canRedo={state.canRedo}
      onUndo={actions.undo}
      onRedo={actions.redo}
      compare={<ComparePanel baseline={state.baseline} view={view} name={state.preset.name} />}
      autosaved={autosave.enabled}
      onValidate={validate}
      onFinish={finish}
      overflow={[
        {
          label: "Design",
          items: [
            { label: "Edit history…", onSelect: () => setDialog("history") },
            { label: "Design alternatives…", onSelect: () => setDialog("alternatives") },
            {
              label: "Rebuild a completed ship…",
              onSelect: () => openSection("review", "rebuild"),
            },
          ],
        },
        {
          label: "File",
          items: [{ label: "Import or export design…", onSelect: () => setDialog("file") }],
        },
        {
          label: "Danger zone",
          items: [
            {
              label: "Reset to the starting design",
              destructive: true,
              onSelect: () => setPendingPreset(state.preset.id),
            },
          ],
        },
      ]}
    />
  );

  const stage = (
    <ShipStage
      toolbar={
        <ViewToolbar
          view={shipView}
          onView={setShipView}
          overlays={overlays}
          onToggleOverlay={flipOverlay}
          isoSide={isoSide}
          onIsoSide={setIsoSide}
          findingsView={findingsView}
          onFindingsView={setFindingsView}
        />
      }
    >
      <ShipViewBoundary resetKey={draft}>
        <HullPlanPanel
          draft={draft}
          content={content}
          view={view}
          month={state.month}
          edit={actions.edit}
          findings={findings}
          model={model}
          editing={editing}
          shipView={shipView}
          overlays={overlays}
          armourHighlight={armourHighlight}
          findingsView={findingsView}
          onFindingsView={setFindingsView}
          isoSide={isoSide}
          highlightId={selectedInstanceId ?? undefined}
          focusArcs={focusesArcs(place?.section ?? null)}
        />
      </ShipViewBoundary>
    </ShipStage>
  );

  const tabs = (
    <IndexTabs
      label="Design sections"
      testId="design-sections"
      groups={designIndexTabs(statuses)}
      openId={place?.section ?? null}
      onOpen={(id) => (place?.section === id ? closeDrawer() : openSection(id))}
      attached={wide}
    />
  );

  const drawer =
    place === null || section === null || tab === null || tabId === null ? null : (
      <DepartmentDrawer
        title={section.label}
        summary={DESIGN_SECTION_SUMMARY[place.section]}
        width="narrow"
        testId="design-drawer"
        onClose={closeDrawer}
      >
        <DrawerBody
          title={section.label}
          tabs={section.tabs}
          tab={tabId}
          onTab={(t) => openSection(place.section, t)}
        >
          <div
            ref={drawerBodyRef}
            data-selection-scope=""
            className="space-y-3"
            onFocus={(e) => selection.setLinked(linkedEntities(e.target, entityCtx))}
            onBlur={(e) => {
              if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)))
                selection.setLinked([]);
            }}
          >
            <SelectionInspector ctx={entityCtx} onGoTo={goTo} onClear={clearSelection} />
            {state.editError !== null && <Alert variant="destructive">{state.editError}</Alert>}
            {body}
          </div>
        </DrawerBody>
      </DepartmentDrawer>
    );

  const foot = (
    <>
      <FlawSlip
        flaws={flaws}
        onShow={(flaw: Flaw) => showOnShip(flaw.finding)}
        onFix={(flaw: Flaw) => {
          if (flaw.fix !== null) openSection(flaw.fix.place.section, flaw.fix.place.tab);
        }}
        onReview={() => openSection("review", "findings")}
      />
      <EngineeringStatusBar
        readouts={readouts}
        format={format}
        lead={
          <DesignStatusChip
            status={status}
            {...(needsName && view.valid ? { onAction: () => nameInputRef.current?.focus() } : {})}
          />
        }
      />
    </>
  );

  const drawerClearance =
    place === null
      ? INDEX_TABS_CLEARANCE
      : `calc(${INDEX_TABS_CLEARANCE} + ${DRAWER_WIDTH} + ${DRAWER_GAP})`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    handleUndoShortcut(e, { ...state, ...actions });
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    const picked = SHIP_VIEWS[Number(e.key) - 1];
    if (picked !== undefined) setShipView(picked);
  };
  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const s = selection.get();
    if (s.selected === null || s.preview !== null || s.markerPreview) return;
    if (!(e.target instanceof Element) || !e.target.closest("[data-selection-scope]")) return;
    e.preventDefault();
    e.stopPropagation();
    if (s.finding !== null) selection.clearFinding();
    else selection.clear();
  };

  const overlay = (
    <>
      <ChoiceProblemDialog
        problem={choiceCheck.problem}
        open={choiceCheck.open}
        onOpenChange={choiceCheck.setOpen}
        onUndo={actions.undo}
      />
      <ConfirmDialog
        open={pendingPreset !== null}
        onOpenChange={(open) => !open && setPendingPreset(null)}
        title={
          pendingPreset === state.preset.id
            ? "Reset to the starting design?"
            : "Start from a different design?"
        }
        description="This replaces the design you are working on, and its edit history is cleared."
        confirmLabel="Replace my design"
        onConfirm={() => {
          if (pendingPreset !== null) loadPreset(pendingPreset);
          setPendingPreset(null);
        }}
      />
      <ConfirmDialog
        open={pendingLeave !== null}
        onOpenChange={(open) => !open && setPendingLeave(null)}
        title="Leave with unsaved changes?"
        description="Your latest edits could not be saved to the campaign. Bluewave keeps retrying, but leaving now may lose them."
        confirmLabel="Leave anyway"
        onConfirm={() => {
          if (pendingLeave !== null) leave(pendingLeave);
          setPendingLeave(null);
        }}
      />
      <WorkspaceDialog
        open={dialog === "names"}
        onClose={() => setDialog(null)}
        title="Class names"
        description="The ship names your nation uses, by ship type. Choosing one sets the class name."
      >
        <ClassNameBrowser
          groups={nameGroups(nationEnv.ctx.navalProfile, shipType)}
          current={shipClassName}
          onPick={(name) => {
            setShipClassName(name);
            setDialog(null);
          }}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "start"}
        onClose={() => setDialog(null)}
        title="Start from a reference design"
        description="Each ship type has a starting design. Your current design is replaced only after you confirm."
        wide
      >
        <ReferenceDesignBrowser
          env={nationEnv}
          starters={starters}
          content={content}
          month={state.month}
          currentCategory={draft.requirement.category}
          onStart={(id) => {
            setDialog(null);
            requestPreset(id);
          }}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "file"}
        onClose={() => setDialog(null)}
        title="Import or export design"
        description="Save the design to a file, or load one."
      >
        <FilePanel
          draft={draft}
          view={view}
          content={content}
          presetName={state.preset.name}
          onLoad={loadDraft}
          dirty={state.editCount > 0}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "history"}
        onClose={() => setDialog(null)}
        title="Edit history"
        description="Every change, oldest first. Choose an entry to go back to it."
      >
        <HistoryPanel
          history={state.history}
          cursor={state.editCount}
          startName={state.preset.name}
          content={content}
          jumpTo={actions.jumpTo}
        />
      </WorkspaceDialog>
      <WorkspaceDialog
        open={dialog === "alternatives"}
        onClose={() => setDialog(null)}
        title="Design alternatives"
        description="Designs the naval architects propose from this one, under the same rules."
      >
        <AlternativesPanel
          dirty={state.editCount > 0}
          generate={actions.generateAlternatives}
          onLoad={(d) => {
            setDialog(null);
            loadDraft(d);
          }}
        />
      </WorkspaceDialog>
    </>
  );

  return (
    <ShipSelectionProvider store={selection}>
      <DraftSaveWarning visible={autosave.saveFailed} onDismiss={autosave.dismissSaveFailed} />
      {hosted ? (
        <ScreenHeader title="Ship design" icon={PencilRuler}>
          {commandBar}
        </ScreenHeader>
      ) : null}
      {wide ? (
        <div
          ref={rootRef}
          data-testid="shipbuilding-workspace"
          data-guided-target="ship-design"
          className="relative h-full min-h-[28rem]"
          style={{ "--chrome-right": drawerClearance } as CSSProperties}
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
        >
          <h2 className="sr-only">Ship design</h2>
          {stage}
          <ChartDesk tabs={tabs} drawer={drawer} slip={null} foot={foot} />
          {!hosted && (
            <div className="pointer-events-auto absolute inset-x-0 top-0 z-[10000]">
              {commandBar}
            </div>
          )}
          {overlay}
        </div>
      ) : (
        <div
          ref={rootRef}
          data-testid="shipbuilding-workspace"
          data-guided-target="ship-design"
          className="flex flex-col gap-3 p-3 pb-[calc(var(--chrome-bottom,0px)+0.75rem)] pt-[calc(var(--chrome-top,0px)+0.75rem)]"
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
        >
          <h2 className="sr-only">Ship design</h2>
          {!hosted && commandBar}
          <div
            className="relative h-[60vh] min-h-[22rem] overflow-hidden rounded-sm border border-admiralty-border"
            style={
              {
                "--chrome-top": "0px",
                "--chrome-bottom": "0px",
                "--chrome-slip": "0px",
                "--chrome-right": "1.5rem",
              } as CSSProperties
            }
          >
            {stage}
          </div>
          <div className="flex flex-col items-start gap-2">{foot}</div>
          {tabs}
          {drawer !== null && <div className="h-[70vh] min-h-[22rem]">{drawer}</div>}
          {overlay}
        </div>
      )}
    </ShipSelectionProvider>
  );
}
