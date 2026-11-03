import type {
  ConstructionProjectQueueEntry,
  ConstructionProjectReadoutView,
} from "@bluewave/campaign-engine";

export type PackageState = "done" | "active" | "ready" | "waiting";

export interface PackageRow {
  readonly id: string;
  readonly label: string;
  readonly percent: number;
  readonly state: PackageState;
  readonly dependsOn: readonly string[];
}

export interface ProjectRow {
  readonly projectId: string;
  readonly className: string;
  readonly shipType: string;
  readonly status: ConstructionProjectQueueEntry["status"];
  readonly percent: number;
  readonly yard: string | null;
  readonly packages: readonly PackageRow[];
  readonly holdUntilMonth: string | null;
  readonly isForeign: boolean;
  readonly revisable: boolean;
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
const packageLabel = (kind: string) => PACKAGE_LABEL[kind] ?? words(kind.toLowerCase());
const percentOf = (done: number, total: number) =>
  total <= 0 ? 0 : Math.max(0, Math.min(100, Math.floor((done * 100) / total)));

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
        label: packageLabel(p.kind),
        percent: percentOf(p.doneWork, p.totalWork),
        state: done ? "done" : p.doneWork > 0 ? "active" : ready ? "ready" : "waiting",
        dependsOn: p.dependsOn.map((d) => packageLabel(byId.get(d)?.kind ?? d)),
      };
    });
  return {
    projectId: entry.projectId,
    className: entry.className,
    shipType: entry.shipType,
    status: entry.status,
    percent: percentOf(entry.completedWork, entry.totalWork),
    yard: entry.yardId === undefined ? null : words(entry.yardId),
    packages,
    holdUntilMonth: entry.holdUntilMonth,
    isForeign: entry.isForeign,
    revisable: entry.revisable,
    readout: entry.readout ?? null,
  };
}

export function projectRows(entries: readonly ConstructionProjectQueueEntry[]): ProjectRow[] {
  return entries
    .map(projectRow)
    .sort(
      (a, b) =>
        Number(a.status === "COMPLETED") - Number(b.status === "COMPLETED") ||
        (a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0),
    );
}
