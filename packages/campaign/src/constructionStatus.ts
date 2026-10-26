import { Data, Result } from "effect";

export const CONSTRUCTION_PROJECT_STATUSES = [
  "PLANNED",
  "AUTHORIZED",
  "AWAITING_CAPACITY",
  "ACTIVE",
  "HALTED",
  "DELAYED",
  "ACCELERATED",
  "COMPLETED",
  "CANCELLED",
  "IMPOUNDED",
] as const;
export type ConstructionProjectStatus = (typeof CONSTRUCTION_PROJECT_STATUSES)[number];

export const TERMINAL_CONSTRUCTION_PROJECT_STATUSES: readonly ConstructionProjectStatus[] = [
  "COMPLETED",
  "CANCELLED",
];

export const isTerminalConstructionProjectStatus = (s: ConstructionProjectStatus): boolean =>
  TERMINAL_CONSTRUCTION_PROJECT_STATUSES.includes(s);

export type ConstructionProjectKind = "NEW_CONSTRUCTION" | "REBUILD" | "INFRASTRUCTURE";

export const CONSTRUCTION_ACCELERATION_ALLOWED: Readonly<Record<ConstructionProjectKind, boolean>> =
  {
    NEW_CONSTRUCTION: true,
    REBUILD: false,
    INFRASTRUCTURE: false,
  };

export function constructionAccelerationAllowed(projectType: ConstructionProjectKind): boolean {
  return CONSTRUCTION_ACCELERATION_ALLOWED[projectType] === true;
}

export const CONSTRUCTION_PROJECT_TRANSITIONS: Readonly<
  Record<ConstructionProjectStatus, readonly ConstructionProjectStatus[]>
> = {
  PLANNED: ["AUTHORIZED", "AWAITING_CAPACITY", "ACTIVE", "COMPLETED", "CANCELLED"],
  AUTHORIZED: ["AWAITING_CAPACITY", "ACTIVE", "HALTED", "DELAYED", "COMPLETED", "CANCELLED"],
  AWAITING_CAPACITY: ["ACTIVE", "HALTED", "DELAYED", "COMPLETED", "CANCELLED"],
  ACTIVE: [
    "AWAITING_CAPACITY",
    "HALTED",
    "DELAYED",
    "ACCELERATED",
    "COMPLETED",
    "CANCELLED",
    "IMPOUNDED",
  ],
  HALTED: ["AWAITING_CAPACITY", "ACTIVE", "DELAYED", "COMPLETED", "CANCELLED", "IMPOUNDED"],
  DELAYED: ["AWAITING_CAPACITY", "ACTIVE", "HALTED", "COMPLETED", "CANCELLED", "IMPOUNDED"],
  ACCELERATED: [
    "AWAITING_CAPACITY",
    "ACTIVE",
    "HALTED",
    "DELAYED",
    "COMPLETED",
    "CANCELLED",
    "IMPOUNDED",
  ],
  IMPOUNDED: ["ACTIVE", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionConstructionProject(
  from: ConstructionProjectStatus,
  to: ConstructionProjectStatus,
): boolean {
  return CONSTRUCTION_PROJECT_TRANSITIONS[from].includes(to);
}

export const INVALID_DOCKYARD_PROJECT_TRANSITION = "INVALID_DOCKYARD_PROJECT_TRANSITION" as const;

export class ConstructionProjectTransitionError extends Data.TaggedError(
  "ConstructionProjectTransitionError",
)<{
  readonly from: ConstructionProjectStatus;
  readonly to: ConstructionProjectStatus;
}> {
  readonly code = INVALID_DOCKYARD_PROJECT_TRANSITION;

  override get message(): string {
    return `Illegal dockyard project transition ${this.from} -> ${this.to}`;
  }
}

export function checkConstructionProjectTransition(
  from: ConstructionProjectStatus,
  to: ConstructionProjectStatus,
): Result.Result<void, ConstructionProjectTransitionError> {
  return canTransitionConstructionProject(from, to)
    ? Result.succeed(undefined)
    : Result.fail(new ConstructionProjectTransitionError({ from, to }));
}

export function assertConstructionProjectTransition(
  from: ConstructionProjectStatus,
  to: ConstructionProjectStatus,
): void {
  const checked = checkConstructionProjectTransition(from, to);
  if (Result.isFailure(checked)) throw checked.failure;
}

export function nextConstructionProjectStatus(
  from: ConstructionProjectStatus,
  to: ConstructionProjectStatus,
): ConstructionProjectStatus | undefined {
  if (from === to) return undefined;
  assertConstructionProjectTransition(from, to);
  return to;
}

export function transitionConstructionProject<
  T extends { readonly status: ConstructionProjectStatus },
>(project: T, to: ConstructionProjectStatus): T {
  const next = nextConstructionProjectStatus(project.status, to);
  return next === undefined ? project : { ...project, status: next };
}

export function tryTransitionConstructionProject<
  T extends { readonly status: ConstructionProjectStatus },
>(project: T, to: ConstructionProjectStatus): Result.Result<T, ConstructionProjectTransitionError> {
  if (project.status === to) return Result.succeed(project);
  const checked = checkConstructionProjectTransition(project.status, to);
  if (Result.isFailure(checked)) return Result.fail(checked.failure);
  return Result.succeed({ ...project, status: to });
}
