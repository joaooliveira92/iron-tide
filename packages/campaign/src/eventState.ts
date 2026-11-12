import type { NationTrait } from "@bluewave/content-schema";

export type EventResolver = "PLAYER" | "AI" | "DEFAULT";

export interface AnswerEffectLine {
  source: "DECLARED" | "TRAIT";
  trait?: NationTrait;
  reasonCode?: string;
  budgetBp: number;
  prestigeDelta: number;
  unrestDelta: number;
  tensionDelta: number;
}

export interface AnswerEffectRecord {
  lines: AnswerEffectLine[];
  budgetBp: number;
  prestigeDelta: number;
  unrestBefore: number;
  unrestAfter: number;
  tensionPartner?: string;
  tensionBefore?: number;
  tensionAfter?: number;
}

export interface FiredEventRecord {
  eventId: string;
  month: string;
  answerId: string;
  resolvedBy: EventResolver;
  effects?: AnswerEffectRecord;
}

export interface BudgetModifier {
  eventId: string;
  answerId: string;
  trait?: NationTrait;
  firstMonth: string;
  initialBp: number;
  decayMonths: number;
  capBp: number;
}

export interface PendingDilemma {
  eventId: string;
  drawnMonth: string;
}

export interface NationEventHistory {
  fired: FiredEventRecord[];
  flags: string[];
  pending?: PendingDilemma;
}
