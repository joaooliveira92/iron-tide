import { debugRevisionActions } from "../../components/shared/debugRevisionActions.js";
import { ResearchLoadErrorState, ResearchLoadingState } from "./components/index.js";
import { ResearchWorkspace } from "./ResearchWorkspace.js";
import { useResearchScreen } from "./hooks/useResearchScreen.js";
import { buildResearchViewModel } from "./research-view-model.js";

export function ResearchScreen({ sessionId }: { readonly sessionId: string }) {
  const { state, loadError, setFieldWeight, revert, submit, reload, canSubmit } =
    useResearchScreen(sessionId);

  if (loadError !== null) {
    return <ResearchLoadErrorState message={loadError} onRetry={() => void reload()} />;
  }

  if (state.kind === "idle") {
    return <ResearchLoadingState />;
  }

  const vm = buildResearchViewModel(state);

  return (
    <div data-guided-target="research">
      <ResearchWorkspace
        vm={vm}
        busy={state.kind === "submitting"}
        canSubmit={canSubmit}
        submitted={state.kind === "submitted"}
        notice={state.notice}
        commandExtras={debugRevisionActions(state.month, state.revision)}
        onSetFieldWeight={setFieldWeight}
        onRevert={revert}
        onSubmit={submit}
      />
    </div>
  );
}
