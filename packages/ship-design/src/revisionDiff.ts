import type { ComponentCategory } from "./component.js";
import type { DesignDraft } from "./compileShared.js";
import { STRUCTURE_KEYS, type BuildProgress, type ChangeKind } from "./revision.js";

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const keysDiffering = (a: object, b: object): string[] => {
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return [...new Set([...Object.keys(ra), ...Object.keys(rb)])].filter((k) => !same(ra[k], rb[k]));
};

const ORDER: readonly ChangeKind[] = [
  "FITTINGS",
  "MAIN_ARMAMENT",
  "ARMOUR",
  "MACHINERY",
  "STRUCTURE",
];

export function draftChangeKinds(
  before: DesignDraft,
  after: DesignDraft,
  categoryOf: (componentId: string) => ComponentCategory | undefined,
): ChangeKind[] {
  const kinds = new Set<ChangeKind>();
  for (const k of keysDiffering(before.hull, after.hull))
    kinds.add(STRUCTURE_KEYS.has(k) ? "STRUCTURE" : "FITTINGS");
  for (const k of keysDiffering(before.machinery, after.machinery))
    kinds.add(k === "plantId" || k === "installedKw" ? "MACHINERY" : "FITTINGS");
  if (!same(before.armour, after.armour)) kinds.add("ARMOUR");
  const prev = new Map(before.placements.map((p) => [p.instanceId, p]));
  const next = new Map(after.placements.map((p) => [p.instanceId, p]));
  const touched = (componentId: string) =>
    kinds.add(categoryOf(componentId) === "MAIN_GUN" ? "MAIN_ARMAMENT" : "FITTINGS");
  for (const [id, p] of prev) {
    const q = next.get(id);
    if (q === undefined || !same(p, q)) touched(p.componentId);
    if (q !== undefined && q.componentId !== p.componentId) touched(q.componentId);
  }
  for (const [id, q] of next) if (!prev.has(id)) touched(q.componentId);
  return ORDER.filter((k) => kinds.has(k));
}

export const progressFromWork = (completedWork: number, totalWork: number): BuildProgress => ({
  hullDoneWork: completedWork,
  hullTotalWork: totalWork,
  armourStarted: false,
  machineryStarted: false,
  launched: false,
  affectedDoneWork: completedWork,
});
