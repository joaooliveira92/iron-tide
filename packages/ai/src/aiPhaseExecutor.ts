import type { CampaignSlot, CampaignSnapshot } from "@bluewave/campaign";
import type {
  CommandBody,
  CommandEnvelope,
  CommandIdempotencyMap,
  CommandLifecycle,
} from "@bluewave/commands";
import type { Diagnostic } from "@bluewave/diagnostics";
import type { RandomEngine } from "@bluewave/random";
import { AiPlanner } from "./aiPlanner.js";

export interface AiExecutionResult {
  readonly commands: readonly CommandEnvelope<CommandBody>[];
  readonly diagnostics: readonly Diagnostic[];
}

export class AiPhaseExecutor {
  private readonly planner: AiPlanner;

  constructor(planner: AiPlanner = new AiPlanner()) {
    this.planner = planner;
    Object.freeze(this);
  }

  run(
    slot: CampaignSlot,
    snapshot: CampaignSnapshot,
    engine: RandomEngine,
    lifecycle: CommandLifecycle,
    idempotencyMap: CommandIdempotencyMap,
    researchAllocation?: Readonly<Record<string, number>>,
  ): AiExecutionResult {
    try {
      const result = this.planner.generate(
        snapshot,
        engine,
        lifecycle,
        slot,
        idempotencyMap,
        researchAllocation,
      );
      return {
        commands: Object.freeze([...result.accepted]),
        diagnostics: Object.freeze([...result.diagnostics]),
      };
    } catch (e) {
      const diag: Diagnostic = {
        code: "AI_EXECUTOR_CRASH" as Diagnostic["code"],
        severity: "error",
        stage: "ai_planning",
        message: `AiPhaseExecutor crashed: ${e instanceof Error ? e.message : String(e)}`,
        entityId: (slot as { nationId?: string }).nationId ?? "unknown",
      };
      return { commands: [], diagnostics: [diag] };
    }
  }
}
