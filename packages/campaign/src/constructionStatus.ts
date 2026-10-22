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

export class ConstructionProjectTransitionError extends Error {
  readonly _tag = "ConstructionProjectTransitionError";
  static is(value: unknown): value is ConstructionProjectTransitionError {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { readonly _tag?: unknown })._tag === "ConstructionProjectTransitionError"
    );
  }
  readonly code = INVALID_DOCKYARD_PROJECT_TRANSITION;
  constructor(
    readonly from: ConstructionProjectStatus,
    readonly to: ConstructionProjectStatus,
  ) {
    super(`Illegal dockyard project transition ${from} -> ${to}`);
    this.name = "ConstructionProjectTransitionError";
  }
}

export function assertConstructionProjectTransition(
  from: ConstructionProjectStatus,
  to: ConstructionProjectStatus,
): void {
  if (!canTransitionConstructionProject(from, to)) {
    throw new ConstructionProjectTransitionError(from, to);
  }
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
