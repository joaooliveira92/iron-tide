import type { CommandEnvelope } from "./bridge-contract.js";

export interface SubmitDesignCommandPayload extends CommandEnvelope {
  readonly className: string;
  readonly draft: Record<string, unknown>;
}

export interface DesignStudyPreview {
  readonly months: number;
  readonly cost: number;
  readonly derived: boolean;
  readonly discountBp: number;
  readonly baselineClassName: string | null;
  readonly newFamily: boolean;
  readonly failedCriteria: readonly string[];
}

export interface DesignCommandOutcome {
  readonly commandId: string;
  readonly designVersionId: string;
  readonly appliedOnNextTurn: true;
  readonly study?: DesignStudyPreview;
}

export interface ReviseProjectCommandPayload extends CommandEnvelope {
  readonly projectId: string;
  readonly draft: Record<string, unknown>;
}

export interface ReviseCommandOutcome {
  readonly commandId: string;
  readonly newDesignVersionId: string;
  readonly tier: "T0_FREE" | "T1_REVISION" | "T2_REDESIGN";
  readonly progressBp: number;
  readonly reworkWork: number;
  readonly reasonCodes: readonly string[];
  readonly appliedOnNextTurn: true;
}

export interface LoadProjectDraftPayload {
  readonly sessionId: string;
  readonly projectId: string;
}

export interface ProjectDraftView {
  readonly className: string;
  readonly draft: Record<string, unknown>;
}

export interface RebuildableShipView {
  readonly shipId: string;
  readonly name: string;
  readonly className: string;
  readonly designVersionId: string;
}

export interface LoadShipDraftPayload {
  readonly sessionId: string;
  readonly shipId: string;
}

export interface ShipDraftView {
  readonly className: string;
  readonly draft: Record<string, unknown>;
}

export interface RebuildCheckPayload {
  readonly sessionId: string;
  readonly shipId: string;
  readonly draft: Record<string, unknown>;
  readonly rebuildKind?: "BULGE";
}

export interface RebuildFindingView {
  readonly id: string;
  readonly what: string;
  readonly why: string;
  readonly consequence: string;
  readonly remedies: readonly string[];
}

export interface RebuildMeasuresView {
  readonly displacementChangeBp: number;
  readonly speedChangeMilliKnots: number;
  readonly lengthChangeBp: number;
  readonly beamChangeBp: number;
}

export interface RebuildCheckView {
  readonly legal: boolean;
  readonly findings: readonly RebuildFindingView[];
  readonly designProblems: readonly string[];
  readonly changesNothing: boolean;
  readonly measures: RebuildMeasuresView | null;
  readonly bulgeProtectionGainBp: number | null;
}

export interface StartRebuildCommandPayload extends CommandEnvelope {
  readonly shipId: string;
  readonly draft: Record<string, unknown>;
  readonly rebuildKind?: "BULGE";
}

export interface RebuildCommandOutcome {
  readonly commandId: string;
  readonly projectId: string;
  readonly newDesignVersionId: string;
  readonly appliedOnNextTurn: true;
}

export interface DrawingBoardDraftRecord {
  readonly presetId: string;
  readonly log: string;
  readonly savedAt: string;
}

export interface ReadDrawingBoardDraftResult {
  readonly draft: DrawingBoardDraftRecord | null;
}

export interface WriteDrawingBoardDraftPayload {
  readonly sessionId: string;
  readonly draft: { readonly presetId: string; readonly log: string } | null;
}
