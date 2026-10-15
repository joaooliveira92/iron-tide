import type { ResearchScreenProjection as EngineResearchScreenProjection } from "@bluewave/campaign-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

/**
 * Research & Technology screen contract (desktop-engine-feature-gate INC-1/2).
 * The projection extends `@bluewave/campaign-engine`'s pure derivation (which
 * maps one-to-one onto `ResearchState`, never inventing data) with the
 * revision/month the renderer's optimistic-concurrency workflow needs — the
 * same convention `construction-contract.ts` follows.
 */
export interface ResearchScreenProjection extends EngineResearchScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
}

/** Payload for `setResearchPriorityCommand` — the `CommandEnvelope` triple
 * plus the field priorities to apply on the next month advance. */
export interface SetResearchPriorityCommandPayload extends CommandEnvelope {
  /**
   * Full high/medium/low weights per canonical research field
   * (`CANONICAL_RESEARCH_FIELD_IDS` from `@bluewave/campaign-engine`); every
   * field must be present with a weight from
   * `RESEARCH_FIELD_PRIORITY_WEIGHTS` ({1,2,4}) and 1..5 fields set to HIGH,
   * mirroring the engine's `SetResearchPriority` lifecycle validation.
   */
  readonly fieldPriorities: Readonly<Record<string, number>>;
  /** Exact-tech selection — the engine's lifecycle permanently prohibits it
   * (`EXACT_TECHNOLOGY_SELECTION_PROHIBITED`, `packages/commands/src/lifecycle.ts`),
   * so the handler rejects any command carrying it at issue time with that
   * exact engine code. The field is kept on the wire only to mirror the
   * engine's `SetResearchPriorityCommand` shape; the shipped UI never sends
   * it. */
  readonly exactTechId?: string;
}

/** The outcome of queueing a research priority command. `priorities` is the
 * frozen issue-time copy; the engine applies the envelope on the next
 * `commitMonth` (spec D1 — the desktop never mutates `nation.research`). */
export interface ResearchPriorityOutcome {
  readonly commandId: string;
  readonly priorities: Readonly<Record<string, number>>;
  readonly appliedOnNextTurn: true;
}
