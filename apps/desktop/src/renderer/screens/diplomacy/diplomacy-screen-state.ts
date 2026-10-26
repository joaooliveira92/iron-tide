import type {
  DiplomacyScreenProjection,
  DiplomacyCommandBody,
} from "../../../shared/diplomacy-contract.js";
import { describeRejection } from "../../lib/command-screen-workflow.js";

export type DiplomacyScreenState =
  | DiplomacyScreenIdle
  | DiplomacyScreenLoaded
  | DiplomacyScreenSubmitting
  | DiplomacyScreenSubmitted
  | DiplomacyScreenRejectedWithRevision;

export interface DiplomacyScreenIdle {
  readonly kind: "idle";
  readonly revision: number;
}

export interface DiplomacyScreenActiveData {
  readonly revision: number;
  readonly month: DiplomacyScreenProjection["month"];
  readonly projection: DiplomacyScreenProjection;
  readonly draftCommand: DiplomacyDraftCommand | null;
  readonly notice: string | null;
}

export interface DiplomacyScreenLoaded extends DiplomacyScreenActiveData {
  readonly kind: "loaded";
}

export interface DiplomacyScreenSubmitting extends DiplomacyScreenActiveData {
  readonly kind: "submitting";
  readonly pendingTransportRequestId: string;
}

export interface DiplomacyScreenSubmitted extends DiplomacyScreenActiveData {
  readonly kind: "submitted";
}

export interface DiplomacyScreenRejectedWithRevision extends DiplomacyScreenActiveData {
  readonly kind: "rejected-with-revision";
}

export type DiplomacyActionKind =
  | "DeclareWar"
  | "AcceptPeace"
  | "FormAlliance"
  | "BreakAlliance"
  | "FormNonAggressionPact"
  | "BreakNonAggressionPact"
  | "DeclareBlockade";

export interface DiplomacyDraftCommand {
  readonly kind: DiplomacyActionKind;
  readonly partnerNationId: string;
  readonly warId?: string;
  readonly areaId?: string;
}

export function initialDiplomacyScreenState(): DiplomacyScreenState {
  return { kind: "idle", revision: 0 };
}

export function diplomacyLoadSuccess(projection: DiplomacyScreenProjection): DiplomacyScreenState {
  return {
    kind: "loaded",
    revision: projection.revision,
    month: projection.month,
    projection,
    draftCommand: null,
    notice: null,
  };
}

export function diplomacyBeginAction(
  state: DiplomacyScreenState,
  partnerNationId: string,
  kind: DiplomacyActionKind,
): DiplomacyScreenState {
  if (state.kind !== "loaded" && state.kind !== "submitted") return state;
  if (kind === "AcceptPeace") return state;
  const draft: DiplomacyDraftCommand = {
    kind,
    partnerNationId,
    ...(kind === "DeclareBlockade" ? { areaId: state.projection.areas[0]?.areaId } : {}),
  };
  return { ...state, draftCommand: draft, notice: null };
}

export function diplomacyBeginPeace(
  state: DiplomacyScreenState,
  war: DiplomacyScreenProjection["wars"][number],
): DiplomacyScreenState {
  if (state.kind !== "loaded" && state.kind !== "submitted") return state;
  if (war.status !== "ACTIVE") return state;
  const opponent = war.playerSide === "attacker" ? war.defenderId : war.attackerId;
  return {
    ...state,
    draftCommand: {
      kind: "AcceptPeace",
      partnerNationId: opponent,
      warId: war.warId,
    },
    notice: null,
  };
}

export function diplomacySetBlockadeArea(
  state: DiplomacyScreenState,
  areaId: string,
): DiplomacyScreenState {
  if (state.kind !== "loaded" && state.kind !== "submitted") return state;
  const draft = state.draftCommand;
  if (draft === null || draft.kind !== "DeclareBlockade") return state;
  return { ...state, draftCommand: { ...draft, areaId }, notice: null };
}

export function diplomacyClearDraft(state: DiplomacyScreenState): DiplomacyScreenState {
  if (state.kind !== "loaded" && state.kind !== "submitted") return state;
  return { ...state, draftCommand: null, notice: null };
}

export function diplomacyBeginSubmit(
  state: DiplomacyScreenState,
  transportRequestId: string,
): DiplomacyScreenState {
  if (state.kind !== "loaded" && state.kind !== "submitted") return state;
  const draft = state.draftCommand;
  if (draft === null || diplomacyDraftToCommand(draft) === null) return state;
  return {
    ...state,
    kind: "submitting",
    pendingTransportRequestId: transportRequestId,
    notice: null,
  };
}

export function diplomacySubmitSuccess(
  state: DiplomacyScreenState,
  outcome: { readonly commandId: string; readonly bodyType: string },
): DiplomacyScreenState {
  if (state.kind !== "submitting") return state;
  return {
    kind: "submitted",
    revision: state.revision,
    month: state.month,
    projection: state.projection,
    draftCommand: state.draftCommand,
    notice: `${outcome.commandId} (${outcome.bodyType}) queued — the engine applies it on the next turn advance.`,
  };
}

export function diplomacySubmitRejected(
  state: DiplomacyScreenState,
  rejection: {
    readonly reason: string;
    readonly diagnostics: readonly string[];
    readonly currentRevision?: number;
  },
): DiplomacyScreenState {
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
      draftCommand: state.draftCommand,
      notice,
    };
  }
  return {
    kind: "loaded",
    revision: state.revision,
    month: state.month,
    projection: state.projection,
    draftCommand: state.draftCommand,
    notice,
  };
}

export function diplomacyTransportFailure(
  state: DiplomacyScreenState,
  message: string,
): DiplomacyScreenState {
  if (state.kind !== "submitting" && state.kind !== "submitted") return state;
  return {
    kind: "loaded",
    revision: state.revision,
    month: state.month,
    projection: state.projection,
    draftCommand: state.draftCommand,
    notice: `TRANSPORT_FAILURE: ${message}`,
  };
}

export function diplomacyDraftToCommand(draft: DiplomacyDraftCommand): DiplomacyCommandBody | null {
  switch (draft.kind) {
    case "DeclareWar":
      return { type: "DeclareWar", targetNationId: draft.partnerNationId };
    case "AcceptPeace":
      return draft.warId !== undefined ? { type: "AcceptPeace", warId: draft.warId } : null;
    case "FormAlliance":
      return { type: "FormAlliance", partnerNationId: draft.partnerNationId };
    case "BreakAlliance":
      return { type: "BreakAlliance", partnerNationId: draft.partnerNationId };
    case "FormNonAggressionPact":
      return {
        type: "FormNonAggressionPact",
        partnerNationId: draft.partnerNationId,
      };
    case "BreakNonAggressionPact":
      return {
        type: "BreakNonAggressionPact",
        partnerNationId: draft.partnerNationId,
      };
    case "DeclareBlockade":
      return draft.areaId !== undefined
        ? {
            type: "DeclareBlockade",
            targetNationId: draft.partnerNationId,
            areaId: draft.areaId,
          }
        : null;
  }
}

export function diplomacyCanSubmit(state: DiplomacyScreenState): boolean {
  return (
    state.kind === "loaded" &&
    state.draftCommand !== null &&
    diplomacyDraftToCommand(state.draftCommand) !== null
  );
}
