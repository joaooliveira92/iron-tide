import {
  buildProgressOf,
  changeKindsOf,
  classifyRevision,
  type BuildProgress,
  type ChangeKind,
  type ComponentCategory,
  type ConstructionPlan,
  type DesignDraft,
  type DraftEdit,
  type LineId,
  type PackageKind,
  type RevisionBalance,
  type RevisionDecision,
  type WorkPackage,
  LINE_IDS,
  PACKAGE_ORDER,
} from "@bluewave/ship-design";

export interface RevisionProject {
  readonly projectId: string;
  readonly className: string;
  readonly status: string;
  readonly totalWork: number;
  readonly completedWork: number;
  readonly revisable?: boolean;
  readonly holdUntilMonth?: string | null;
  readonly packages?: readonly RevisionPackage[];
}

export interface RevisionPackage {
  readonly id: string;
  readonly kind: string;
  readonly line: string;
  readonly totalWork: number;
  readonly doneWork: number;
  readonly dependsOn: readonly string[];
}

export const revisableProjects = (projects: readonly RevisionProject[]): RevisionProject[] =>
  projects.filter((p) => p.status !== "COMPLETED");

const isPackageKind = (k: string): k is PackageKind =>
  (PACKAGE_ORDER as readonly string[]).includes(k);
const isLine = (l: string): l is LineId => (LINE_IDS as readonly string[]).includes(l);

function packagePlan(
  p: RevisionProject,
): { plan: ConstructionPlan; progress: Record<string, number> } | undefined {
  if (p.packages === undefined) return undefined;
  const list: WorkPackage[] = [];
  for (const pk of p.packages) {
    if (!isPackageKind(pk.kind) || !isLine(pk.line)) return undefined;
    list.push({
      id: pk.id,
      kind: pk.kind,
      line: pk.line,
      totalWork: pk.totalWork,
      dependsOn: [...pk.dependsOn],
    });
  }
  return {
    plan: { packages: list, totalWork: list.reduce((a, x) => a + x.totalWork, 0) },
    progress: Object.fromEntries(p.packages.map((pk) => [pk.id, pk.doneWork])),
  };
}

export const progressOf = (p: RevisionProject): BuildProgress => {
  const real = packagePlan(p);
  if (real) return buildProgressOf(real.plan, real.progress);
  return {
    hullDoneWork: p.completedWork,
    hullTotalWork: p.totalWork,
    armourStarted: false,
    machineryStarted: false,
    launched: false,
    affectedDoneWork: p.completedWork,
  };
};

export function changeKinds(
  edits: readonly DraftEdit[],
  start: DesignDraft,
  current: DesignDraft,
  categoryOfComponent: (componentId: string) => ComponentCategory | undefined,
): ChangeKind[] {
  const placed = new Map<string, string>();
  for (const pl of [...start.placements, ...current.placements])
    placed.set(pl.instanceId, pl.componentId);
  const categoryOf = (instanceId: string) => {
    const cid = placed.get(instanceId);
    return cid === undefined ? undefined : categoryOfComponent(cid);
  };
  const order: ChangeKind[] = ["FITTINGS", "MAIN_ARMAMENT", "ARMOUR", "MACHINERY", "STRUCTURE"];
  const kinds = new Set(edits.flatMap((e) => changeKindsOf(e, categoryOf)));
  return order.filter((k) => kinds.has(k));
}

export function previewRevision(
  kinds: readonly ChangeKind[],
  project: RevisionProject,
  balance: RevisionBalance,
): RevisionDecision | null {
  return kinds.length === 0 ? null : classifyRevision(kinds, progressOf(project), balance);
}

export const TIER_LABEL: Record<RevisionDecision["tier"], string> = {
  T0_FREE: "Free change",
  T1_REVISION: "Revision",
  T2_REDESIGN: "Redesign",
  T3_RECONSTRUCTION: "Reconstruction",
};

export const REASON_TEXT: Record<string, string> = {
  REVISION_PROGRESS_T1_REVISION: "Hull work has passed the free-change window.",
  REVISION_PROGRESS_T2_REDESIGN: "Hull work is far enough along that changes mean a redesign.",
  REVISION_PROGRESS_T3_RECONSTRUCTION: "Too much hull work is done for a revision.",
  REVISION_ESCALATED_STRUCTURAL:
    "The change touches structure, machinery, main armament or armour, which escalates a revision to a redesign.",
  REVISION_COMPONENT_ORDERED: "Armour or machinery has already been ordered.",
  REVISION_HULL_GEOMETRY: "Hull geometry cannot change after work has started without a redesign.",
  REVISION_AFTER_LAUNCH: "The ship is launched.",
};
