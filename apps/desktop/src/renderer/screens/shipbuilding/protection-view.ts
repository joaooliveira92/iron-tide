import {
  applyArmourScheme,
  ARMOUR_REGIONS,
  ARMOUR_SCHEMES,
  armourSchemeAvailable,
  newArmourRegion,
  type ArmourMaterialOption,
  type ArmourRegion,
  type ArmourRegionId,
  type ArmourSchemeId,
  type DesignDraft,
  type DraftEdit,
  type RegionSizing,
  type WorkshopView,
} from "@bluewave/ship-design";
import { schemeDiagram, type SchemeDiagram } from "./scheme-diagram.js";

/**
 * The Protection section's armour view model. Pure: it groups the design's armour regions spatially and turns each
 * one into the readouts the editor shows (thickness, coverage, weight, protected area, effectiveness), plus the
 * inputs the editor needs to edit them (the region object, the default material, the hull sizing). Nothing here
 * edits the design, and every value comes from the draft or the compile — never invented. Values the model does not
 * carry are named in `notes` rather than faked.
 */

/** The spatial groups the armour layout is read in, in the order the editor shows them. */
export const PROTECTION_GROUPS = [
  { id: "belt", label: "Belt" },
  { id: "deck", label: "Deck" },
  { id: "conning-tower", label: "Conning tower" },
  { id: "armament", label: "Armament protection" },
  { id: "underwater", label: "Underwater protection" },
] as const;
export type ProtectionGroupId = (typeof PROTECTION_GROUPS)[number]["id"];

/**
 * Each region's display label and spatial group. A presentation convention: the model has no grouping of its own.
 * Splinter plating sits with the belt (it is hull side plating, not armament); the magazine box sits with the
 * underwater group as the brief lists magazine protection there.
 */
const REGION_META: {
  readonly [K in ArmourRegionId]: { readonly label: string; readonly group: ProtectionGroupId };
} = {
  BELT_MAIN: { label: "Main belt", group: "belt" },
  BELT_UPPER: { label: "Upper belt", group: "belt" },
  BELT_ENDS: { label: "Belt extended (BE)", group: "belt" },
  SPLINTER_PLATING: { label: "Splinter plating", group: "belt" },
  DECK_MAIN: { label: "Main deck", group: "deck" },
  DECK_SLOPE: { label: "Deck slope", group: "deck" },
  CONNING_TOWER: { label: "Conning tower", group: "conning-tower" },
  DECK_EXTENDED: { label: "Deck extended (DE)", group: "deck" },
  TURRET: { label: "Turret + barbette (T)", group: "armament" },
  TURRET_TOP: { label: "Turret top (TT)", group: "armament" },
  SECONDARY_GUN: { label: "Secondary gun armour (SEC)", group: "armament" },
  MAGAZINE_BOX: { label: "Magazine box", group: "underwater" },
  TORPEDO_BULKHEAD: { label: "Torpedo bulkhead", group: "underwater" },
  TORPEDO_BELT: { label: "Torpedo belt", group: "underwater" },
};

/** cos(30 degrees) in bp: the "inclined" setting. A flat-on plate is 10_000. */
const INCLINED_COS_BP = 8_660;
const FLAT_COS_BP = 10_000;

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

export function regionLabel(region: ArmourRegionId): string {
  return REGION_META[region].label;
}

export function protectionGroupOf(region: ArmourRegionId): ProtectionGroupId {
  return REGION_META[region].group;
}

/** The material choices for a select, one per material, marking the unavailable ones (except the current choice). */
export function armourMaterialChoices(
  materials: readonly ArmourMaterialOption[],
  current: string,
): { readonly value: string; readonly label: string; readonly disabled: boolean }[] {
  return materials.map((m) => ({
    value: m.id,
    label: `${words(m.id)}${m.available ? "" : ` (${m.unavailableReason})`}`,
    disabled: !m.available && m.id !== current,
  }));
}

export interface ProtectionField {
  readonly region: ArmourRegionId;
  readonly label: string;
  /** The draft region itself, so the editor can edit it without reaching back into the draft. */
  readonly armour: ArmourRegion;
  /** The region as a fresh one would be sized, so a field can reset to the recommended starting plate. */
  readonly recommended: ArmourRegion;
  readonly thicknessMm: number;
  readonly lengthMm: number;
  readonly heightMm: number;
  /** Fore-aft extent as a share of the waterline, permille. */
  readonly coveragePermille: number;
  readonly weightKg: number;
  /** Plate area, m^2. */
  readonly protectedAreaM2: number;
  readonly materialId: string;
  readonly materialLabel: string;
  readonly inclined: boolean;
  /** Effective thickness against a flat hit, mm: thickness x material effectiveness x cos obliquity. */
  readonly effectiveThicknessMm: number;
  /** Penetration margin against the design threat, bp; null when the region is not in the compile. */
  readonly marginBp: number | null;
  readonly defeatsDesignThreat: boolean;
}

export interface ProtectionGroup {
  readonly id: ProtectionGroupId;
  readonly label: string;
  readonly fields: readonly ProtectionField[];
}

/** One armour scheme as the selector shows it. */
export interface SchemeChoice {
  readonly id: ArmourSchemeId;
  readonly label: string;
  readonly citation: string;
  readonly locked: boolean;
  /** "Unlocks in 1905" when locked, else null. */
  readonly lockedReason: string | null;
  readonly active: boolean;
  readonly regions: readonly ArmourRegion[];
  readonly diagram: SchemeDiagram;
}

