import type { CommandEnvelope } from "./bridge-contract.js";

/**
 * Submit a component-level ship design (ADR-0066). The main process re-compiles the draft against the bundled
 * ship-building content for an immediate answer, then queues a real `SubmitDesign` engine envelope; the engine
 * compiles it again authoritatively when the month is committed.
 */
export interface SubmitDesignCommandPayload extends CommandEnvelope {
  readonly className: string;
  /** A `@bluewave/ship-design` DesignDraft as JSON. */
  readonly draft: Record<string, unknown>;
}

/** The design study a submission opens (DESIGN-21 section 3, ADR-0085): what it costs and when the design is approved. */
export interface DesignStudyPreview {
  /** Months of paid study work; the design joins the catalog in the month the last one is paid. */
  readonly months: number;
  /** Total study cost in treasury units, paid month by month. */
  readonly cost: number;
  /** Derived from an approved design in the same family (25 % less work and cost). */
  readonly derived: boolean;
  readonly discountBp: number;
  /** The approved design it is derived from, when derived. */
  readonly baselineClassName: string | null;
  /** A design under an existing class name that is not similar starts a new family; these are the criteria it failed. */
  readonly newFamily: boolean;
  readonly failedCriteria: readonly string[];
}

export interface DesignCommandOutcome {
  readonly commandId: string;
  readonly designVersionId: string;
  readonly appliedOnNextTurn: true;
  /** Present when the content has study rules: the design is approved when this study is done, not next month. */
  readonly study?: DesignStudyPreview;
}

/** Revise a construction project with a changed design (ADR-0070). The engine classifies and applies it at month end. */
export interface ReviseProjectCommandPayload extends CommandEnvelope {
  readonly projectId: string;
  /** The whole new `@bluewave/ship-design` DesignDraft as JSON. */
  readonly draft: Record<string, unknown>;
}

/** The immediate answer for a queued revision: what the engine will do with it (preflight with the same rules). */
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

/** A ship the player can rebuild: commissioned, free, and built from a design that kept its source draft (ADR-0078). */
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

/** Check a changed design as a rebuild of a ship, without queuing anything (the same rules the engine applies). */
export interface RebuildCheckPayload {
  readonly sessionId: string;
  readonly shipId: string;
  /** The whole new `@bluewave/ship-design` DesignDraft as JSON. */
  readonly draft: Record<string, unknown>;
  /** The chosen rebuild action when it is not a standard rebuild; only `BULGE` is offered in the early band. */
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

/** The answer of the rebuild check: legal or not, why not, and how far the change goes against each limit. */
export interface RebuildCheckView {
  readonly legal: boolean;
  /** Rebuild-specific findings (retained-hull limits, dock, armament change, the bulge requirement); empty when the design itself cannot be built. */
  readonly findings: readonly RebuildFindingView[];
  /** The design's own blocking problems (as new construction), shown first; empty when it compiles. */
  readonly designProblems: readonly string[];
  /** True when the draft changes nothing about the ship. */
  readonly changesNothing: boolean;
  readonly measures: RebuildMeasuresView | null;
  /**
   * The versioned torpedo-protection gain credited to a `BULGE` rebuild, bp (ADR-0130 section 3), or
   * null when this is not a bulge check or the pack carries no refit balance. Recorded, not yet
   * consumed by combat (ADR-0130 section 4); the speed penalty is `measures.speedChangeMilliKnots`.
   */
  readonly bulgeProtectionGainBp: number | null;
}

/** Start a rebuild of a completed ship with a changed design (ADR-0078). The engine applies it when the month is committed. */
export interface StartRebuildCommandPayload extends CommandEnvelope {
  readonly shipId: string;
  readonly draft: Record<string, unknown>;
  /** The chosen rebuild action; `BULGE` for the manual's "add bulges" rebuild, absent for a standard rebuild. */
  readonly rebuildKind?: "BULGE";
}

export interface RebuildCommandOutcome {
  readonly commandId: string;
  readonly projectId: string;
  readonly newDesignVersionId: string;
  readonly appliedOnNextTurn: true;
}

/** The Drawing Board's saved working design: its starting design and the encoded edit log (`encodeLog`). */
export interface DrawingBoardDraftRecord {
  readonly presetId: string;
  readonly log: string;
  /** ISO time of the last save. */
  readonly savedAt: string;
}

export interface ReadDrawingBoardDraftResult {
  readonly draft: DrawingBoardDraftRecord | null;
}

export interface WriteDrawingBoardDraftPayload {
  readonly sessionId: string;
  /** Null removes the saved draft. */
  readonly draft: { readonly presetId: string; readonly log: string } | null;
}
