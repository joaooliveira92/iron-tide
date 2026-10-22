export interface EntityReferenceDto {
  readonly type:
    | "ship"
    | "shipClass"
    | "nation"
    | "region"
    | "technology"
    | "constructionProject"
    | "battle"
    | "formation";
  readonly id: string;
}

export interface EffectReferenceDto {
  readonly target: EntityReferenceDto;
  readonly attribute: string;
  readonly previousValue?: string | number | boolean;
  readonly newValue?: string | number | boolean;
  readonly delta?: number;
  readonly visibility: "exact" | "qualitative" | "hidden";
}

export interface TurnMessageDto {
  readonly id: string;
  readonly turnId: string;
  readonly occurredAt: string;
  readonly phase: string;
  readonly category: string;
  readonly severity: "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "TRACE";
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly interpolation: Readonly<Record<string, string | number | boolean>>;
  readonly subjectRefs: readonly EntityReferenceDto[];
  readonly effectRefs: readonly EffectReferenceDto[];
  readonly blocking: boolean;
  readonly requiresAcknowledgement: boolean;
  readonly decisionId?: string;
  readonly battleId?: string;
  readonly deduplicationKey?: string;
  readonly aggregateKey?: string;
  readonly playerVisible: boolean;
  readonly debugMetadata?: {
    readonly sourceEventIds: readonly string[];
    readonly projectionVersion: string;
    readonly rulesetVersion: string;
    readonly contentVersion: string;
  };
}

export interface TurnSummaryEntry {
  readonly turnId: string;
  readonly projectionVersion: string;
  readonly occurredAt: string;
  readonly rulesetVersion: string;
  readonly contentVersion: string;
  readonly messages: readonly TurnMessageDto[];
}

export interface ReadTurnSummariesResult {
  readonly summaries: readonly TurnSummaryEntry[];
}

export interface TurnSummaries {
  readonly summaries: readonly TurnSummaryEntry[];
}

export interface EffectHintDto {
  readonly target: EntityReferenceDto;
  readonly attribute: string;
  readonly direction: "increase" | "decrease" | "none";
  readonly magnitude: "minor" | "moderate" | "major";
}

export interface DecisionOptionDto {
  readonly optionId: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly hints: readonly EffectHintDto[];
  readonly effects: readonly {
    readonly nationId: string;
    readonly attribute: "treasury";
    readonly delta: number;
  }[];
}

export interface InterruptionRequestDto {
  readonly kind: "decision" | "battle" | "offer";
  readonly turnId: string;
  readonly interruptionId: string;
  readonly ordinal: number;
  readonly phase: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly interpolation: Readonly<Record<string, string | number | boolean>>;
  readonly decisionId?: string;
  readonly options?: readonly DecisionOptionDto[];
  readonly battleId?: string;
  readonly attackerId?: string;
  readonly defenderId?: string;
  readonly areaId?: string;
  readonly missionType?: string;
  readonly acceptanceClass?: string;
  readonly playerSide?: "ATTACKER" | "DEFENDER";
  readonly playerForce?: readonly OfferForceShipDto[];
  readonly estimate?: OfferEstimateDto;
  readonly supportForcePresent?: boolean;
  readonly supportNationIds?: readonly string[];
  readonly declineStatementKeys?: readonly string[];
}

export interface OfferForceShipDto {
  readonly shipId: string;
  readonly name: string;
  readonly classId: string;
}

export interface OfferEstimateDto {
  readonly model: "EXACT" | "BANDED" | "PERTURBED";
  readonly strength: number;
}

export interface PendingTurnDto {
  readonly turnId: string;
  readonly campaignId: string;
  readonly playerNationId: string;
  readonly startingRevision: number;
  readonly nextInterruptionOrdinal: number;
  readonly recordedInputCount: number;
  readonly createdAt: string;
}

export type ResolveTurnResult =
  | {
      readonly status: "completed";
      readonly summary: TurnSummaryEntry;
      readonly closing: {
        readonly revision: number;
        readonly month: { readonly year: number; readonly month: number };
        readonly closingTreasury: number;
      };
    }
  | {
      readonly status: "suspended";
      readonly request: InterruptionRequestDto | null;
      readonly pendingTurn: PendingTurnDto;
    }
  | { readonly status: "unavailable" };

export interface ReadPendingTurnResult {
  readonly pending: PendingTurnDto | null;
  readonly valid: boolean;
}

export interface AbandonPendingTurnResult {
  readonly abandoned: boolean;
}
