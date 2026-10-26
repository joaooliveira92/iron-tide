import type {
  ResearchPriorityOutcome,
  ResearchScreenProjection,
} from "../../../shared/research-contract.js";
import { describeRejection } from "../../lib/command-screen-workflow.js";
import { type FieldWeightsDraft, seedDraft } from "./research-field-priorities.js";

export type ResearchScreenState =
  | ResearchScreenIdle
  | ResearchScreenLoaded
  | ResearchScreenSubmitting
  | ResearchScreenSubmitted
  | ResearchScreenRejectedWithRevision;

export interface ResearchScreenIdle {
  readonly kind: "idle";
  readonly revision: number;
}

export interface ResearchScreenActiveData {
  readonly revision: number;
  readonly month: ResearchScreenProjection["month"];
  readonly projection: ResearchScreenProjection;
  readonly draft: FieldWeightsDraft;
  readonly notice: string | null;
}

export interface ResearchScreenLoaded extends ResearchScreenActiveData {
  readonly kind: "loaded";
}

export interface ResearchScreenSubmitting extends ResearchScreenActiveData {
  readonly kind: "submitting";
  readonly pendingTransportRequestId: string;
}

export interface ResearchScreenSubmitted extends ResearchScreenActiveData {
  readonly kind: "submitted";
}

export interface ResearchScreenRejectedWithRevision extends ResearchScreenActiveData {
  readonly kind: "rejected-with-revision";
}

export function initialResearchScreenState(): ResearchScreenState {
  return { kind: "idle", revision: 0 };
}

export function researchLoadSuccess(projection: ResearchScreenProjection): ResearchScreenState {
  return {
    kind: "loaded",
    revision: projection.revision,
    month: projection.month,
    projection,
    draft: seedDraft(projection),
    notice: null,
  };
}

export function researchBeginSubmit(
  state: ResearchScreenState,
  transportRequestId: string,
): ResearchScreenState {
  if (state.kind !== "loaded" && state.kind !== "submitted") return state;
  return {
    kind: "submitting",
    revision: state.revision,
    month: state.month,
    projection: state.projection,
    draft: state.draft,
    pendingTransportRequestId: transportRequestId,
    notice: state.notice,
  };
}

export function researchSubmitSuccess(
  state: ResearchScreenState,
  outcome: ResearchPriorityOutcome,
): ResearchScreenState {
  if (state.kind !== "submitting") return state;
  return {
    kind: "submitted",
    revision: state.revision,
    month: state.month,
    projection: state.projection,
    draft: state.draft,
    notice: `${outcome.commandId} queued — the engine applies these priorities on the next turn advance.`,
  };
}

export function researchSubmitRejected(
  state: ResearchScreenState,
  rejection: {
    readonly reason: string;
    readonly diagnostics: readonly string[];
    readonly currentRevision?: number;
  },
): ResearchScreenState {
  if (state.kind !== "submitting" && state.kind !== "submitted") return state;
  const notice = describeRejection(
    rejection.reason,
    rejection.diagnostics,
    rejection.currentRevision,
  );
  if (rejection.currentRevision !== undefined) {
    return {
      kind: "rejected-with-revision",
      revision: rejection.currentRevision,
      month: state.month,
      projection: state.projection,
      draft: state.draft,
      notice,
    };
  }
  return {
    kind: "loaded",
    revision: state.revision,
    month: state.month,
    projection: state.projection,
    draft: state.draft,
    notice,
  };
}

export function researchTransportFailure(
  state: ResearchScreenState,
  message: string,
): ResearchScreenState {
  if (state.kind !== "submitting" && state.kind !== "submitted") return state;
  return {
    kind: "loaded",
    revision: state.revision,
    month: state.month,
    projection: state.projection,
    draft: state.draft,
    notice: `TRANSPORT_FAILURE: ${message}`,
  };
}

export function researchRevertDraft(state: ResearchScreenState): ResearchScreenState {
  if (
    state.kind !== "loaded" &&
    state.kind !== "submitted" &&
    state.kind !== "rejected-with-revision"
  )
    return state;
  return { ...state, draft: seedDraft(state.projection), notice: null };
}
