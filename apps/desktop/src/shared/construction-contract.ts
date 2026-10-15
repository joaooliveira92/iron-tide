import type {
  CompiledDesignVersion,
  ConstructionCommand,
  ConstructionProjectQueueEntry,
} from "@bluewave/campaign-engine";
import type { ConstructionBatchPreview, ForeignConstructionPreview } from "@bluewave/phase-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

/**
 * Grounded in `construction-screen-state.ts`, `StatsPanel.tsx`, and
 * `CommandTable.tsx` — every field here is copied from an engine response;
 * the screen never derives costs, capacity, or remaining treasury itself.
 */
export interface ConstructionScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
  readonly economy: {
    readonly treasury: number;
    readonly monthlyAppropriation: number;
    readonly shipyardCapacity: number;
    /** The nation's compiled dock size — the largest new-construction displacement it may build (SB3-R15). */
    readonly dockMaxBuildDisplacementKg: number | null;
    /** The national concurrency cap: `multipleBp × dock size` (SB3-R18). */
    readonly maxConcurrentConstructionMassKg: number;
    /** Non-exempt `NEW_CONSTRUCTION` mass already committed, competing with the cap (SB3-R18/R19). */
    readonly committedNewConstructionMassKg: number;
    /** Exempt AMC / small-corvette mass under construction, outside the cap (SB3-R19). */
    readonly exemptNewConstructionMassKg: number;
    /** The shipped dock-expansion duration, in completed months (SB3-R16). */
    readonly dockExpansionDurationMonths: number;
    /** The next era step an expansion authorized this month would lock, or `null` when the month has no era step. */
    readonly dockExpansionNextStepKg: number | null;
    /** The nation's ports (expansion targets), ascending by id. */
    readonly dockPossessions: readonly { readonly id: string; readonly name: string }[];
  };
  readonly designs: readonly CompiledDesignVersion[];
  /** The nation's real construction projects (authored starting builds AND
   * order-queued projects), keyed by project id. */
  readonly projects: readonly ConstructionProjectQueueEntry[];
  readonly workspace: {
    readonly commands: readonly ConstructionCommand[];
    readonly treasuryReserved: number;
    readonly capacityReserved: number;
  };
}

export interface ConstructionCommandOutcome {
  readonly workspace: ConstructionScreenProjection["workspace"];
  readonly command: { readonly commandId: string; readonly status: string };
}

export interface SubmitConstructionCommandPayload extends CommandEnvelope {
  readonly designId: string;
}

export interface ReplaceConstructionCommandPayload extends SubmitConstructionCommandPayload {
  readonly commandId: string;
}

export interface CancelConstructionCommandPayload extends CommandEnvelope {
  readonly commandId: string;
}

/**
 * The construction-status commands (DESIGN-23 sections 7-8; SB3-R5/R8): halt, resume and the acceleration toggle. They
 * queue a real engine command envelope through the shared pending-queue seam and apply on the next `commitMonth`, so
 * the engine's `command_collection` phase is the sole mutator of the project status/premium.
 */
export interface HaltConstructionCommandPayload extends CommandEnvelope {
  readonly projectId: string;
}

export interface ResumeConstructionCommandPayload extends CommandEnvelope {
  readonly projectId: string;
}

/**
 * Cancel a dockyard project and settle it (DESIGN-23 section 23; DESIGN-11). Distinct from `CancelConstructionCommand`,
 * which cancels an in-flight queued order before the project is committed: this queues a real engine
 * `CancelConstructionProject` command that applies on the next `commitMonth`, moving the project to `CANCELLED`,
 * settling the work already done, and releasing a rebuild's target ship.
 */
export interface CancelConstructionProjectCommandPayload extends CommandEnvelope {
  readonly projectId: string;
}

export interface SetAccelerationCommandPayload extends CommandEnvelope {
  readonly projectId: string;
  readonly accelerated: boolean;
}

/**
 * The class-order batch command (DESIGN-23 sections 3-5; SB3-R11): order `1..12` ships of one approved compiled design
 * version in a single command. The engine's `placeConstructionBatch` policy reserves the whole batch before adding any
 * project.
 */
export interface OrderConstructionBatchCommandPayload extends CommandEnvelope {
  readonly designVersionId: string;
  readonly quantity: number;
}

/**
 * The read-only build-dialog preview (SB3-R30/R33). Carries the player's choices only; the engine resolves the names,
 * the dock ceiling and the fit. A refused quantity is reported as the engine's `reason` — the dialog never invents one.
 */
export interface PreviewConstructionBatchCommandPayload {
  readonly sessionId: string;
  readonly designVersionId: string;
  readonly quantity: number;
}

export type ConstructionBatchPreviewOutcome =
  | { readonly ok: true; readonly preview: ConstructionBatchPreview }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };

/** The dock-expansion authorization (DESIGN-16 sections 5-6; SB3-R16): a twelve-month step for one possession. */
export interface AuthorizeDockExpansionCommandPayload extends CommandEnvelope {
  readonly possessionId: string;
}

/**
 * The foreign-yard order (DESIGN-16 sections 13.1-13.4; SB3-R20..R22). The payload carries only the player's choices —
 * design, builder, quantity and an optional delivery month. The engine derives the contract `terms` and the builder
 * `capability` from authoritative content (`placeForeignConstructionOrder` forms the immutable contract and checks every
 * predicate), so the renderer never supplies a price, schedule or capability.
 */
export interface PlaceForeignConstructionCommandPayload extends CommandEnvelope {
  readonly designVersionId: string;
  readonly builderNationId: string;
  readonly quantity: number;
  readonly plannedDeliveryMonth?: string;
}

/** The shape every queued construction command returns: the deterministic envelope id and the next-turn contract. */
export interface ConstructionCommandQueuedOutcome {
  readonly commandId: string;
  readonly bodyType: string;
  readonly appliedOnNextTurn: true;
}

/**
 * The read-only foreign-order preview (SB3-R20/R23/R34; INC-9b). Carries the player's choices only — design, quantity,
 * an optional builder and delivery month — and the engine returns the candidate builders (dock ceiling, free
 * `NEW_CONSTRUCTION` capacity, capability verdict, impoundment risk, delivery guarantee) and, when a builder is
 * chosen, the contract terms the order would form. It mutates and reserves nothing.
 */
export interface PreviewForeignConstructionCommandPayload {
  readonly sessionId: string;
  readonly designVersionId: string;
  readonly quantity: number;
  readonly builderNationId?: string;
  readonly plannedDeliveryMonth?: string;
}

/** The preview outcome: the engine's compiled preview, or its own reason code (never a UI-invented one). */
export type ForeignConstructionPreviewOutcome =
  | { readonly ok: true; readonly preview: ForeignConstructionPreview }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };
