import { Handshake, History } from "lucide-react";
import { GlassSectionCard } from "../../components/shared/GlassSectionCard.js";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { debugRevisionActions } from "../../components/shared/debugRevisionActions.js";
import {
  BattleHistorySection,
  BlockadesSection,
  CommandQueueBar,
  DiplomacyLoadErrorState,
  DiplomacyLoadingState,
  DiplomacyNotice,
  RelationsSection,
  WarsSection,
} from "./components/index.js";
import { buildDiplomacyViewModel } from "./diplomacy-view-model.js";
import { useBattleHistory } from "./hooks/useBattleHistory.js";
import { useDiplomacyScreen } from "./hooks/useDiplomacyScreen.js";

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

  if (loadError !== null) {
    return <DiplomacyLoadErrorState message={loadError} onRetry={() => void reload()} />;
  }

  if (state.kind === "idle") {
    return <DiplomacyLoadingState />;
  }

  const busy = state.kind === "submitting";
  const vm = buildDiplomacyViewModel(state.projection, state.draftCommand);

  return (
    <ScreenStage
      guidedTarget="diplomacy"
      icon={Handshake}
      title="Diplomacy & War"
      description="View and direct relations; the engine applies commands on the next turn advance."
      actions={debugRevisionActions(state.month, state.revision)}
    >
      {state.notice !== null && (
        <DiplomacyNotice submitted={state.kind === "submitted"} notice={state.notice} />
      )}

      <RelationsSection rows={vm.relations} busy={busy} onRowAction={setRowAction} />

      <WarsSection rows={vm.wars} busy={busy} onPeaceAction={setPeaceAction} />

      <BlockadesSection rows={vm.blockades} />

      <GlassSectionCard
        icon={<History className="h-4 w-4 text-muted-foreground" />}
        title="Battle history"
        description="Resolved battles and the ships lost in them, from the engine's recorded results."
      >
        <BattleHistorySection state={battleHistory} />
      </GlassSectionCard>

      <CommandQueueBar
        busy={busy}
        areas={state.projection.areas}
        draft={state.draftCommand}
        draftLabel={vm.draftLabel}
        canSubmit={canSubmit}
        onAreaChange={setBlockadeArea}
        onClear={clearDraft}
        onApply={submit}
      />
    </ScreenStage>
  );
}
