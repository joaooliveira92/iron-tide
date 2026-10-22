import {
  buildCompatibilitySlots,
  buildGunPartModel,
  componentAccessOf,
  nationHasArmamentContent,
  resolveGunPlacementThroughParts,
  type AuthoredArmamentContent,
  type DesignDraft,
  type GunPartModel,
  type GunPartRequest,
  type PlacementSpec,
  type ResolvedGunPlacement,
} from "../../src/index.js";
import {
  armamentContent,
  components,
  earlyContext,
  hullRecords,
  readReferenceDesignEntries,
} from "./earlyContext.js";

const GUN = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);

export interface Design {
  readonly id: string;
  readonly month: string;
  readonly draft: DesignDraft;
}

export interface GunPlacement {
  readonly design: Design;
  readonly placement: PlacementSpec;
  readonly familyId: string;
}

export const designs: readonly Design[] = readReferenceDesignEntries();

export const gunPlacements: readonly GunPlacement[] = designs.flatMap((design) =>
  design.draft.placements.flatMap((placement) => {
    const component = components.find((c) => c.id === placement.componentId);
    return component !== undefined && GUN.has(component.category)
      ? [{ design, placement, familyId: component.id }]
      : [];
  }),
);

export const gunRequests: readonly GunPartRequest[] = gunPlacements.map((row) => ({
  nationId: row.design.draft.nationId,
  familyId: row.familyId,
}));

export const gunPartModel = buildGunPartModel({
  content: armamentContent,
  components,
  requests: gunRequests,
});

export const compatibility = buildCompatibilitySlots({ hullForms: hullRecords });

export const where = (row: GunPlacement): string => `${row.design.id}:${row.placement.instanceId}`;

export function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected ${what}`);
  return value;
}

export function resolveRow(
  row: GunPlacement,
  options: {
    readonly content?: AuthoredArmamentContent;
    readonly model?: GunPartModel;
    readonly month?: string;
  } = {},
): ResolvedGunPlacement {
  const content = options.content ?? armamentContent;
  const month = options.month ?? row.design.month;
  const ctx = earlyContext(month);
  const nationId = row.design.draft.nationId;
  return resolveGunPlacementThroughParts({
    content,
    components,
    model: options.model ?? gunPartModel,
    designId: row.design.id,
    placement: row.placement,
    nationId,
    familyId: row.familyId,
    month,
    unlockedTechnologyIds: ctx.unlockedTechs,
    componentAccess: componentAccessOf(ctx.navalProfile),
    useFirstClassArmament: nationHasArmamentContent(content, nationId),
  });
}