export interface ProtectionModel {
  readonly groups: readonly ProtectionGroup[];
  readonly fitted: readonly ProtectionField[];
  readonly availableRegions: readonly { readonly id: ArmourRegionId; readonly label: string }[];
  readonly materials: readonly ArmourMaterialOption[];
  readonly coverageBp: number;
  readonly totalWeightKg: number;
  readonly designThreatId: string;
  readonly designThreatLabel: string;
  readonly protectionGoal: "NONE" | "STANDARD";
  /** The hull and citadel measurements a new region's starting size is taken from. */
  readonly regionSizing: RegionSizing;
  /** The material a newly added region starts with: the first fitted region's, else the first available. */
  readonly defaultMaterialId: string;
  /** The named armour schemes, in catalogue order, with their lock state against the calendar year. */
  readonly schemes: readonly SchemeChoice[];
  /** The scheme the regions were last set from, or "Custom" after any manual region edit. */
  readonly schemeLabel: string;
  /** Things the model does not yet carry, said plainly rather than faked. */
  readonly notes: readonly string[];
}

const materialLabel = (m: ArmourMaterialOption | undefined, id: string): string =>
  m === undefined ? words(id) : `${words(m.id)}${m.available ? "" : ` (${m.unavailableReason})`}`;

/** The protection model for a draft: the design's armour regions grouped spatially, with their compiled readouts. */
export function protectionModel(
  draft: DesignDraft,
  view: WorkshopView,
  materials: readonly ArmourMaterialOption[],
  calendarYear: number,
): ProtectionModel {
  const armour = view.compiled.armour;
  const threat = draft.requirement.designThreatId;
  const lengthWl = Number(draft.hull.lengthWl);
  const effOf = new Map(materials.map((m) => [m.id, m.effBp]));
  const regionSizing: RegionSizing = {
    lengthWlMm: draft.hull.lengthWl,
    beamMm: draft.hull.beam,
    depthMm: draft.hull.depthToMainDeck,
    citadelLengthMm: draft.armour.citadelLengthMm,
  };
  const defaultMaterialId =
    draft.armour.regions[0]?.materialId ?? materials.find((m) => m.available)?.id ?? "";

  const fitted: ProtectionField[] = draft.armour.regions.map((r) => {
    const eff = effOf.get(r.materialId) ?? 10_000;
    const marginBp = armour?.marginBp[r.region]?.[threat] ?? null;
    return {
      region: r.region,
      label: regionLabel(r.region),
      armour: r,
      recommended: newArmourRegion(r.region, regionSizing, defaultMaterialId),
      thicknessMm: r.thicknessUm / 1000,
      lengthMm: r.lengthMm,
      heightMm: r.heightMm,
      coveragePermille: lengthWl <= 0 ? 0 : Math.round((r.lengthMm * 1000) / lengthWl),
      weightKg: armour?.weightByRegionKg[r.region] ?? 0,
      protectedAreaM2: (r.lengthMm * r.heightMm) / 1_000_000,
      materialId: r.materialId,
      materialLabel: materialLabel(
        materials.find((m) => m.id === r.materialId),
        r.materialId,
      ),
      inclined: r.cosObliquityBp < FLAT_COS_BP,
      effectiveThicknessMm: (r.thicknessUm * eff * r.cosObliquityBp) / (10_000 * 10_000) / 1000,
      marginBp,
      defeatsDesignThreat: marginBp !== null && marginBp >= 0,
    };
  });

  const fittedRegions = new Set(draft.armour.regions.map((r) => r.region));
  const availableRegions = ARMOUR_REGIONS.filter((r) => !fittedRegions.has(r)).map((id) => ({
    id,
    label: regionLabel(id),
  }));

  const groups: ProtectionGroup[] = PROTECTION_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    fields: fitted.filter((f) => protectionGroupOf(f.region) === g.id),
  })).filter((g) => g.fields.length > 0);

  return {
    groups,
    fitted,
    availableRegions,
    materials,
    coverageBp: armour?.coverageBp ?? 0,
    totalWeightKg: armour?.totalWeightKg ?? 0,
    designThreatId: threat,
    designThreatLabel: words(threat),
    protectionGoal: draft.requirement.protectionGoal ?? "STANDARD",
    regionSizing,
    defaultMaterialId,
    schemes: ARMOUR_SCHEMES.map((s) => {
      const locked = !armourSchemeAvailable(s, calendarYear);
      return {
        id: s.id,
        label: s.displayName,
        citation: s.citation,
        locked,
        lockedReason: locked ? `Unlocks in ${s.unlockYear}` : null,
        active: draft.armour.schemeId === s.id,
        regions: applyArmourScheme(s.id, draft.armour.regions, regionSizing, defaultMaterialId),
        diagram: schemeDiagram(s),
      };
    }),
    schemeLabel:
      ARMOUR_SCHEMES.find((s) => s.id === draft.armour.schemeId)?.displayName ?? "Custom",
    notes: [
      "Coverage is each plate's fore-aft extent as a share of the waterline (the header's belt coverage is the belt's share of the citadel); the design gives no station, so the plan draws regions amidships (a convention).",
      "Subdivision and double bottom are not modelled as armour regions; the model carries the fourteen regions above, including the manual's nine universal fields.",
      "Inclination is modelled (cos obliquity); tapering and internal backing are not.",
    ],
  };
}

export { INCLINED_COS_BP, FLAT_COS_BP };

/**
 * The edit that applies a scheme as one undoable step, or null when the scheme is locked. The regions are the ones the
 * model already computed for it, so the edit is exactly what the selector showed.
 */
export function schemeEdit(
  model: ProtectionModel,
  id: ArmourSchemeId,
): Extract<DraftEdit, { kind: "set_armour_scheme" }> | null {
  const choice = model.schemes.find((s) => s.id === id);
  if (choice === undefined || choice.locked) return null;
  return { kind: "set_armour_scheme", schemeId: id, regions: choice.regions };
}
