import { FlaskConical } from "lucide-react";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { debugRevisionActions } from "../../components/shared/debugRevisionActions.js";
import {
  FieldPrioritiesEditor,
  InProgressTechnologiesCard,
  ResearchLoadErrorState,
  ResearchLoadingState,
  ResearchNotice,
  ResearchSummarySections,
} from "./components/index.js";
import { useResearchScreen } from "./hooks/useResearchScreen.js";
import { buildResearchViewModel } from "./research-view-model.js";

/**
 * Research & Technology screen (desktop-engine-feature-gate INC-3). Renders
 * ONLY data from the engine's `ResearchScreenProjection` — research budget,
 * field priorities (editable), in-progress technology work with invested
 * points, and discovered technologies. Submitting `setResearchPriorityCommand`
 * uses the shell's `expectedRevision` / `transportRequestId`
 * optimistic-concurrency flow (same as the Construction screen); the engine
 * applies the queued priorities on the NEXT turn advance (spec D1) — the
 * screen says exactly that, never that they are already in effect.
 */
export function ResearchScreen({ sessionId }: { readonly sessionId: string }) {
  const { state, setFieldWeight, submit, reload, canSubmit } = useResearchScreen(sessionId);

  if (state.kind === "load-failed") {
    return <ResearchLoadErrorState message={state.message} onRetry={() => void reload()} />;
  }

  if (state.kind === "idle" || state.kind === "loading") {
    return <ResearchLoadingState />;
  }

  const busy = state.kind === "submitting";
  const vm = buildResearchViewModel(state);

  return (
    <ScreenStage
      guidedTarget="research"
      icon={FlaskConical}
      title="Research & Technology"
      description="Set field priorities; the engine applies them on the next turn advance."
      actions={debugRevisionActions(state.month, state.revision)}
    >
      {state.notice !== null && (
        <ResearchNotice submitted={state.kind === "submitted"} notice={state.notice} />
      )}

      <ResearchSummarySections
        researchBudget={vm.researchBudget}
        annualAllocation={vm.annualAllocation}
        researchCap={vm.researchCap}
        budgetNote={vm.budgetNote}
        currentProjectLabel={vm.currentProjectLabel}
        discoveredTechs={vm.discoveredTechs}
      />

      <FieldPrioritiesEditor
        fields={vm.fields}
        highCount={vm.highCount}
        highCap={vm.highCap}
        highCountValid={vm.highCountValid}
        dirty={vm.dirty}
        busy={busy}
        canSubmit={canSubmit}
        onSetFieldWeight={setFieldWeight}
        onSubmit={() => submit()}
      />

      <InProgressTechnologiesCard technologies={vm.inProgressTechnologies} />
    </ScreenStage>
  );
}
