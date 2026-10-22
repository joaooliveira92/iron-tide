import type { ArrangementBalance, ArrangementResult, ZoneDef, ZoneId } from "./arrangement.js";
import type { ArmourBalance, ArmourRegion, ArmourResult, ThreatProfile } from "./armour.js";
import type { ClassificationRules } from "./classification.js";
import type { ColonialFittingResult } from "./colonialService.js";
import type { ComponentCategory, ComponentDef } from "./component.js";
import type { CompiledArmamentMount, CompiledTorpedo } from "@bluewave/armament";
import type { Finding } from "./findings.js";
import { evaluate } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import type { HullBalance, HullForm, HullResult, HullSpec } from "./hull.js";
import type { DisplacementLedger, LedgerCategory } from "./ledger.js";
import type { ArmourSchemeId } from "./armourSchemes.js";
import type { AluminiumBalance, AluminiumResult } from "./aluminium.js";
import type { AntiAircraftBalance, AntiAircraftFit, AntiAircraftResult } from "./antiAircraft.js";
import type { TertiaryBalance, TertiaryBattery } from "./tertiary.js";
import type { MachineryBalance, MachineryResult, PropulsionPlant } from "./machinery.js";
import type { StabilityBalance, StabilityResult, StabilityWindow } from "./stability.js";
import type { AccommodationStandard, SystemsBalance, SystemsResult } from "./systems.js";
import type { MountSide, WeaponBalance, WeaponsResult } from "./weapons.js";

export interface PlacementSpec {
  readonly instanceId: string;
  readonly componentId: string;
  readonly zoneId: ZoneId;
  readonly stationPermille: number;
  readonly side?: MountSide;
  readonly params?: Readonly<Record<string, number>>;
  readonly magazineRef?: string;
  readonly compiledTorpedo?: CompiledTorpedo;
}

export interface MachineryPlan {
  readonly plantId: string;
  readonly installedKw: number;
  readonly zoneId: ZoneId;
  readonly stationPermille: number;
  readonly fuelCapacityKg: number;
  readonly fuelZoneId: ZoneId;
  readonly fuelStationPermille: number;
  readonly foulingBp: number;
  readonly enginePriorityBp?: number;
  readonly rooms?: readonly {
    readonly zoneId: ZoneId;
    readonly stationPermille: number;
    readonly shareBp: number;
  }[];
}

export interface DesignRequirement {
  readonly category: string;
  readonly requiredSpeedMilliKnots: number;
  readonly cruiseSpeedMilliKnots: number;
  readonly requiredRangeNm: number;
  readonly designThreatId: string;
  readonly modernizationExpectation: "NONE" | "MINOR" | "MAJOR";
  readonly crewQualityBp: number;
  readonly accommodationStandard: AccommodationStandard;
  readonly protectionGoal?: "NONE" | "STANDARD";
}

export interface DesignDraft {
  readonly nationId: string;
  readonly requirement: DesignRequirement;
  readonly hull: HullSpec;
  readonly machinery: MachineryPlan;
  readonly armour: {
    readonly regions: readonly ArmourRegion[];
    readonly citadelLengthMm: number;
    readonly torpedoWarheadKg: number;
    readonly bunkerProtectionBp: number;
    readonly schemeId?: ArmourSchemeId;
  };
  readonly placements: readonly PlacementSpec[];
  readonly fireControl?: { readonly positions: number };
  readonly tertiary?: TertiaryBattery;
  readonly colonialServiceFitted?: boolean;
  readonly aluminiumSuperstructure?: boolean;
  readonly antiAircraft?: AntiAircraftFit;
}

export type DesignIntent = Omit<DesignDraft, "placements">;

export interface HullFormData {
  readonly form: HullForm;
  readonly zones: readonly ZoneDef[];
  readonly volumeFullnessBp: number;
  readonly deckFullnessBp: number;
  readonly lcbPermille: number;
  readonly buoyancyByZoneBp: readonly number[];
  readonly traits?: readonly string[];
}

export interface Facility {
  readonly id: string;
  readonly maxLengthMm: number;
  readonly maxBeamMm: number;
  readonly maxDisplacementKg: number;
  readonly craneLiftKg: number;
}

export interface TreatyLimits {
  readonly maxDisplacementKg?: number;
  readonly maxMainGunCaliberUm?: number;
  readonly forbiddenCategories?: readonly string[];
}

