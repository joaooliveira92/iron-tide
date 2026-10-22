import type { CampaignSlot, CampaignSnapshot, NationState } from "@bluewave/campaign";
import type {
  CommandBody,
  CommandEnvelope,
  CommandIdempotencyMap,
  CommandLifecycle,
} from "@bluewave/commands";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { Diagnostic } from "@bluewave/diagnostics";
import type { RandomEngine } from "@bluewave/random";
import { drawUniform } from "@bluewave/random";
import {
  AI_COMMAND_TYPE_BUDGET,
  AI_COMMAND_TYPE_RESEARCH,
  AiCommandGenerator,
} from "./aiCommandGenerator.js";
import { AiError } from "./errors.js";

export const AI_RNG_STREAM_PREFIX = "ai/planning:" as const;

export interface AiPlanningResult {
  readonly envelopes: readonly CommandEnvelope<CommandBody>[];
  readonly accepted: readonly CommandEnvelope<CommandBody>[];
  readonly diagnostics: readonly Diagnostic[];
}

function assertSafeInt(n: unknown): number {
  if (typeof n !== "number" || !SafeInt.isSafeInt(n)) {
    throw new AiError({ message: "Not SafeInt" });
  }
  return n;
}

function safeSub(a: SafeInt, b: SafeInt): SafeInt {
  const r = a - b;
  if (!SafeInt.isSafeInt(r)) throw new AiError({ message: `SafeInt overflow sub` });
  return r;
}

function safeMin(a: SafeInt, b: SafeInt): SafeInt {
  return a <= b ? a : b;
}

function encodeStreamPart(s: string): string {
  return encodeURIComponent(s);
}

export class AiPlanner {
  generate(
    snapshot: CampaignSnapshot,
    engine: RandomEngine,
    lifecycle: CommandLifecycle,
    slot: CampaignSlot,
    idempotencyMap: CommandIdempotencyMap,
    researchAllocation?: Readonly<Record<string, number>>,
  ): AiPlanningResult {
    const envelopes: CommandEnvelope<CommandBody>[] = [];
    const accepted: CommandEnvelope<CommandBody>[] = [];
    const diagnostics: Diagnostic[] = [];

    const slotType = (slot as { type?: string }).type;
    if (
      slotType !== undefined &&
      slotType !== "AI" &&
      (slot as unknown as { controller?: string }).controller !== "AI"
    ) {
      if (slotType === "HUMAN" || slotType === "PLAYER") {
        return { envelopes, accepted, diagnostics };
      }
    }

    const nationId = (slot as { nationId: string }).nationId;
    if (typeof nationId !== "string" || nationId.length === 0) {
      diagnostics.push({
        code: "AI_SLOT_INVALID" as Diagnostic["code"],
        severity: "error",
        stage: "ai_planning",
        message: `Invalid slot.nationId`,
        entityId: String(nationId),
      });
      return { envelopes, accepted, diagnostics };
    }

    const nations = (snapshot as unknown as { nations: Map<string, NationState> }).nations;
    if (!(nations instanceof Map)) {
      diagnostics.push({
        code: "AI_SNAPSHOT_INVALID" as Diagnostic["code"],
        severity: "error",
        stage: "ai_planning",
        message: `Snapshot nations is not a Map`,
        entityId: nationId,
      });
      return { envelopes, accepted, diagnostics };
    }

    const nation = nations.get(nationId);
    if (!nation) {
      diagnostics.push({
        code: "AI_NATION_MISSING" as Diagnostic["code"],
        severity: "error",
        stage: "ai_planning",
        message: `Nation ${nationId} not found for AI planning`,
        entityId: nationId,
      });
      return { envelopes, accepted, diagnostics };
    }

    let generator: AiCommandGenerator;
    try {
      generator = new AiCommandGenerator({
        campaignId: snapshot.campaignId,
        turnNumber: snapshot.turnNumber,
        expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
      });
    } catch (e) {
      diagnostics.push({
        code: "AI_HASH_FAILED" as Diagnostic["code"],
        severity: "error",
        stage: "ai_planning",
        message: `Failed to hash snapshot: ${e instanceof Error ? e.message : String(e)}`,
        entityId: nationId,
      });
      return { envelopes, accepted, diagnostics };
    }

    try {
      const budgetCommand = this.buildBudgetCommand(nationId, nation, engine, generator);
      if (budgetCommand) {
        envelopes.push(budgetCommand);
        const outcome = lifecycle.process(budgetCommand, snapshot, slot, idempotencyMap);
        if (outcome.type === "success") {
          accepted.push(budgetCommand);
        } else {
          const diag = (outcome as { diagnostic?: Diagnostic }).diagnostic;
          if (diag) diagnostics.push(diag);
          else
            diagnostics.push({
              code: "AI_UNKNOWN_REJECTION" as Diagnostic["code"],
              severity: "error",
              stage: "ai_planning",
              message: `Budget command rejected without diagnostic: ${outcome.type}`,
              entityId: nationId,
            });
        }
      }
    } catch (e) {
      diagnostics.push({
        code: "AI_BUDGET_FAILED" as Diagnostic["code"],
        severity: "error",
        stage: "ai_planning",
        message: `Budget planning failed: ${e instanceof Error ? e.message : String(e)}`,
        entityId: nationId,
      });
    }

    try {
      const researchCommand = this.buildResearchPriorityCommand(
        nationId,
        engine,
        generator,
        researchAllocation,
      );
      if (researchCommand) {
        envelopes.push(researchCommand);
        const outcome = lifecycle.process(researchCommand, snapshot, slot, idempotencyMap);
        if (outcome.type === "success") {
          accepted.push(researchCommand);
        } else {
          const diag = (outcome as { diagnostic?: Diagnostic }).diagnostic;
          if (diag) diagnostics.push(diag);
          else
            diagnostics.push({
              code: "AI_UNKNOWN_REJECTION" as Diagnostic["code"],
              severity: "error",
              stage: "ai_planning",
              message: `Research command rejected without diagnostic: ${outcome.type}`,
              entityId: nationId,
            });
        }
      }
    } catch (e) {
      diagnostics.push({
        code: "AI_RESEARCH_FAILED" as Diagnostic["code"],
        severity: "error",
        stage: "ai_planning",
        message: `Research planning failed: ${e instanceof Error ? e.message : String(e)}`,
        entityId: nationId,
      });
    }

    return { envelopes, accepted, diagnostics };
  }

