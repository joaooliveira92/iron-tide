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

/** The slice of an engine construction project the preview needs (work figures are engine numbers). */
export interface RevisionProject {
  readonly projectId: string;
  readonly className: string;
  readonly status: string;
  readonly totalWork: number;
  readonly completedWork: number;
  /** True when the engine kept the project's source draft, so a revision can be applied to it (ADR-0070). */
  readonly revisable?: boolean;
  /** First month the project may be funded again after an earlier revision, if it is on hold. */
  readonly holdUntilMonth?: string | null;
  /** Per-package progress (ADR-0077); absent for a project with one work figure. */
  readonly packages?: readonly RevisionPackage[];
}

/** One work package of a project, as the engine reports it. */
export interface RevisionPackage {
  readonly id: string;
  readonly kind: string;
  readonly line: string;
  readonly totalWork: number;
  readonly doneWork: number;
  readonly dependsOn: readonly string[];
}

/** Only unfinished projects can be revised. */
export const revisableProjects = (projects: readonly RevisionProject[]): RevisionProject[] =>
  projects.filter((p) => p.status !== "COMPLETED");

const isPackageKind = (k: string): k is PackageKind =>
  (PACKAGE_ORDER as readonly string[]).includes(k);
const isLine = (l: string): l is LineId => (LINE_IDS as readonly string[]).includes(l);

/** The project's packages as a ship-design plan and progress, or undefined when it has none or one is not recognised. */
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

/**
 * Progress for the classifier, read the same way the engine reads it. A project with work packages (ADR-0077) is judged on
 * its real state: hull progress, whether armour or machinery work has started, whether the ship is launched. A project with
 * one work figure keeps the conservative reading of that figure: hull progress is the ratio, armour and machinery are
 * treated as not started and the ship as not launched, and rework is measured against all completed work.
 */
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

/** The distinct kinds of change the applied edits make, in a stable order. */
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

/** What these edits would cost if applied to this project today. Null when nothing changed. Pure. */
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