export interface ShipBalance {
  readonly hull: HullBalance;
  readonly machinery: MachineryBalance;
  readonly arrangement: ArrangementBalance;
  readonly weapons: WeaponBalance;
  readonly tertiary?: TertiaryBalance;
  readonly aluminiumSuperstructure?: AluminiumBalance;
  readonly antiAircraft?: AntiAircraftBalance;
  readonly armour: ArmourBalance;
  readonly stability: StabilityBalance;
  readonly systems: SystemsBalance;
  readonly ledgerCategoryOf: Readonly<Record<ComponentCategory, LedgerCategory>>;
  readonly lumpZFractionBp: Readonly<
    Record<"hull" | "margin" | "reserve" | "crew" | "machinery" | "fuel", number>
  >;
  readonly armourZFractionBp: Readonly<Record<string, number>>;
  readonly crewKgPerHead: number;
  readonly stabilityWindowByCategory: Readonly<Record<string, StabilityWindow>>;
  readonly classification?: ClassificationRules;
  readonly minReserveBpByExpectation: Readonly<
    Record<DesignRequirement["modernizationExpectation"], number>
  >;
}

export interface ShipContext {
  readonly month: string;
  readonly unlockedTechs: ReadonlySet<string>;
  readonly catalogue: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly hullForms: Readonly<Record<string, HullFormData>>;
  readonly threats: readonly ThreatProfile[];
  readonly facilities: readonly Facility[];
  readonly treaty: TreatyLimits | null;
  readonly balance: ShipBalance;
  readonly capabilities?: ReadonlySet<string>;
  readonly shipTypes?: readonly import("@bluewave/content-schema").ShipTypeRecord[];
  readonly restrictedShipTypes?: readonly string[];
  readonly colonialServiceAllowed?: boolean;
  readonly colonialFitting?: { readonly displacementBp: number };
  readonly navalProfile?: import("./nationProfile.js").NationNavalProfile;
  readonly armamentContent?: import("./armamentContent.js").AuthoredArmamentContent | null;
  readonly partModel?: import("@bluewave/content-schema").CompiledPartModel;
}

export interface CompiledDesign {
  readonly ledger: DisplacementLedger;
  readonly totalKg: number;
  readonly hull: HullResult;
  readonly machinery: MachineryResult | null;
  readonly arrangement: ArrangementResult | null;
  readonly weapons: WeaponsResult | null;
  readonly armour: ArmourResult | null;
  readonly stability: StabilityResult | null;
  readonly systems: SystemsResult | null;
  readonly naturalClass: string | null;
  readonly componentCostMicro: number;
  readonly components: readonly ComponentSummary[];
  readonly findings: readonly Finding[];
  readonly colonialService?: ColonialFittingResult;
  readonly aluminium?: AluminiumResult;
  readonly antiAircraft?: AntiAircraftResult;
  readonly valid: boolean;
  readonly hash: string;
}

export interface ComponentSummary {
  readonly instanceId: string;
  readonly componentId: string;
  readonly category: ComponentCategory;
  readonly weightKg: number;
  readonly costMicro: number;
  readonly maintenanceMonthlyBp: number;
  readonly buildWorkMicro: number | null;
  readonly productionLine: string | null;
  readonly requires: readonly string[];
  readonly params: Readonly<Record<string, number>>;
  readonly attr: Readonly<Record<string, number>>;
  readonly torpedoMount: ResolvedTorpedoMount | null;
  readonly armament?: CompiledWeaponArmament;
}

export type CompiledWeaponArmament = CompiledArmamentMount;

export const WEAPON_CATEGORIES: readonly ComponentCategory[] = [
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
];

export interface ResolvedTorpedoMount {
  readonly mountType: string;
  readonly torpedoModelId: string;
  readonly compiledTorpedo?: CompiledTorpedo;
}

export interface Resolved {
  readonly spec: PlacementSpec;
  readonly componentId: string;
  readonly category: ComponentCategory;
  readonly tags: readonly string[];
  readonly fcClass?: string;
  readonly fcClasses: readonly string[];
  readonly allowedZones?: readonly ZoneId[];
  readonly forbidsCoLocation: readonly ComponentCategory[];
  readonly critical: boolean;
  readonly maintenanceMonthlyBp: number;
  readonly buildWorkMicro: number | null;
  readonly productionLine: string | null;
  readonly requires: readonly string[];
  readonly torpedoMount: ResolvedTorpedoMount | null;
  readonly params: Record<string, number>;
  readonly weightKg: number;
  readonly volumeLitre: number;
  readonly deckFootprintMm2: number;
  readonly heightMm: number;
  readonly zCgMm: number;
  readonly powerKw: number;
  readonly coolingKw: number;
  readonly crew: number;
  readonly costMicro: number;
  readonly attr: Record<string, number>;
}

export function f(
  id: string,
  severity: Finding["severity"],
  what: string,
  why: string,
  consequence: string,
  remedies: [string, string][],
  formulaId = "SB-9",
): Finding {
  return {
    id,
    severity,
    what,
    why,
    consequence,
    remedies: remedies.map(([rid, description]) => ({ id: rid, description })),
    evidence: { formulaId, inputs: {}, threshold: 0, value: 1 },
  };
}

export const num = (src: string | undefined, vars: Record<string, number>) =>
  src === undefined ? 0 : evaluate(parseFormula(src), { vars });
export const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
