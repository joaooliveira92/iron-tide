import type { DivisionScreenView } from "@bluewave/campaign-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

/**
 * Fleet-organization (division editor) contract. The projection extends
 * `@bluewave/campaign-engine`'s pure derivation with the revision/month the
 * optimistic-concurrency workflow needs — same convention as
 * `diplomacy-contract.ts`.
 */
export interface DivisionScreenProjection extends DivisionScreenView {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
}

/**
 * Wire shape of one of the 5 engine division commands. `nationId` is NEVER on
 * the wire (always the session's player slot), and `CreateDivision` carries no
 * division id: the handler derives a deterministic one from the flagship and turn, so the
 * renderer cannot collide with or forge ids.
 */
export type DivisionCommandBody =
  | {
      readonly type: "CreateDivision";
      /**
       * The ship the division is founded on. The engine creates a division with
       * exactly this one ship (its flagship); further ships join with
       * `AddShipToDivision`, each at a cohesion/experience cost.
       */
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
      /** Full canonical order: a permutation of the current ships, flagship first. */
      readonly divisionId: string;
      readonly shipOrder: readonly string[];
    }
  | { readonly type: "DissolveDivision"; readonly divisionId: string };

export type DivisionCommandType = DivisionCommandBody["type"];

/** Payload for `submitDivisionCommand` — the `CommandEnvelope` triple plus the command. */
export interface SubmitDivisionCommandPayload extends CommandEnvelope {
  readonly command: DivisionCommandBody;
}

/** The engine applies the queued envelope on the next `commitMonth`. */
export interface DivisionCommandOutcome {
  readonly commandId: string;
  readonly bodyType: DivisionCommandType;
  readonly appliedOnNextTurn: true;
}
