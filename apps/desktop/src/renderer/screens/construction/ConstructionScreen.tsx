import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { CalendarClock, Hammer } from "lucide-react";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { Skeleton } from "../../components/ui/skeleton.js";
import { debugRevisionActions } from "../../components/shared/debugRevisionActions.js";
import { Inspector } from "../shipbuilding/components/Inspector.js";
import { InspectorResizeHandle } from "../shipbuilding/components/InspectorResizeHandle.js";
import { INSPECTOR_COLLAPSED_PX } from "../shipbuilding/inspector-layout.js";
import { useInspectorLayout } from "../shipbuilding/useInspectorLayout.js";
import { cn } from "../../lib/utils.js";
import { DrawingBoardDialog } from "./drawing-board/DrawingBoardDialog.js";
import { useScreenHeaderHost } from "../../shell/screen-header.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import {
  BatchBuildDialog,
  CatalogStage,
  CommandInspector,
  DesignInspector,
  DockCapacityPanel,
  LoadErrorCard,
  OrdersStage,
  ProjectInspector,
  SlipwaysStage,
  YardBar,
  YardOverview,
  YardRail,
  YardStatusBar,
} from "./components/index.js";
import type {
  ConstructionBatchPreviewOutcome,
  ForeignConstructionPreviewOutcome,
} from "../../../shared/construction-contract.js";
import { projectRows } from "./project-progress.js";
import { useConstructionScreen } from "./hooks/useConstructionScreen.js";
import { CollapsibleSection } from "../../components/shared/CollapsibleSection.js";
import { DeferredFeaturesPanel } from "../../components/shared/DeferredFeaturesPanel.js";
import { DEFERRED_CONSTRUCTION_ITEMS } from "./construction-screen-state.js";
import {
  nextProjectSelection,
  placeOf,
  railMarks,
  yardReadouts,
  type YardPlaceId,
} from "./yard-workspace.js";