  private buildBudgetCommand(
    nationId: string,
    nation: NationState,
    engine: RandomEngine,
    generator: AiCommandGenerator,
  ): CommandEnvelope<CommandBody> | undefined {
    const projects = (nation as { constructionProjects?: unknown }).constructionProjects;
    if (!Array.isArray(projects)) return undefined;

    const treasury = (nation as { treasury: SafeInt }).treasury;
    let treasuryNum: number;
    try {
      treasuryNum = treasury;
    } catch {
      return undefined;
    }
    if (!Number.isSafeInteger(treasuryNum) || treasuryNum < 0) return undefined;
    if (treasuryNum < 1) return undefined;

    const legal: Array<{ projectId: string; maxAmount: SafeInt }> = [];
    for (const p of projects) {
      const proj = p as {
        id?: unknown;
        status?: unknown;
        totalWork?: unknown;
        completedWork?: unknown;
      };
      if (typeof proj.id !== "string" || proj.id.length === 0) continue;
      if (proj.status === "COMPLETED") continue;
      try {
        const totalWork = proj.totalWork as SafeInt;
        const completedWork = proj.completedWork as SafeInt;
        assertSafeInt(totalWork);
        assertSafeInt(completedWork);
        const remainingWork = safeSub(totalWork, completedWork);
        if (remainingWork <= 0) continue;
        const maxAmount = safeMin(treasury, remainingWork);
        if (maxAmount < 1) continue;
        legal.push({ projectId: proj.id, maxAmount });
      } catch {
        continue;
      }
    }

    if (legal.length === 0) return undefined;

    legal.sort((a, b) => (a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0));

    let stream: ReturnType<RandomEngine["stream"]>;
    try {
      stream = engine.stream(
        `${AI_RNG_STREAM_PREFIX}${encodeStreamPart(nationId)}:${AI_COMMAND_TYPE_BUDGET}`,
      );
    } catch {
      return undefined;
    }

    const indexSafe = drawUniform(stream, SafeInt.ZERO, SafeInt(legal.length - 1));
    const index = indexSafe;
    const chosen = legal[index];
    if (!chosen) return undefined;

    const amount = drawUniform(stream, SafeInt.ONE, chosen.maxAmount);
    return generator.buildBudgetCommand(nationId, chosen.projectId, amount);
  }

  private buildResearchPriorityCommand(
    nationId: string,
    engine: RandomEngine,
    generator: AiCommandGenerator,
    allocation?: Readonly<Record<string, number>>,
  ): CommandEnvelope<CommandBody> | undefined {
    const fields = CANONICAL_RESEARCH_FIELD_IDS;
    if (allocation !== undefined) {
      const priorities: Record<string, SafeInt> = {};
      let complete = true;
      for (const field of fields) {
        const v = allocation[field];
        if (v !== 1 && v !== 2 && v !== 4) {
          complete = false;
          break;
        }
        priorities[field] = SafeInt(v);
      }
      if (complete) return generator.buildResearchPriorityCommand(nationId, priorities);
    }
    const n = fields.length;
    const maxHighClamped = Math.max(1, Math.min(MAX_HIGH_PRIORITY_FIELDS, n));

    let stream: ReturnType<RandomEngine["stream"]>;
    try {
      stream = engine.stream(
        `${AI_RNG_STREAM_PREFIX}${encodeStreamPart(nationId)}:${AI_COMMAND_TYPE_RESEARCH}`,
      );
    } catch {
      return undefined;
    }

    const highCountSafe = drawUniform(stream, SafeInt.ONE, SafeInt(maxHighClamped));
    const highCount = highCountSafe;

    const shuffled: string[] = [...fields];
    for (let i = 0; i < highCount; i++) {
      const jSafe = drawUniform(stream, SafeInt(i), SafeInt(n - 1));
      const j = jSafe;
      const tmp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = tmp;
    }
    const highSet = new Set(shuffled.slice(0, highCount));

    const fieldPriorities: Record<string, SafeInt> = {};
    for (const field of fields) {
      fieldPriorities[field] = highSet.has(field)
        ? SafeInt(RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH)
        : SafeInt(RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM);
    }

    return generator.buildResearchPriorityCommand(nationId, fieldPriorities);
  }
}
