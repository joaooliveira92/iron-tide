import { useCallback, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Gauge,
  Hammer,
  LayoutGrid,
  Redo2,
  Ship,
  Undo2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Alert } from "../../../components/ui/alert.js";
import { formatExplanation } from "../../../lib/presentation-format/index.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { Separator } from "../../../components/ui/separator.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import {
  AlternativesPanel,
  ArmourPanel,
  BOARD_TABS,
  BatteryPanel,
  BriefPanel,
  ComparePanel,
  ConfirmDialog,
  FilePanel,
  FindingsPanel,
  ForecastPanel,
  HistoryPanel,
  HullPanel,
  HullPlanPanel,
  IDLE_TOOL,
  LedgerPanel,
  MachineryPanel,
  MetricsPanel,
  PlacementsPanel,
  PlanDisplayMenu,
  PlanModeButtons,
  RebuildPanel,
  RequirementChip,
  RevisionPanel,
  SelectField,
  SelectionInspector,
  ShipFindingsButton,
  ShipSelectionProvider,
  ShipTypePanel,
  ShipViewBoundary,
  ShipWorkspace,
  SubmitPanel,
  TopsidePanel,
  findDrawingControl,
  linkedEntities,
  mountNameMap,
  passesFilter,
  planModel,
  plural,
  shipTypeIcon,
  shipTypeRole,
  useDraftAutosave,
  useFindingsView,
  useFormNavigation,
  useHullPlanEditing,
  useRestoredDraftToast,
  useDesignSession,
  technologyMonths,
  SHORTCUT_MOD,
  SHORTCUT_SHIFT,
  handleUndoShortcut,
  type BoardTab,
  type EntityContext,
  type PlanTool,
  type RevisionProject,
} from "../../../components/design-workspace/index.js";
import { useCampaignMonthId } from "../../../shell/CampaignShellContext.js";

/**
 * Tabs with icons (ReUI c-tabs-6): the board is split by what the player is doing, so nothing needs a long scroll.
 * The hull plan is not a tab's content: it stays in the workspace's ship view whichever tab is open.
 */
const TABS: readonly { value: BoardTab; label: string; Icon: LucideIcon }[] = [
  { value: "hull", label: "Hull and machinery", Icon: Ship },
  { value: "arrangement", label: "Arrangement", Icon: LayoutGrid },
  { value: "analysis", label: "Analysis", Icon: Gauge },
  { value: "build", label: "Build", Icon: Hammer },
  { value: "tools", label: "History and files", Icon: Wrench },
];
/** Two columns once the tab pane (not the window) is wide enough: the pane shares the window with the ship view. */
const TAB_GRID = "grid grid-cols-1 items-start gap-4 @4xl:grid-cols-2";

/**
 * Component-level ship designer (SB-18 v1). Local to the renderer: edits an undoable draft and shows the live
 * compile result. Submitting a design to the engine arrives with the command wiring (SB-14).
 */
