import { Handshake } from "lucide-react";
import type { CSSProperties } from "react";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { debugRevisionActions } from "../../components/shared/debugRevisionActions.js";
import { cn } from "../../lib/utils.js";
import { Inspector } from "../shipbuilding/components/Inspector.js";
import { InspectorResizeHandle } from "../shipbuilding/components/InspectorResizeHandle.js";
import { INSPECTOR_COLLAPSED_PX } from "../shipbuilding/inspector-layout.js";
import {
  BattleHistorySection,
  DiplomacyLoadErrorState,
  DiplomacyLoadingState,
  DiplomacyNotice,
  ForeignStatusBar,
  NationDossier,
  NationRail,
  NotModelled,
  OrdersBar,
  OverviewSummary,
  PlotStage,
  RailFooter,
  WarFront,
} from "./components/index.js";
import { foreignReadouts } from "./diplomacy-readouts.js";
import { tabsFor } from "./diplomacy-sections.js";
import type { BattleHistoryState } from "./hooks/useBattleHistory.js";
import { useDiplomacyWorkspace, type DiplomacyWorkspace } from "./hooks/useDiplomacyWorkspace.js";

function battlesAgainst(state: BattleHistoryState, nationName: string): BattleHistoryState {
  if (state.status !== "ready") return state;
  return {
    status: "ready",
    history: {
      ...state.history,
      battles: state.history.battles.filter(
        (battle) => battle.attackerName === nationName || battle.defenderName === nationName,
      ),
    },
  };
}

function InspectorBody({ workspace }: { readonly workspace: DiplomacyWorkspace }) {
  const { selected, tab, battleHistory, state, busy, vm } = workspace;
  if (selected !== null) {
    if (tab.id === "battles") {
      return <BattleHistorySection state={battlesAgainst(battleHistory, selected.partnerName)} />;
    }
    return (
      <NationDossier
        key={selected.partnerNationId}
        row={selected}
        draft={state.draftCommand}
        busy={busy}
        onAction={workspace.setRowAction}
      />
    );
  }
  if (tab.id === "dispatches") return <BattleHistorySection state={battleHistory} />;
  if (tab.id === "gaps") return <NotModelled />;
  return <OverviewSummary vm={vm} onSelect={workspace.selectNation} />;
}

export function DiplomacyScreen({ sessionId }: { readonly sessionId: string }) {
  const workspace = useDiplomacyWorkspace(sessionId);

  if (workspace.status === "error") {
    return <DiplomacyLoadErrorState message={workspace.message} onRetry={workspace.retry} />;
  }

  if (workspace.status === "loading") {
    return <DiplomacyLoadingState />;
  }

  const { state, vm, records, selected, tab, currentPlace, inspectorLayout, hosted } = workspace;

  const ordersBar = (
    <OrdersBar
      busy={workspace.busy}
      queued={workspace.queued}
      areas={state.projection.areas}
      draft={state.draftCommand}
      draftLabel={vm.draftLabel}
      draftFlagUrl={vm.draftFlagUrl}
      canSubmit={workspace.canSubmit}
      onAreaChange={workspace.setBlockadeArea}
      onClear={workspace.clearDraft}
      onApply={workspace.submit}
      inHeader={hosted}
    />
  );

  return (
    <ScreenStage
      guidedTarget="diplomacy"
      icon={Handshake}
      title="Diplomacy & War"
      actions={
        hosted ? (
          <>
            {ordersBar}
            {debugRevisionActions(state.month, state.revision)}
          </>
        ) : (
          debugRevisionActions(state.month, state.revision)
        )
      }
      className="space-y-3"
    >
      {hosted && workspace.declaringWar && (
        <p role="alert" className="text-xs font-medium text-destructive">
          Once submitted, a declaration of war cannot be cancelled from this screen. It takes effect
          when you advance the month.
        </p>
      )}
      {state.notice !== null && (
        <DiplomacyNotice submitted={workspace.queued} notice={state.notice} />
      )}

      <div
        data-testid="diplomacy-workspace"
        className={cn(
          "grid h-[clamp(30rem,calc(100svh_-_var(--chrome-top,0px)_-_var(--chrome-bottom,0px)_-_3rem),60rem)] min-h-0 overflow-hidden rounded-lg border bg-background",
          hosted ? "grid-rows-[minmax(0,1fr)_auto]" : "grid-rows-[auto_minmax(0,1fr)_auto]",
        )}
        onKeyDownCapture={workspace.onWorkspaceKeyDownCapture}
      >
        {!hosted && ordersBar}

        <div
          data-testid="diplomacy-grid"
          className="grid min-h-0 grid-cols-[3.5rem_minmax(0,1fr)_var(--inspector-width)] xl:grid-cols-[15rem_minmax(0,1fr)_var(--inspector-width)]"
          style={
            {
              "--inspector-width": `${
                inspectorLayout.collapsed ? INSPECTOR_COLLAPSED_PX : inspectorLayout.widthPx
              }px`,
            } as CSSProperties
          }
        >
          <NationRail
            rows={vm.relations}
            records={records}
            overviewActive={currentPlace.kind === "overview"}
            selectedId={selected?.partnerNationId ?? null}
            draftPartnerId={workspace.draftPartnerId}
            onOverview={workspace.showOverview}
            onSelect={workspace.selectNation}
            footer={
              <RailFooter
                month={`${state.month.year}-${String(state.month.month).padStart(2, "0")}`}
                atWar={vm.posture.activeWars > 0}
              />
            }
          />

          <PlotStage
            vm={vm}
            records={records}
            selectedId={selected?.partnerNationId ?? null}
            view={workspace.plotView}
            onView={workspace.setPlotView}
            layers={workspace.layers}
            onToggleLayer={workspace.toggleChartLayer}
            onSelect={workspace.selectNation}
            wars={
              <WarFront
                rows={vm.wars}
                busy={workspace.busy}
                onPeaceAction={workspace.acceptPeace}
                onPeaceTerms={workspace.proposePeaceTerms}
              />
            }
          />

          <div id={workspace.inspectorId} className="relative min-h-0">
            {!inspectorLayout.collapsed && (
              <InspectorResizeHandle
                widthPx={inspectorLayout.widthPx}
                onChange={workspace.setInspectorWidth}
                controls={workspace.inspectorId}
                className="absolute inset-y-0 -left-2 z-10 w-4"
              />
            )}
            <Inspector
              title={selected?.partnerName ?? "Overview"}
              breadcrumb={["Your nation", selected?.partnerName ?? "Overview", tab.label]}
              tabs={tabsFor(currentPlace)}
              tab={tab.id}
              onTab={workspace.selectTab}
              collapsed={inspectorLayout.collapsed}
              onToggleCollapsed={workspace.toggleInspector}
            >
              <InspectorBody workspace={workspace} />
            </Inspector>
          </div>
        </div>

        <ForeignStatusBar readouts={foreignReadouts(vm)} />
      </div>
    </ScreenStage>
  );
}
