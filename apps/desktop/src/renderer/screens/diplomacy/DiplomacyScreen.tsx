import { Handshake } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { debugRevisionActions } from "../../components/shared/debugRevisionActions.js";
import { Inspector } from "../shipbuilding/components/Inspector.js";
import { InspectorResizeHandle } from "../shipbuilding/components/InspectorResizeHandle.js";
import { INSPECTOR_COLLAPSED_PX } from "../shipbuilding/inspector-layout.js";
import { useInspectorLayout } from "../shipbuilding/useInspectorLayout.js";
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
import {
  DEFAULT_PLOT_LAYERS,
  toggleLayer,
  type PlotLayer,
  type PlotView,
} from "./components/plot-layers.js";
import { battleRecords } from "./diplomacy-hover.js";
import { foreignReadouts } from "./diplomacy-readouts.js";
import { resolveSelectedNation } from "./diplomacy-selection.js";
import {
  OVERVIEW_PLACE,
  activeTab,
  nationPlace,
  reconcilePlace,
  tabsFor,
  type DiplomacyPlace,
} from "./diplomacy-sections.js";
import { buildDiplomacyViewModel } from "./diplomacy-view-model.js";
import { useBattleHistory, type BattleHistoryState } from "./hooks/useBattleHistory.js";
import { useDiplomacyScreen } from "./hooks/useDiplomacyScreen.js";

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

export function DiplomacyScreen({ sessionId }: { readonly sessionId: string }) {
  const {
    state,
    loadError,
    setRowAction,
    setPeaceAction,
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

  if (loadError !== null) {
    return <DiplomacyLoadErrorState message={loadError} onRetry={() => void reload()} />;
  }

  if (state.kind === "idle") {
    return <DiplomacyLoadingState />;
  }

  const busy = state.kind === "submitting";
  const queued = state.kind === "submitted";
  const vm = buildDiplomacyViewModel(state.projection, state.draftCommand);
  const records = battleRecords(
    battleHistory,
    vm.relations.map((row) => row.partnerName),
  );
  const draftPartnerId = state.draftCommand?.partnerNationId ?? null;
  const currentPlace = reconcilePlace(
    place,
    vm.relations.map((row) => row.partnerNationId),
  );
  const selected =
    currentPlace.kind === "nation"
      ? resolveSelectedNation(vm.relations, currentPlace.nationId, null)
      : null;
  const tab = activeTab(currentPlace);

  const selectNation = (nationId: string) => setPlace(nationPlace(nationId));
  const acceptPeace = (warId: string) => {
    const war = state.projection.wars.find((w) => w.warId === warId);
    if (war !== undefined) {
      selectNation(war.playerSide === "attacker" ? war.defenderId : war.attackerId);
    }
    setPeaceAction(warId);
  };

  const breadcrumb = ["Your nation", selected?.partnerName ?? "Overview", tab.label];

  const inspectorBody = (() => {
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
          onAction={setRowAction}
        />
      );
    }
    if (tab.id === "dispatches") return <BattleHistorySection state={battleHistory} />;
    if (tab.id === "gaps") return <NotModelled />;
    return <OverviewSummary vm={vm} onSelect={selectNation} />;
  })();

  return (
    <ScreenStage
      guidedTarget="diplomacy"
      icon={Handshake}
      title="Diplomacy & War"
      actions={debugRevisionActions(state.month, state.revision)}
      className="space-y-3"
    >
      {state.notice !== null && <DiplomacyNotice submitted={queued} notice={state.notice} />}

      <div
        data-testid="diplomacy-workspace"
        className="grid h-[clamp(36rem,calc(100dvh_-_24rem),60rem)] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-background"
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
            currentPlace.kind === "nation" &&
            event.target instanceof Element &&
            !event.target.closest("[role='dialog'],[role='listbox']")
          ) {
            setPlace(OVERVIEW_PLACE);
          }
        }}
      >
        <OrdersBar
          busy={busy}
          queued={queued}
          areas={state.projection.areas}
          draft={state.draftCommand}
          draftLabel={vm.draftLabel}
          draftFlagUrl={vm.draftFlagUrl}
          canSubmit={canSubmit}
          onAreaChange={setBlockadeArea}
          onClear={clearDraft}
          onApply={submit}
        />

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
            draftPartnerId={draftPartnerId}
            onOverview={() => setPlace(OVERVIEW_PLACE)}
            onSelect={selectNation}
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
            view={plotView}
            onView={setPlotView}
            layers={layers}
            onToggleLayer={(layer) => setLayers((current) => toggleLayer(current, layer))}
            onSelect={selectNation}
            wars={<WarFront rows={vm.wars} busy={busy} onPeaceAction={acceptPeace} />}
          />

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
              title={selected?.partnerName ?? "Overview"}
              breadcrumb={breadcrumb}
              tabs={tabsFor(currentPlace)}
              tab={tab.id}
              onTab={(next) =>
                setPlace(
                  currentPlace.kind === "nation"
                    ? nationPlace(currentPlace.nationId, next)
                    : { kind: "overview", tab: next },
                )
              }
              collapsed={inspectorLayout.collapsed}
              onToggleCollapsed={toggleInspector}
            >
              {inspectorBody}
            </Inspector>
          </div>
        </div>

        <ForeignStatusBar readouts={foreignReadouts(vm)} />
      </div>
    </ScreenStage>
  );
}