export function DrawingBoard({
  sessionId,
  projects = [],
}: { readonly sessionId?: string; readonly projects?: readonly RevisionProject[] } = {}) {
  const campaignMonth = useCampaignMonthId();
  const {
    state,
    actions,
    env: boardEnv,
    zones,
    batteries,
    findings,
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
  const [tab, setTabState] = useState<BoardTab>("hull");
  // A tab's panels mount the first time it is opened and then stay mounted (typed values and scroll survive a switch).
  // Mounting all five up front made the board's DOM five times larger than what the player sees.
  const [visited, setVisited] = useState<ReadonlySet<BoardTab>>(() => new Set(["hull"]));
  const setTab = useCallback((next: BoardTab) => {
    setTabState(next);
    setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
  }, []);
  // Switched from the toolbar, used by the drawing: the one tool state survives tab changes with the ship view.
  const [planTool, setPlanTool] = useState<PlanTool>(IDLE_TOOL);
  // Plan display preferences live in the toolbar too, so the drawing and its controls share one source.
  const [showArcs, setShowArcs] = useState(true);
  const [findingsView, setFindingsView] = useFindingsView();
  const shownFindings = useMemo(
    () => findings.filter((f) => passesFilter(f.severity, findingsView.filter)),
    [findings, findingsView.filter],
  );
  // The toolbar owns the plan tool (its pickers and Auto-place live in the menus), so the drawing's model and editing
  // session are built here and shared: a notice from the menu and one from a click on the drawing agree.
  const planModelData = useMemo(
    () => planModel(draft, content, view, state.month, findings),
    [draft, content, view, state.month, findings],
  );
  const planEditing = useHullPlanEditing({
    draft,
    content,
    month: state.month,
    frame: planModelData.frame,
    zones: planModelData.zones,
    entryOf: planModelData.entryOf,
    edit: actions.edit,
    givenTool: planTool,
    onTool: setPlanTool,
  });
  const entityCtx: EntityContext = { draft, view, content, zones, batteries, findings };
  const rootRef = useRef<HTMLDivElement>(null);
  const goTo = useFormNavigation(setTab, rootRef);
  const clearSelection = () => {
    const was = selection.get().selected;
    selection.clear();
    if (was && rootRef.current) findDrawingControl(rootRef.current, was)?.focus();
  };
  // A restored draft is announced as a bottom-right toast (not a page banner) carrying the same two choices.
  useRestoredDraftToast({
    restored: autosave.restored,
    dismiss: autosave.dismiss,
    startOver: () => loadPreset(state.preset.id),
  });
  return (
    <ShipSelectionProvider store={selection}>
      <div
        ref={rootRef}
        className="flex h-full min-h-0 flex-col gap-2 overflow-hidden bg-background p-2 @3xl:p-4"
        data-testid="drawing-board"
        onKeyDown={(e) => handleUndoShortcut(e, { ...state, ...actions })}
        onKeyDownCapture={(e) => {
          // Escape, one step per press, from the drawing or the inspector: an open preview (hover card or
          // finding marker) closes itself first; then the opened finding; then the pinned entity; only then does
          // the dialog get the key. Capture phase, so a control's own key handling cannot swallow it first.
          if (e.key !== "Escape") return;
          const s = selection.get();
          if (s.selected === null || s.preview !== null || s.markerPreview) return;
          if (!(e.target instanceof Element) || !e.target.closest("[data-selection-scope]")) return;
          e.preventDefault();
          e.stopPropagation();
          if (s.finding !== null) selection.clearFinding();
          else clearSelection();
        }}
      >
        {/* Toolbar and status share one border: the status band is attached directly beneath the
            controls, the way the header's secondary row sits under its primary row. */}
        <div className="flex flex-col overflow-hidden rounded-lg border">
          <div
            role="group"
            aria-label="Design toolbar"
            className="flex flex-wrap items-center gap-2 bg-muted/40 p-2"
          >
            <SelectField
              inline
              className="w-80 max-w-full"
              label="Starting design"
              shortLabel="Design"
              value={state.preset.id}
              options={content.references.map((r) => {
                const Icon = shipTypeIcon(r.draft.requirement.category);
                // In a campaign the rules date is fixed: a design whose technology does not exist yet cannot be built,
                // so it is offered but disabled with the reason instead of letting the player select a doomed start.
                const notYet = campaignMonth !== null && r.month > campaignMonth;
                return {
                  value: r.id,
                  label: r.name,
                  icon: <Icon aria-hidden="true" className="size-4" />,
                  description: notYet
                    ? `Not available until ${r.month}.`
                    : shipTypeRole(r.draft.requirement.category),
                  disabled: notYet,
                };
              })}
              onChange={requestPreset}
            />
            {campaignMonth !== null ? (
              // In a campaign the rules date is the campaign month (the engine uses the same), so it is shown, not chosen.
              <HoverCard>
                <HoverCardTrigger
                  render={<button type="button" />}
                  aria-label={`Technology as of ${campaignMonth} (campaign date)`}
                  className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
                  {campaignMonth}
                </HoverCardTrigger>
                <HoverCardContent className="w-64 text-sm">
                  <div className="mb-1 font-medium">Technology as of {campaignMonth}</div>
                  <p className="text-muted-foreground">
                    Fixed to the campaign date: the design can use only what your navy has available
                    this month.
                  </p>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <SelectField
                inline
                label="Technology as of"
                shortLabel="Technology"
                value={state.month}
                options={technologyMonths(state.month).map((m) => ({ value: m, label: m }))}
                onChange={actions.setMonth}
              />
            )}
            <Separator orientation="vertical" className="h-6" />
            <ButtonGroup aria-label="History">
              {(
                [
                  ["Undo", Undo2, actions.undo, state.canUndo],
                  ["Redo", Redo2, actions.redo, state.canRedo],
                ] as const
              ).map(([name, Icon, run, can]) => (
                <HoverCard key={name}>
                  <HoverCardTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={name}
                        onClick={run}
                        disabled={!can}
                      />
                    }
                  >
                    <Icon aria-hidden="true" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-auto max-w-64 px-3 py-1.5 text-xs">
                    {name} (
                    {name === "Undo" ? `${SHORTCUT_MOD}Z` : `${SHORTCUT_SHIFT}${SHORTCUT_MOD}Z`})
                  </HoverCardContent>
                </HoverCard>
              ))}
            </ButtonGroup>
            <span className="text-xs text-muted-foreground tabular-nums">
              {plural(state.editCount, "edit", "edits", "No edits")}
            </span>
            <Separator orientation="vertical" className="h-6" />
            <PlanModeButtons
              tool={planTool}
              onTool={setPlanTool}
              draft={draft}
              available={planModelData.available}
              entryOf={planModelData.entryOf}
              onAutoPlace={planEditing.onAutoPlace}
            />
            <PlanDisplayMenu
              showArcs={showArcs}
              onShowArcs={setShowArcs}
              findingsView={findingsView}
              onFindingsView={setFindingsView}
            />
            <ShipFindingsButton
              className="h-9"
              view={findingsView}
              shipFindings={shownFindings.filter((f) => f.entities.some((e) => e.kind === "ship"))}
            />
            <RequirementChip requirement={draft.requirement} className="ml-auto h-9 shrink-0" />
          </div>
          <button
            type="button"
            onClick={() => setTab("analysis")}
            aria-label="Design status: open the analysis tab"
            className="flex w-full flex-wrap items-center gap-2 border-t px-3 py-2 text-left text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge variant={view.valid ? "secondary" : "destructive"}>
              {view.valid ? "Can be submitted" : "Cannot be built"}
            </Badge>
            <span className="text-muted-foreground">
              {view.counts.BLOCKING} blocking · {view.counts.CRITICAL} critical ·{" "}
              {plural(view.counts.WARNING, "warning")}
            </span>
            {view.metrics.slice(0, 3).map((m) => (
              <span key={m.id} className="tabular-nums">
                <span className="text-muted-foreground">{m.label}:</span>{" "}
                {formatExplanation(m.value)}
              </span>
            ))}
          </button>
        </div>
        <ConfirmDialog
          open={pendingPreset !== null}
          onOpenChange={(open) => !open && setPendingPreset(null)}
          title="Start from a different design?"
          description="This replaces the design you are working on, and its edit history is cleared."
          confirmLabel="Replace my design"
          onConfirm={() => {
            if (pendingPreset !== null) loadPreset(pendingPreset);
            setPendingPreset(null);
          }}
        />
        {state.editError !== null && <Alert variant="destructive">{state.editError}</Alert>}
        <ShipWorkspace
          ship={
            <div data-selection-scope="">
              <ShipViewBoundary resetKey={draft}>
                <HullPlanPanel
                  draft={draft}
                  content={content}
                  view={view}
                  month={state.month}
                  edit={actions.edit}
                  findings={findings}
                  model={planModelData}
                  editing={planEditing}
                  showArcs={showArcs}
                  onShowArcs={setShowArcs}
                  findingsView={findingsView}
                  onFindingsView={setFindingsView}
                />
              </ShipViewBoundary>
            </div>
          }
        >
          <div
            // Form-to-drawing linking: focus in a form group about ship elements lights them on the drawing.
            onFocus={(e) => selection.setLinked(linkedEntities(e.target, entityCtx))}
            onBlur={(e) => {
              if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)))
                selection.setLinked([]);
            }}
          >
            <Tabs
              value={tab}
              onValueChange={(v) => {
                const next = BOARD_TABS.find((t) => t === v);
                if (next) setTab(next);
              }}
            >
              <TabsList className="h-auto w-full flex-wrap">
                {TABS.map(({ value, label, Icon }) => (
                  <TabsTrigger key={value} value={value} className="flex-1 gap-2">
                    <Icon aria-hidden="true" className="hidden size-4 @3xl:block" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <SelectionInspector ctx={entityCtx} onGoTo={goTo} onClear={clearSelection} />

              <TabsContent value="hull" keepMounted className={TAB_GRID}>
                {visited.has("hull") && (
                  <>
                    <div className="space-y-4">
                      <ShipTypePanel
                        env={boardEnv}
                        starters={starters}
                        currentCategory={draft.requirement.category}
                        onStart={requestPreset}
                      />
                      <BriefPanel
                        draft={draft}
                        view={view}
                        edit={actions.edit}
                        ctx={boardEnv.ctx}
                      />
                    </div>
                    <div className="space-y-4">
                      <HullPanel draft={draft} content={content} edit={actions.edit} />
                      <MachineryPanel draft={draft} content={content} edit={actions.edit} />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="arrangement" keepMounted className="space-y-4">
                {visited.has("arrangement") && (
                  <>
                    <BatteryPanel
                      cards={batteries}
                      draft={draft}
                      content={content}
                      edit={actions.edit}
                    />
                    <PlacementsPanel
                      names={mountNameMap(batteries)}
                      draft={draft}
                      content={content}
                      month={state.month}
                      view={view}
                      edit={actions.edit}
                    />
                    <div className={TAB_GRID}>
                      <ArmourPanel
                        draft={draft}
                        view={view}
                        materials={armourMaterials}
                        edit={actions.edit}
                      />
                      <TopsidePanel view={view} />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="analysis" keepMounted className={TAB_GRID}>
                {visited.has("analysis") && (
                  <>
                    <div className="space-y-4">
                      <FindingsPanel
                        view={view}
                        findings={findings}
                        suggest={actions.suggest}
                        onApply={actions.edit}
                        onShowOnShip={(f) => {
                          const target = f.entities[0];
                          if (target) selection.select(target, f.key);
                        }}
                      />
                      <LedgerPanel view={view} />
                    </div>
                    <div className="space-y-4">
                      <MetricsPanel view={view} />
                      <ComparePanel
                        baseline={state.baseline}
                        view={view}
                        name={state.preset.name}
                      />
                      <ForecastPanel view={view} treasuryUnitMicro={content.treasuryUnitMicro} />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="build" keepMounted className={TAB_GRID}>
                {visited.has("build") && (
                  <>
                    {sessionId !== undefined && (
                      <SubmitPanel sessionId={sessionId} draft={draft} valid={view.valid} />
                    )}
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
                    <RebuildPanel
                      sessionId={sessionId}
                      draft={draft}
                      content={content}
                      onLoad={loadDraft}
                      dirty={state.editCount > 0}
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="tools" keepMounted className={TAB_GRID}>
                {visited.has("tools") && (
                  <>
                    <HistoryPanel
                      history={state.history}
                      cursor={state.editCount}
                      startName={state.preset.name}
                      content={content}
                      jumpTo={actions.jumpTo}
                    />
                    <div className="space-y-4">
                      <FilePanel
                        draft={draft}
                        view={view}
                        content={content}
                        presetName={state.preset.name}
                        onLoad={loadDraft}
                        dirty={state.editCount > 0}
                      />
                      <AlternativesPanel
                        dirty={state.editCount > 0}
                        generate={actions.generateAlternatives}
                        onLoad={loadDraft}
                      />
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ShipWorkspace>
      </div>
    </ShipSelectionProvider>
  );
}