export function ConstructionScreen({ sessionId }: { readonly sessionId: string }) {
  const {
    state,
    loadError,
    selectedDesignId,
    request,
    loadScreen,
    setSelectedDesignId,
    submit,
    replace,
    cancel,
    cancelProject,
    halt,
    resume,
    setAcceleration,
    orderBatch,
    previewBatch,
    previewForeign,
    placeForeignOrder,
    authorizeDockExpansion,
  } = useConstructionScreen(sessionId);
  const format = usePresentationFormat();
  const hosted = useScreenHeaderHost();
  const [place, setPlace] = useState<YardPlaceId>("slipways");
  const [tabs, setTabs] = useState<Readonly<Record<YardPlaceId, string>>>(() => ({
    slipways: "project",
    catalog: "design",
    orders: "command",
    dock: "yard",
  }));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);
  const [revisingProjectId, setRevisingProjectId] = useState<string | null>(null);
  const {
    layout: inspectorLayout,
    setWidth: setInspectorWidth,
    toggleCollapsed: toggleInspector,
  } = useInspectorLayout(sessionId);
  const inspectorId = useId();
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState(1);
  const [batchPreview, setBatchPreview] = useState<ConstructionBatchPreviewOutcome | null>(null);
  const [batchForeignPreview, setBatchForeignPreview] =
    useState<ForeignConstructionPreviewOutcome | null>(null);
  const [batchBuilderNationId, setBatchBuilderNationId] = useState<string | null>(null);
  const [batchFetching, setBatchFetching] = useState(false);
  const selectedDesign = useMemo(
    () => state.designs.find((d) => d.designId === selectedDesignId) ?? null,
    [state.designs, selectedDesignId],
  );

  const rows = useMemo(() => projectRows(state.projects), [state.projects]);
  const setTab = useCallback(
    (target: YardPlaceId, tab: string) => setTabs((current) => ({ ...current, [target]: tab })),
    [],
  );
  const openWizard = useCallback(() => {
    setBatchOpen(false);
    setPlace("catalog");
    setTab("catalog", "order");
  }, [setTab]);
  const closeWizard = useCallback(() => setTab("catalog", "design"), [setTab]);
  const openBatch = useCallback(() => {
    setPlace("catalog");
    setTab("catalog", "design");
    setBatchPreview(null);
    setBatchForeignPreview(null);
    setBatchBuilderNationId(null);
    setBatchOpen(true);
  }, [setTab]);
  const closeBatch = useCallback(() => setBatchOpen(false), []);
  const refresh = useCallback(() => void loadScreen(), [loadScreen]);
  const confirmOrder = useCallback(() => {
    submit();
    closeWizard();
  }, [submit, closeWizard]);

  useEffect(() => {
    if (
      !batchOpen ||
      batchBuilderNationId !== null ||
      selectedDesignId === null ||
      !(Number.isInteger(batchQuantity) && batchQuantity >= 1)
    ) {
      setBatchPreview(null);
      setBatchFetching(false);
      return;
    }
    let cancelled = false;
    setBatchFetching(true);
    void previewBatch(selectedDesignId, batchQuantity).then((result) => {
      if (cancelled) return;
      setBatchPreview(result);
      setBatchFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [batchOpen, batchBuilderNationId, selectedDesignId, batchQuantity, previewBatch]);

  useEffect(() => {
    if (
      !batchOpen ||
      selectedDesignId === null ||
      !(Number.isInteger(batchQuantity) && batchQuantity >= 1)
    ) {
      setBatchForeignPreview(null);
      return;
    }
    let cancelled = false;
    void previewForeign(selectedDesignId, batchQuantity, batchBuilderNationId ?? undefined).then(
      (result) => {
        if (!cancelled) setBatchForeignPreview(result);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [batchOpen, selectedDesignId, batchQuantity, batchBuilderNationId, previewForeign]);

  const confirmBatch = useCallback(() => {
    if (selectedDesignId === null) return;
    if (batchBuilderNationId === null) orderBatch(selectedDesignId, batchQuantity);
    else placeForeignOrder(selectedDesignId, batchBuilderNationId, batchQuantity);
    closeBatch();
  }, [
    orderBatch,
    placeForeignOrder,
    selectedDesignId,
    batchBuilderNationId,
    batchQuantity,
    closeBatch,
  ]);

  if (loadError !== null) {
    return (
      <div data-guided-target="construction">
        <LoadErrorCard message={loadError} onReload={() => void loadScreen()} />
      </div>
    );
  }

  if (state.workspace === null || state.economy === null) {
    return (
      <div data-guided-target="construction" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <Skeleton key={idx} className="h-24" />
        ))}
      </div>
    );
  }

  const busy = state.pendingRequest !== null || state.requiresRefresh;
  const workspace = state.workspace;
  const economy = state.economy;
  const figures = { projects: rows, designs: state.designs, commands: workspace.commands, economy };
  const marks = railMarks(figures);
  const currentPlace = placeOf(place);
  const tab = currentPlace.tabs.find((t) => t.id === tabs[place]) ?? currentPlace.tabs[0]!;
  const selectedRow = rows.find(
    (row) => row.projectId === nextProjectSelection(selectedProjectId, rows),
  );
  const selectedCommand =
    workspace.commands.find((command) => command.commandId === selectedCommandId) ?? null;
  const revisingProject = state.projects.find((project) => project.projectId === revisingProjectId);
  const reviewing = place === "catalog" && (batchOpen || tab.id === "order");
  const monthLabel = `${state.month?.year ?? ""}-${String(state.month?.month ?? 0).padStart(2, "0")}`;

  const stage = (() => {
    switch (place) {
      case "slipways":
        return (
          <SlipwaysStage
            rows={rows}
            economy={economy}
            selectedId={selectedRow?.projectId ?? null}
            onSelect={(projectId) => {
              setSelectedProjectId(projectId);
              setTab("slipways", "project");
            }}
            onBrowseCatalog={() => setPlace("catalog")}
          />
        );
      case "catalog":
        return batchOpen ? (
          <BatchBuildDialog
            designs={state.designs}
            selectedDesignId={selectedDesignId}
            onSelectDesign={setSelectedDesignId}
            quantity={batchQuantity}
            onQuantityChange={setBatchQuantity}
            preview={batchPreview}
            foreignPreview={batchForeignPreview}
            builderNationId={batchBuilderNationId}
            onSelectBuilder={setBatchBuilderNationId}
            busy={busy || batchFetching}
            notice={state.notice}
            onConfirm={confirmBatch}
            onCancel={closeBatch}
          />
        ) : (
          <CatalogStage
            designs={state.designs}
            economy={economy}
            workspace={workspace}
            selectedDesignId={selectedDesignId}
            onSelectDesign={(designId) => {
              setSelectedDesignId(designId);
              setTab("catalog", "design");
            }}
          />
        );
      case "orders":
        return (
          <OrdersStage
            commands={workspace.commands}
            economy={economy}
            busy={busy}
            selectedDesignId={selectedDesignId}
            selectedCommandId={selectedCommandId}
            onSelectCommand={(commandId) => {
              setSelectedCommandId(commandId);
              setTab("orders", "command");
            }}
            onReplace={replace}
            onCancel={cancel}
            onBrowseCatalog={() => setPlace("catalog")}
          />
        );
      case "dock":
        return (
          <DockCapacityPanel
            dockMaxBuildDisplacementKg={economy.dockMaxBuildDisplacementKg}
            maxConcurrentConstructionMassKg={economy.maxConcurrentConstructionMassKg}
            committedNewConstructionMassKg={economy.committedNewConstructionMassKg}
            exemptNewConstructionMassKg={economy.exemptNewConstructionMassKg}
            dockExpansionDurationMonths={economy.dockExpansionDurationMonths}
            dockExpansionNextStepKg={economy.dockExpansionNextStepKg}
            dockPossessions={economy.dockPossessions}
            pending={busy}
            onAuthorizeDockExpansion={authorizeDockExpansion}
          />
        );
    }
  })();

  const inspectorBody = (() => {
    if (tab.id === "yard") return <YardOverview economy={economy} workspace={workspace} />;
    if (place === "slipways") {
      return (
        <ProjectInspector
          row={selectedRow ?? null}
          pending={busy}
          onHalt={halt}
          onResume={resume}
          onAccelerate={setAcceleration}
          onCancelProject={cancelProject}
          onRevise={setRevisingProjectId}
        />
      );
    }
    if (place === "catalog") {
      return (
        <DesignInspector
          tab={tab.id}
          design={selectedDesign}
          economy={economy}
          workspace={workspace}
          busy={busy}
          notice={state.notice}
          onConfirm={confirmOrder}
          onBackToDesign={closeWizard}
        />
      );
    }
    return (
      <CommandInspector
        command={selectedCommand}
        commands={workspace.commands}
        economy={economy}
        workspace={workspace}
      />
    );
  })();

  const inspectorTitle = place === "catalog" ? "Design catalog" : currentPlace.label;

  const yardBar = (
    <YardBar
      design={selectedDesign}
      designCount={state.designs.length}
      busy={busy}
      retryPending={request.outcomeUnknown}
      onRetry={request.outcomeUnknown ? request.retry : undefined}
      onSubmit={openWizard}
      onBatch={openBatch}
      onRefresh={refresh}
      inHeader={hosted}
    />
  );

  return (
    <ScreenStage
      guidedTarget="construction"
      icon={Hammer}
      title="Construction Commands"
      description="Drydock procurement and shipyard queue management."
      actions={
        hosted ? (
          <>
            {yardBar}
            {debugRevisionActions(state.month, state.revision)}
          </>
        ) : (
          debugRevisionActions(state.month, state.revision)
        )
      }
      className="space-y-3"
    >
      {state.notice !== null && !reviewing && (
        <p role="status" className="text-sm whitespace-pre-line text-muted-foreground">
          {state.notice}
        </p>
      )}

      <div
        data-testid="construction-workspace"
        className={cn(
          "grid h-[clamp(30rem,calc(100svh_-_var(--chrome-top,0px)_-_var(--chrome-bottom,0px)_-_3rem),60rem)] min-h-0 overflow-hidden rounded-lg border bg-background",
          hosted ? "grid-rows-[minmax(0,1fr)_auto]" : "grid-rows-[auto_minmax(0,1fr)_auto]",
        )}
        onKeyDownCapture={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            !event.altKey &&
            event.key.toLowerCase() === "b"
          ) {
            event.preventDefault();
            toggleInspector();
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
        }}
      >
        {!hosted && yardBar}

        <div
          data-testid="construction-grid"
          className="grid min-h-0 grid-cols-[3.5rem_minmax(0,1fr)_var(--inspector-width)] xl:grid-cols-[13rem_minmax(0,1fr)_var(--inspector-width)]"
          style={
            {
              "--inspector-width": `${
                inspectorLayout.collapsed ? INSPECTOR_COLLAPSED_PX : inspectorLayout.widthPx
              }px`,
            } as CSSProperties
          }
        >
          <YardRail
            active={place}
            marks={marks}
            onSelect={setPlace}
            footer={
              <p className="mt-1 flex items-center gap-1.5 border-t px-1 pt-2 text-xs text-muted-foreground max-xl:hidden">
                <CalendarClock aria-hidden="true" className="size-4" />
                Month
                <span className="font-medium tabular-nums text-foreground">{monthLabel}</span>
              </p>
            }
          />

          <section aria-label={currentPlace.label} className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="themed-scrollbar min-h-0 flex-1 overflow-auto p-3">{stage}</div>
          </section>

          <div id={inspectorId} className="relative min-h-0">
            {!inspectorLayout.collapsed && (
              <InspectorResizeHandle
                widthPx={inspectorLayout.widthPx}
                onChange={setInspectorWidth}
                controls={inspectorId}
                className="absolute inset-y-0 -left-2 z-10 w-4"
              />
            )}
            <Inspector
              title={inspectorTitle}
              breadcrumb={["Yard", currentPlace.label, tab.label]}
              tabs={currentPlace.tabs}
              tab={tab.id}
              onTab={(next) => setTab(place, next)}
              collapsed={inspectorLayout.collapsed}
              onToggleCollapsed={toggleInspector}
            >
              {inspectorBody}
            </Inspector>
          </div>
        </div>

        <YardStatusBar readouts={yardReadouts(figures, workspace, format)} />
      </div>

      <DrawingBoardDialog
        sessionId={sessionId}
        projects={revisingProject === undefined ? [] : [revisingProject]}
        open={revisingProject !== undefined}
        onOpenChange={(open) => {
          if (!open) setRevisingProjectId(null);
        }}
      />

      <CollapsibleSection
        title="Not yet modelled"
        testId="construction-deferred-section"
        summary={`${DEFERRED_CONSTRUCTION_ITEMS.length} items`}
      >
        <DeferredFeaturesPanel
          items={DEFERRED_CONSTRUCTION_ITEMS}
          testId="construction-deferred"
          title="Construction features the engine cannot supply yet"
        />
      </CollapsibleSection>
    </ScreenStage>
  );
}
