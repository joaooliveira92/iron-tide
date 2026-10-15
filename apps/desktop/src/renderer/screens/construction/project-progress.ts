import type {
  ConstructionProjectQueueEntry,
  ConstructionProjectReadoutView,
} from "@bluewave/campaign-engine";

export type PackageState = "done" | "active" | "ready" | "waiting";

export interface PackageRow {
  readonly id: string;
  readonly label: string;
  /** 0..100, whole percent of this package's work done. */
  readonly percent: number;
  readonly state: PackageState;
}

export interface ProjectRow {
  readonly projectId: string;
  readonly className: string;
  readonly status: ConstructionProjectQueueEntry["status"];
  /** 0..100 of the project's total work. */
  readonly percent: number;
  /** Display name of the yard, or null when none was chosen (authored starts and one-figure projects). */
  readonly yard: string | null;
  /** Packages with work, in plan order; empty for a project with one figure. */
  readonly packages: readonly PackageRow[];
  readonly holdUntilMonth: string | null;
  /** True when the project is a foreign construction contract (DESIGN-16 section 13); it cannot be accelerated. */
  readonly isForeign: boolean;
  /**
   * The compiled engine readout (SB3-R31), or `null` when the projection carried none. The UI renders these verbatim
   * and authors no figure of its own; `null` shows an honest "unavailable", never a fabricated zero/complete.
   */
  readonly readout: ConstructionProjectReadoutView | null;
}

const PACKAGE_LABEL: Readonly<Record<string, string>> = {
  HULL: "Hull",
  MACHINERY: "Machinery",
  ARMOUR: "Armour",
  ORDNANCE: "Ordnance",
  LAUNCH: "Launch",
  FIT_OUT: "Fit-out",
  TRIALS: "Sea trials",
  ACCEPTANCE: "Acceptance",
};

const words = (id: string) => id.replaceAll("_", " ");
const percentOf = (done: number, total: number) =>
  total <= 0 ? 0 : Math.max(0, Math.min(100, Math.floor((done * 100) / total)));

/**
 * What the Shipyard Ledger shows for a project: overall progress, the yard, and each package's state (done, in progress,
 * ready to start because everything it depends on is done, or waiting on something). A package with no work (a very small
 * ship) is left out, as it has nothing to show. Pure; every number is the engine's own.
 */
export function projectRow(entry: ConstructionProjectQueueEntry): ProjectRow {
  const byId = new Map((entry.packages ?? []).map((p) => [p.id, p]));
  const complete = (id: string, seen: ReadonlySet<string> = new Set()): boolean => {
    const p = byId.get(id);
    if (p === undefined || seen.has(id)) return false;
    return (
      p.doneWork >= p.totalWork && p.dependsOn.every((d) => complete(d, new Set([...seen, id])))
    );
  };
  const packages: PackageRow[] = (entry.packages ?? [])
    .filter((p) => p.totalWork > 0)
    .map((p) => {
      const done = p.doneWork >= p.totalWork;
      const ready = p.dependsOn.every((d) => complete(d));
      return {
        id: p.id,
        label: PACKAGE_LABEL[p.kind] ?? words(p.kind.toLowerCase()),
        percent: percentOf(p.doneWork, p.totalWork),
        state: done ? "done" : p.doneWork > 0 ? "active" : ready ? "ready" : "waiting",
      };
    });
  return {
    projectId: entry.projectId,
    className: entry.className,
    status: entry.status,
    percent: percentOf(entry.completedWork, entry.totalWork),
    yard: entry.yardId === undefined ? null : words(entry.yardId),
    packages,
    holdUntilMonth: entry.holdUntilMonth,
    isForeign: entry.isForeign,
    readout: entry.readout ?? null,
  };
}

/** Rows for every project, unfinished first (then by id), the order the ledger lists them. */
export function projectRows(entries: readonly ConstructionProjectQueueEntry[]): ProjectRow[] {
  return entries
    .map(projectRow)
    .sort(
      (a, b) =>
        Number(a.status === "COMPLETED") - Number(b.status === "COMPLETED") ||
        (a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0),
    );
}
