import type { ResearchScreenProjection as EngineResearchScreenProjection } from "@bluewave/campaign-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

export interface ResearchScreenProjection extends EngineResearchScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
}

export interface SetResearchPriorityCommandPayload extends CommandEnvelope {
  readonly fieldPriorities: Readonly<Record<string, number>>;
  readonly exactTechId?: string;
}

export interface ResearchPriorityOutcome {
  readonly commandId: string;
  readonly priorities: Readonly<Record<string, number>>;
  readonly appliedOnNextTurn: true;
}
