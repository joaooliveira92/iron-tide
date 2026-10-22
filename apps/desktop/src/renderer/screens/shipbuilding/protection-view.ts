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

export const PROTECTION_GROUPS = [
  { id: "belt", label: "Belt" },
  { id: "deck", label: "Deck" },
  { id: "conning-tower", label: "Conning tower" },
  { id: "armament", label: "Armament protection" },
  { id: "underwater", label: "Underwater protection" },
] as const;
export type ProtectionGroupId = (typeof PROTECTION_GROUPS)[number]["id"];

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

const INCLINED_COS_BP = 8_660;
const FLAT_COS_BP = 10_000;

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

export function regionLabel(region: ArmourRegionId): string {
  return REGION_META[region].label;
}

export function protectionGroupOf(region: ArmourRegionId): ProtectionGroupId {
  return REGION_META[region].group;
}

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
  readonly armour: ArmourRegion;
  readonly recommended: ArmourRegion;
  readonly thicknessMm: number;
  readonly lengthMm: number;
  readonly heightMm: number;
  readonly coveragePermille: number;
  readonly weightKg: number;
  readonly protectedAreaM2: number;
  readonly materialId: string;
  readonly materialLabel: string;
  readonly inclined: boolean;
  readonly effectiveThicknessMm: number;
  readonly marginBp: number | null;
  readonly defeatsDesignThreat: boolean;
}

export interface ProtectionGroup {
  readonly id: ProtectionGroupId;
  readonly label: string;
  readonly fields: readonly ProtectionField[];
}

export interface SchemeChoice {
  readonly id: ArmourSchemeId;
  readonly label: string;
  readonly citation: string;
  readonly locked: boolean;
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
  readonly regionSizing: RegionSizing;
  readonly defaultMaterialId: string;
  readonly schemes: readonly SchemeChoice[];
  readonly schemeLabel: string;
  readonly notes: readonly string[];
}

const materialLabel = (m: ArmourMaterialOption | undefined, id: string): string =>
  m === undefined ? words(id) : `${words(m.id)}${m.available ? "" : ` (${m.unavailableReason})`}`;

export function protectionModel(
  draft: DesignDraft,
  view: WorkshopView,
  materials: readonly ArmourMaterialOption[],
  calendarYear: number,
): ProtectionModel {
  const armour = view.compiled.armour;
  const threat = draft.requirement.designThreatId;
  const lengthWl = Number(draft.hull.lengthWl);
  const regionSizing: RegionSizing = {
    lengthWlMm: draft.hull.lengthWl,
    beamMm: draft.hull.beam,
    depthMm: draft.hull.depthToMainDeck,
    citadelLengthMm: draft.armour.citadelLengthMm,
  };
  const defaultMaterialId =
    draft.armour.regions[0]?.materialId ?? materials.find((m) => m.available)?.id ?? "";

  const fitted: ProtectionField[] = draft.armour.regions.map((r) => {
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
      effectiveThicknessMm: (armour?.effectiveThicknessByRegionUm[r.region] ?? 0) / 1000,
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

export function schemeEdit(
  model: ProtectionModel,
  id: ArmourSchemeId,
): Extract<DraftEdit, { kind: "set_armour_scheme" }> | null {
  const choice = model.schemes.find((s) => s.id === id);
  if (choice === undefined || choice.locked) return null;
  return { kind: "set_armour_scheme", schemeId: id, regions: choice.regions };
}
