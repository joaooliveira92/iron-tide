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

/**
 * Diplomacy & War screen (desktop-diplomacy-war INC-3). Renders ONLY data
 * from the engine's `DiplomacyScreenProjection` — relations, wars, blockades,
 * world areas — with per-row action affordances derived from the projected
 * relation/nap state (spec: UI affordance only; the engine is the authority
 * at issue time). Submitting `submitDiplomacyCommand` uses the shell's
 * `expectedRevision` / `transportRequestId` optimistic-concurrency flow; the
 * engine applies the queued envelope on the NEXT turn advance (spec D1) — the
 * screen says exactly that, and engine rejection notices carry the engine's
 * code verbatim (never fabricated copy).
 */
export function DiplomacyScreen({ sessionId }: { readonly sessionId: string }) {
  const {
    state,
    setRowAction,
    setPeaceAction,
    setBlockadeArea,
    clearDraft,
    submit,
    reload,
    canSubmit,
  } = useDiplomacyScreen(sessionId);
  const battleHistory = useBattleHistory(sessionId, state.revision);

  if (state.kind === "load-failed") {
    return <DiplomacyLoadErrorState message={state.message} onRetry={() => void reload()} />;
  }

  if (state.kind === "idle" || state.kind === "loading") {
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
