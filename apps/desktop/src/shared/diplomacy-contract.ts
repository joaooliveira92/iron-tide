import type { DiplomacyScreenProjection as EngineDiplomacyScreenProjection } from "@bluewave/campaign-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

export interface DiplomacyScreenProjection extends EngineDiplomacyScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
}

export type DiplomacyCommandBody =
  | { readonly type: "DeclareWar"; readonly targetNationId: string; readonly warGoalsId?: string }
  | { readonly type: "AcceptPeace"; readonly warId: string }
  | { readonly type: "FormAlliance"; readonly partnerNationId: string }
  | { readonly type: "BreakAlliance"; readonly partnerNationId: string }
  | { readonly type: "FormNonAggressionPact"; readonly partnerNationId: string }
  | { readonly type: "BreakNonAggressionPact"; readonly partnerNationId: string }
  | { readonly type: "DeclareBlockade"; readonly targetNationId: string; readonly areaId: string };

export type DiplomacyCommandType = DiplomacyCommandBody["type"];

export interface SubmitDiplomacyCommandPayload extends CommandEnvelope {
  readonly command: DiplomacyCommandBody;
}

export interface DiplomacyCommandOutcome {
  readonly commandId: string;
  readonly bodyType: DiplomacyCommandType;
  readonly appliedOnNextTurn: true;
}
