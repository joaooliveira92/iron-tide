// DESIGN-23 section 2: the one authoritative dockyard-project status vocabulary and its legal transition table.
// Pure and dependency-free; every status change in the phase engine goes through `transitionConstructionProject`,
// so halt, delay, acceleration, completion and impoundment cannot invent a state the model does not allow.
// ADR-0129 records the model, its table and the save-compatibility consequence.

/** Exactly the DESIGN-23 section 2 statuses. */
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

/** `COMPLETED` and `CANCELLED` are terminal; `IMPOUNDED` is non-terminal until custody and title resolve. */
export const TERMINAL_CONSTRUCTION_PROJECT_STATUSES: readonly ConstructionProjectStatus[] = [
  "COMPLETED",
  "CANCELLED",
];

export const isTerminalConstructionProjectStatus = (s: ConstructionProjectStatus): boolean =>
  TERMINAL_CONSTRUCTION_PROJECT_STATUSES.includes(s);

/** The dockyard project kinds DESIGN-23 section 1 distinguishes (`ConstructionProject.projectType`). */
export type ConstructionProjectKind = "NEW_CONSTRUCTION" | "REBUILD" | "INFRASTRUCTURE";

/**
 * DESIGN-13 section 11.3 / DESIGN-23 section 8: whether a project type declares `accelerationAllowed: true`. The
 * shipped policy allows new construction only; a rebuild has its own retained-hull rules and the manual's
 * acceleration is a new-build mechanic. Versioned here, so the command validator and the phase engine share it.
 */
export const CONSTRUCTION_ACCELERATION_ALLOWED: Readonly<Record<ConstructionProjectKind, boolean>> =
  {
    NEW_CONSTRUCTION: true,
    REBUILD: false,
    INFRASTRUCTURE: false,
  };

/** Whether a project kind may be accelerated (DESIGN-13 section 11.3 `accelerationAllowed`). */
export function constructionAccelerationAllowed(projectType: ConstructionProjectKind): boolean {
  return CONSTRUCTION_ACCELERATION_ALLOWED[projectType] === true;
}

/**
 * The legal transition table, keyed by the current status. `PLANNED -> ACTIVE` is retained because a queued project
 * funded before an explicit authorization step still activates (the authorization gate arrives with the batch order).
 * `IMPOUNDED` can return to `ACTIVE` (custody released) or reach a terminal status.
 */
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

/** Whether `from -> to` is a legal transition. A transition to the same status is not a transition and is rejected. */
export function canTransitionConstructionProject(
  from: ConstructionProjectStatus,
  to: ConstructionProjectStatus,
): boolean {
  return CONSTRUCTION_PROJECT_TRANSITIONS[from].includes(to);
}

/** The stable code an illegal transition fails with (DESIGN-23 section 32). */
export const INVALID_DOCKYARD_PROJECT_TRANSITION = "INVALID_DOCKYARD_PROJECT_TRANSITION" as const;

export class ConstructionProjectTransitionError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "ConstructionProjectTransitionError";
  /** `_tag`-based narrowing without `instanceof`. */
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

/** Throws `ConstructionProjectTransitionError` unless `from -> to` is legal. */
export function assertConstructionProjectTransition(
  from: ConstructionProjectStatus,
  to: ConstructionProjectStatus,
): void {
  if (!canTransitionConstructionProject(from, to)) {
    throw new ConstructionProjectTransitionError(from, to);
  }
}

/** The status change, or `undefined` when `to` equals the current status (a no-op is not a transition). */
export function nextConstructionProjectStatus(
  from: ConstructionProjectStatus,
  to: ConstructionProjectStatus,
): ConstructionProjectStatus | undefined {
  if (from === to) return undefined;
  assertConstructionProjectTransition(from, to);
  return to;
}

/**
 * Move a project to `to`, asserting the transition. Equal status returns the same object unchanged (no-op), so a
 * no-work funding pass does not fail. Pure; the caller keeps its own immutable update.
 */
export function transitionConstructionProject<
  T extends { readonly status: ConstructionProjectStatus },
>(project: T, to: ConstructionProjectStatus): T {
  const next = nextConstructionProjectStatus(project.status, to);
  return next === undefined ? project : { ...project, status: next };
}
