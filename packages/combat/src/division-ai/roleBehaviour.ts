import type { DivisionAiDivision } from "./contracts.js";
import type { DivisionDraft, DivisionPlan, PlanContext } from "./plan.js";
import type { DivisionAiMode } from "./reasonCodes.js";

export interface RoleBehaviour {
  readonly modes: readonly DivisionAiMode[];
  readonly choose: (
    ctx: PlanContext,
    division: DivisionAiDivision,
    draft: DivisionDraft,
  ) => DivisionAiMode;
  readonly build: (
    ctx: PlanContext,
    division: DivisionAiDivision,
    draft: DivisionDraft,
    mode: DivisionAiMode,
  ) => DivisionPlan | null;
}
