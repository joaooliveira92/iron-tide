import type { DiplomacyScreenProjection as EngineDiplomacyScreenProjection } from "@bluewave/campaign-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

/**
 * Diplomacy & War screen contract (desktop-diplomacy-war INC-1/INC-2). The
 * projection extends `@bluewave/campaign-engine`'s pure derivation (which maps
 * one-to-one onto `politics.relations` / `wars.wars` / `wars.blockadeState`,
 * never inventing data) with the revision/month the renderer's
 * optimistic-concurrency workflow needs — the same convention
 * `research-contract.ts` follows.
 */
export interface DiplomacyScreenProjection extends EngineDiplomacyScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
}

/**
 * Wire shape of one of the 7 B10c diplomacy commands. `nationId` is NEVER on
 * the wire — it is always the session's player slot, filled in by
 * `submitDiplomacyCommand` (spec D1: the desktop only queues a real engine
 * envelope; the engine is the sole authority).
 */
export type DiplomacyCommandBody =
  | { readonly type: "DeclareWar"; readonly targetNationId: string; readonly warGoalsId?: string }
  | { readonly type: "AcceptPeace"; readonly warId: string }
  | { readonly type: "FormAlliance"; readonly partnerNationId: string }
  | { readonly type: "BreakAlliance"; readonly partnerNationId: string }
  | { readonly type: "FormNonAggressionPact"; readonly partnerNationId: string }
  | { readonly type: "BreakNonAggressionPact"; readonly partnerNationId: string }
  | { readonly type: "DeclareBlockade"; readonly targetNationId: string; readonly areaId: string };

export type DiplomacyCommandType = DiplomacyCommandBody["type"];

/** Payload for `submitDiplomacyCommand` — the `CommandEnvelope` triple plus
 * the command to apply on the next turn advance. */
export interface SubmitDiplomacyCommandPayload extends CommandEnvelope {
  readonly command: DiplomacyCommandBody;
}

/** The outcome of queueing a diplomacy command. The engine applies the
 * envelope on the next `commitMonth` (spec D1 — the desktop never mutates
 * relations/wars/blockades directly). */
export interface DiplomacyCommandOutcome {
  readonly commandId: string;
  readonly bodyType: DiplomacyCommandType;
  readonly appliedOnNextTurn: true;
}
