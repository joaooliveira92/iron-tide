import {
  armamentChangeFindings,
  type AuthoredArmamentContent,
  type DesignDraft,
  type Finding,
  type GunChange,
  type PlacementSpec,
  type ShipBuildingContent,
} from "@bluewave/ship-design";

/**
 * The manual's refit rules as the rebuild path sees them (INC-12/INC-13, SB3-R25..R27):
 * `REARMAMENT`'s armament-change conditions and the `BULGE` blister requirement, in one
 * pure helper so the live rebuild path and the desktop check share exactly the compiled
 * rule set instead of a second copy.
 *
 * Why not `evaluateRefit` (ADR-0078, spec SB3-R27): `evaluateRefit` needs a `ShipState`
 * (growth budget, hull fatigue, remaining service, refit count) that the rebuild path does
 * not model. Rather than fabricate those budgets, this module reuses the pure
 * `armamentChangeFindings` rule set verbatim (`gunDiffOf` reproduces `evaluateRefit`'s
 * `gunChangeOf`, including the `defaultMountType` fallback of ADR-0131), and a dedicated
 * bulge check that reads the same thing a `BULGE` rebuild is: a grown hull.
 */

/** A catalogue entry as the armament rules read it (the compile catalogue satisfies it structurally). */
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

/** The armament content's mount-style view: the first-class content `gunChangeOf` reads (ADR-0093/ADR-0131). */
export type MountStyleContent = Pick<AuthoredArmamentContent, "gunFamilies">;

/** The guns removed from and added to a design by a rebuild. */
export interface GunDiff {
  readonly removed: readonly GunChange[];
  readonly added: readonly GunChange[];
}

/**
 * A placement as a `GunChange`, using exactly `evaluateRefit`'s mount-type logic: the authored
 * `defaultMountType` (only `TURRET` is a turret), else the barrel-count fallback for packs without
 * armament content; the role is `MAIN` only for `MAIN_GUN`; the calibre comes from the component's
 * `caliberUm` attribute.
 */
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

/**
 * The guns a rebuild removes and adds, diffed from the two drafts by placement. A placement is
 * "removed" when its instance is gone or its component changed, and "added" symmetrically; only
 * gun components count. Pure and deterministic, in draft order.
 */
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

/**
 * The manual's armament-change findings for a rebuild (SB3-R26): the pure `armamentChangeFindings`
 * rule set applied to the guns the two drafts remove and add. Empty when no gun changes.
 */
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

/** The reason a `BULGE` rebuild was attempted without growing the hull. */
export const REBUILD_BULGE_REQUIRED = "REBUILD_BULGE_REQUIRED" as const;

/**
 * True when a `BULGE` rebuild did not grow the hull. The blister's mass is carried into the draft's
 * `targetDisplacementKg` (ADR-0130 section 2), so a bulge that adds no displacement cannot raise
 * torpedo protection as a blister would; the speed penalty is the compile's own, from the added mass.
 */
export function rebuildBulgeRequired(oldDraft: DesignDraft, newDraft: DesignDraft): boolean {
  return newDraft.hull.targetDisplacementKg <= oldDraft.hull.targetDisplacementKg;
}
