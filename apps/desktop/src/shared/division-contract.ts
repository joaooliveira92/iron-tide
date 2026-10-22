import type { DivisionScreenView } from "@bluewave/campaign-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

export interface DivisionScreenProjection extends DivisionScreenView {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
}

export type DivisionCommandBody =
  | {
      readonly type: "CreateDivision";
      readonly flagshipShipId: string;
      readonly role: string;
      readonly formation: string;
    }
  | { readonly type: "AddShipToDivision"; readonly divisionId: string; readonly shipId: string }
  | {
      readonly type: "RemoveShipFromDivision";
      readonly divisionId: string;
      readonly shipId: string;
    }
  | {
      readonly type: "ChangeDivisionFlagship";
      readonly divisionId: string;
      readonly newFlagshipShipId: string;
    }
  | {
      readonly type: "ReorderDivisionShips";
      readonly divisionId: string;
      readonly shipOrder: readonly string[];
    }
  | { readonly type: "DissolveDivision"; readonly divisionId: string };

export type DivisionCommandType = DivisionCommandBody["type"];

export interface SubmitDivisionCommandPayload extends CommandEnvelope {
  readonly command: DivisionCommandBody;
}

export interface DivisionCommandOutcome {
  readonly commandId: string;
  readonly bodyType: DivisionCommandType;
  readonly appliedOnNextTurn: true;
}
