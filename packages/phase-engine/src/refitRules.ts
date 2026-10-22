import {
  armamentChangeFindings,
  type AuthoredArmamentContent,
  type DesignDraft,
  type Finding,
  type GunChange,
  type PlacementSpec,
  type ShipBuildingContent,
} from "@bluewave/ship-design";

export interface RefitCatalogueEntry {
  readonly id: string;
  readonly category: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

const GUN_CATEGORIES: ReadonlySet<string> = new Set([
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
]);

export type MountStyleContent = Pick<AuthoredArmamentContent, "gunFamilies">;

export interface GunDiff {
  readonly removed: readonly GunChange[];
  readonly added: readonly GunChange[];
}

function gunChangeOf(
  placement: PlacementSpec,
  catalogue: readonly RefitCatalogueEntry[],
  armamentContent: MountStyleContent | null,
): GunChange | null {
  const def = catalogue.find((c) => c.id === placement.componentId);
  if (def === undefined || !GUN_CATEGORIES.has(def.category)) return null;
  const barrels = placement.params?.["barrels"] ?? 1;
  const mountType = armamentContent?.gunFamilies.find((f) => f.id === def.id)?.defaultMountType;
  return {
    role: def.category === "MAIN_GUN" ? "MAIN" : "SECONDARY",
    caliberUm: Number(def.attributes?.["caliberUm"] ?? 0),
    barrels,
    casemate: mountType !== undefined ? mountType !== "TURRET" : barrels <= 1,
  };
}

export function gunDiffOf(
  oldDraft: DesignDraft,
  newDraft: DesignDraft,
  catalogue: readonly RefitCatalogueEntry[],
  armamentContent: MountStyleContent | null,
): GunDiff {
  const before = new Map(oldDraft.placements.map((p) => [p.instanceId, p]));
  const after = new Map(newDraft.placements.map((p) => [p.instanceId, p]));
  const removed: GunChange[] = [];
  const added: GunChange[] = [];
  for (const [id, p] of before) {
    const q = after.get(id);
    if (q === undefined || q.componentId !== p.componentId) {
      const gun = gunChangeOf(p, catalogue, armamentContent);
      if (gun !== null) removed.push(gun);
    }
  }
  for (const [id, q] of after) {
    const p = before.get(id);
    if (p === undefined || p.componentId !== q.componentId) {
      const gun = gunChangeOf(q, catalogue, armamentContent);
      if (gun !== null) added.push(gun);
    }
  }
  return { removed, added };
}

export function rebuildArmamentFindings(
  oldDraft: DesignDraft,
  newDraft: DesignDraft,
  content: ShipBuildingContent,
  month: string,
): readonly Finding[] {
  const { ctx } = content.environmentFor(month);
  const { removed, added } = gunDiffOf(
    oldDraft,
    newDraft,
    ctx.catalogue,
    ctx.armamentContent ?? null,
  );
  return armamentChangeFindings(removed, added);
}

export const REBUILD_BULGE_REQUIRED = "REBUILD_BULGE_REQUIRED" as const;

export function rebuildBulgeRequired(oldDraft: DesignDraft, newDraft: DesignDraft): boolean {
  return newDraft.hull.targetDisplacementKg <= oldDraft.hull.targetDisplacementKg;
}
