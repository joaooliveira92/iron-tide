import type {
  CompiledDesignVersion,
  ConstructionCommand,
  ConstructionProjectQueueEntry,
} from "@bluewave/campaign-engine";
import type { ConstructionBatchPreview, ForeignConstructionPreview } from "@bluewave/phase-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

export interface ConstructionScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
  readonly economy: {
    readonly treasury: number;
    readonly monthlyAppropriation: number;
    readonly shipyardCapacity: number;
    readonly dockMaxBuildDisplacementKg: number | null;
    readonly maxConcurrentConstructionMassKg: number;
    readonly committedNewConstructionMassKg: number;
    readonly exemptNewConstructionMassKg: number;
    readonly dockExpansionDurationMonths: number;
    readonly dockExpansionNextStepKg: number | null;
    readonly dockPossessions: readonly { readonly id: string; readonly name: string }[];
  };
  readonly designs: readonly CompiledDesignVersion[];
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

export interface HaltConstructionCommandPayload extends CommandEnvelope {
  readonly projectId: string;
}

export interface ResumeConstructionCommandPayload extends CommandEnvelope {
  readonly projectId: string;
}

export interface CancelConstructionProjectCommandPayload extends CommandEnvelope {
  readonly projectId: string;
}

export interface SetAccelerationCommandPayload extends CommandEnvelope {
  readonly projectId: string;
  readonly accelerated: boolean;
}

export interface OrderConstructionBatchCommandPayload extends CommandEnvelope {
  readonly designVersionId: string;
  readonly quantity: number;
}

export interface PreviewConstructionBatchCommandPayload {
  readonly sessionId: string;
  readonly designVersionId: string;
  readonly quantity: number;
}

export type ConstructionBatchPreviewOutcome =
  | { readonly ok: true; readonly preview: ConstructionBatchPreview }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };

export interface AuthorizeDockExpansionCommandPayload extends CommandEnvelope {
  readonly possessionId: string;
}

export interface PlaceForeignConstructionCommandPayload extends CommandEnvelope {
  readonly designVersionId: string;
  readonly builderNationId: string;
  readonly quantity: number;
  readonly plannedDeliveryMonth?: string;
}

export interface ConstructionCommandQueuedOutcome {
  readonly commandId: string;
  readonly bodyType: string;
  readonly appliedOnNextTurn: true;
}

export interface PreviewForeignConstructionCommandPayload {
  readonly sessionId: string;
  readonly designVersionId: string;
  readonly quantity: number;
  readonly builderNationId?: string;
  readonly plannedDeliveryMonth?: string;
}

export type ForeignConstructionPreviewOutcome =
  | { readonly ok: true; readonly preview: ForeignConstructionPreview }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };
