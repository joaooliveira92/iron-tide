import type {
  CommitmentReadiness,
  ConstructionCommitment,
  FleetUpkeep,
} from "../../../shared/budget-contract.js";

export interface ReadinessStyle {
  readonly label: string;
  readonly className: string;
  readonly description: string;
}

export const READINESS_STYLE: Readonly<Record<CommitmentReadiness, ReadinessStyle>> = {
  ACTIVE: {
    label: "Active",
    className: "bg-primary",
    description: "Crewed and ready for sea. Pays the full rate, and a war surcharge on top.",
  },
  WORKING_UP: {
    label: "Working up",
    className: "bg-primary/60",
    description: "Crews training toward full readiness. Pays the full rate.",
  },
  RESERVE: {
    label: "Reserve",
    className: "bg-warning",
    description: "Held in reserve with a reduced crew. Cheaper than active service.",
  },
  MOTHBALLED: {
    label: "Mothballed",
    className: "bg-muted-foreground/60",
    description: "Laid up with a minimal crew. The cheapest way to keep a hull.",
  },
  REPAIR: {
    label: "In repair",
    className: "bg-destructive",
    description: "In the yard under repair. Costs more than any other state.",
  },
};

export interface UpkeepSegment {
  readonly readiness: CommitmentReadiness;
  readonly label: string;
  readonly className: string;
  readonly description: string;
  readonly ships: number;
  readonly cost: number;
  readonly multiplier: number;
  readonly shareOfUpkeep: number;
}

export function upkeepSegments(fleet: FleetUpkeep): readonly UpkeepSegment[] {
  return fleet.groups
    .filter((group) => group.ships > 0)
    .map((group) => ({
      readiness: group.readiness,
      ...READINESS_STYLE[group.readiness],
      ships: group.ships,
      cost: group.cost,
      multiplier: group.multiplierBp / 10_000,
      shareOfUpkeep: fleet.total > 0 ? group.cost / fleet.total : 0,
    }));
}

export interface ProjectStatusStyle {
  readonly label: string;
  readonly tone: "neutral" | "warn" | "bad" | "good";
}

const STATUS_STYLE: Readonly<Record<string, ProjectStatusStyle>> = {
  PLANNED: { label: "Planned", tone: "neutral" },
  AUTHORIZED: { label: "Authorized", tone: "neutral" },
  AWAITING_CAPACITY: { label: "Awaiting capacity", tone: "warn" },
  ACTIVE: { label: "Building", tone: "good" },
  ACCELERATED: { label: "Accelerated", tone: "warn" },
  DELAYED: { label: "Delayed", tone: "warn" },
  HALTED: { label: "Halted", tone: "bad" },
  IMPOUNDED: { label: "Impounded", tone: "bad" },
};

export function projectStatusStyle(status: string): ProjectStatusStyle {
  return STATUS_STYLE[status] ?? { label: status, tone: "neutral" };
}

export interface ProjectRow extends ConstructionCommitment {
  readonly style: ProjectStatusStyle;
  readonly monthlyCost: number;
}

export function projectRows(projects: readonly ConstructionCommitment[]): readonly ProjectRow[] {
  return projects
    .map((project) => ({
      ...project,
      style: projectStatusStyle(project.status),
      monthlyCost: project.draw + project.carryingCost,
    }))
    .sort(
      (a, b) =>
        b.monthlyCost - a.monthlyCost ||
        (a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0),
    );
}

export function shareOf(part: number, whole: number): number {
  return whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
}
