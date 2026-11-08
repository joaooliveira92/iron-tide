import { NEAR_COMPLETION_WORK_RATIO } from "@bluewave/campaign-engine";
import type {
  ConstructionCommandOutcome,
  ConstructionCommandQueuedOutcome,
  ConstructionScreenProjection,
} from "../../../shared/construction-contract.js";
import type { RequestLifecycle } from "../../lib/command-screen-workflow.js";
import { commandNotice } from "../../lib/command-screen-workflow.js";

export interface ConstructionScreenState extends RequestLifecycle {
  readonly month: ConstructionScreenProjection["month"] | null;
  readonly economy: ConstructionScreenProjection["economy"] | null;
  readonly designs: ConstructionScreenProjection["designs"];
  readonly projects: ConstructionScreenProjection["projects"];
  readonly steering: ConstructionScreenProjection["steering"];
  readonly workspace: ConstructionScreenProjection["workspace"] | null;
}

export function initialConstructionScreenState(): ConstructionScreenState {
  return {
    revision: 0,
    month: null,
    economy: null,
    designs: [],
    projects: [],
    steering: {},
    workspace: null,
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

export function projectConstructionScreen(
  projection: ConstructionScreenProjection,
): Partial<ConstructionScreenState> {
  return {
    month: projection.month,
    economy: projection.economy,
    designs: projection.designs,
    projects: projection.projects,
    steering: projection.steering,
    workspace: projection.workspace,
  };
}

export function acceptConstructionCommand(
  value: ConstructionCommandOutcome | ConstructionCommandQueuedOutcome,
): {
  readonly patch: Partial<ConstructionScreenState>;
  readonly notice: string;
} {
  if ("workspace" in value) {
    return { patch: { workspace: value.workspace }, notice: commandNotice(value.command) };
  }
  return {
    patch: {},
    notice: `${value.bodyType} queued; it applies when you advance the month.`,
  };
}

export function nextDesignSelection(
  current: string | null,
  designs: readonly { readonly designId: string }[],
): string | null {
  if (current !== null && designs.some((design) => design.designId === current)) {
    return current;
  }
  return designs[0]?.designId ?? null;
}

export function activeConstructionProjects<T extends { readonly status: string }>(
  projects: readonly T[],
): readonly T[] {
  return projects.filter((project) => project.status !== "COMPLETED");
}

export function expectedConstructionCompletions(
  projects: readonly {
    readonly status: string;
    readonly totalWork: number;
    readonly completedWork: number;
  }[],
): number {
  return activeConstructionProjects(projects).filter((project) => {
    const total = project.totalWork;
    return total > 0 && project.completedWork / total >= NEAR_COMPLETION_WORK_RATIO;
  }).length;
}
