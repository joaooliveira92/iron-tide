// Public compile contracts plus the small shared helpers used by the compile
// pipeline stages. Re-exported from ./compile.js so the package surface is
// unchanged.
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
  /** Chosen values for the component's declared parameters; missing ones default to the minimum. */
  readonly params?: Readonly<Record<string, number>>;
  readonly magazineRef?: string;
  /**
   * The compiled torpedo the parts read path resolved for this tube placement (ticket 13b). The
   * rebuild readers attach it from the launcher part's `loadsTorpedo`; the legacy placement path
   * leaves it absent.
   */
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
  /** Speed <-> reliability axis, -10_000 (reliability) .. +10_000 (speed). Absent = 0 = balanced (ADR-0233). */
  readonly enginePriorityBp?: number;
  /**
   * Optional machinery rooms (boiler rooms, engine rooms). The plant's weight and volume are split by `shareBp`
   * (sum 10_000); each room is a separate critical system. When absent the plant is one room at `zoneId`.
   */
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
  /** NONE = the brief accepts an unprotected ship (torpedo craft): protection findings become advisories. Default STANDARD. */
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
    /** The named scheme the regions were last set from; absent = Custom (ADR-0232). */
    readonly schemeId?: ArmourSchemeId;
  };
  readonly placements: readonly PlacementSpec[];
  /** Fire-control fit beyond the directors themselves (ADR-0233). Absent = no positions. */
  readonly fireControl?: { readonly positions: number };
  /** Tertiary battery: a count of one chosen gun, no placement, arc or role (ADR-0233). Absent = none. */
  readonly tertiary?: TertiaryBattery;
  /** Fitted for colonial service (manual p.42; S-5, spec #73 R4). Absent or false = unfitted, identical to a design that predates it. */
  readonly colonialServiceFitted?: boolean;
  /** Aluminium superstructure (manual p.45; ADR-0252). Absent or false = steel, identical to a design that predates it. */
  readonly aluminiumSuperstructure?: boolean;
  /** Light and medium AA guns and AA directors: counts only (manual p.43; ADR-0252). Absent = none. */
  readonly antiAircraft?: AntiAircraftFit;
}

/** A design's header facts: everything the compile derives from, without its placements. */
export type DesignIntent = Omit<DesignDraft, "placements">;

export interface HullFormData {
  readonly form: HullForm;
  readonly zones: readonly ZoneDef[];
  readonly volumeFullnessBp: number;
  readonly deckFullnessBp: number;
  readonly lcbPermille: number;
  readonly buoyancyByZoneBp: readonly number[];
  /** Hull-form traits (e.g. `merchant_derived`); absent = none. */
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
  /** Tertiary-battery coefficients (BALANCE TARGETs). Absent = the battery contributes nothing. */
  readonly tertiary?: TertiaryBalance;
  /** Aluminium-superstructure values, all PROVISIONAL (ADR-0252). Absent = the option does nothing and is not offered. */
  readonly aluminiumSuperstructure?: AluminiumBalance;
  /** AA-fit values, all PROVISIONAL (ADR-0252). Absent = the fit does nothing and is not offered. */
  readonly antiAircraft?: AntiAircraftBalance;
  readonly armour: ArmourBalance;
  readonly stability: StabilityBalance;
  readonly systems: SystemsBalance;
  /** Which ledger line each component category's weight belongs to. */
  readonly ledgerCategoryOf: Readonly<Record<ComponentCategory, LedgerCategory>>;
  /** Vertical position of distributed lumps as bp of depth. */
  readonly lumpZFractionBp: Readonly<
    Record<"hull" | "margin" | "reserve" | "crew" | "machinery" | "fuel", number>
  >;
  /** Vertical position of armour regions as bp of depth. */
  readonly armourZFractionBp: Readonly<Record<string, number>>;
  readonly crewKgPerHead: number;
  readonly stabilityWindowByCategory: Readonly<Record<string, StabilityWindow>>;
  /** DESIGN-22 thresholds; defaults to the EARLY band when absent. */
  readonly classification?: ClassificationRules;
  readonly minReserveBpByExpectation: Readonly<
    Record<DesignRequirement["modernizationExpectation"], number>
  >;
}

export interface ShipContext {
  /** Campaign month, YYYY-MM. */
  readonly month: string;
  readonly unlockedTechs: ReadonlySet<string>;
  readonly catalogue: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly hullForms: Readonly<Record<string, HullFormData>>;
  readonly threats: readonly ThreatProfile[];
  readonly facilities: readonly Facility[];
  readonly treaty: TreatyLimits | null;
  readonly balance: ShipBalance;
  /** Nation capabilities granted by the scenario (checked against a ship type's `requiresCapability`); absent = none. */
  readonly capabilities?: ReadonlySet<string>;
  /**
   * The compiled ship-type records (ADR-0156, ticket 12b). When present, classification precedence,
   * availability facts and fit requirements read content; absent falls back to the code registry,
   * whose values the 12a regression pins equal. Optional so fixtures and older callers keep working.
   */
  readonly shipTypes?: readonly import("@bluewave/content-schema").ShipTypeRecord[];
  /** Ship types a scenario forbids outright (treaty categories are handled by `treaty.forbiddenCategories`). */
  readonly restrictedShipTypes?: readonly string[];
  /** Scenario switch for colonial-service ships (KE); absent = allowed. */
  readonly colonialServiceAllowed?: boolean;
  /**
   * The proportion of displacement a colonial-service fitting takes, from the optional S-5 ruleset section (ADR-0242).
   * Absent = the section is not configured: a fitting is recorded and flagged, and costs nothing. Never defaulted.
   */
  readonly colonialFitting?: { readonly displacementBp: number };
  /** The nation's naval profile, when the context was built for a nation (the UI reads this for the doctrine brief). */
  readonly navalProfile?: import("./nationProfile.js").NationNavalProfile;
  /**
   * First-class armament content (ADR-0093 Step 3). When present, every installed weapon resolves through
   * `@bluewave/armament`'s `resolveArmament` and the compiled weapon contract records the armament identity.
   * When absent (older packs, fixtures), the compile falls back to the legacy component attributes — the
   * explicitly documented compatibility path.
   */
  readonly armamentContent?: import("./armamentContent.js").AuthoredArmamentContent | null;
  /**
   * The compiled part model (SPM-R18, ticket 14). When present, a refit evaluates a touched
   * part's slot acceptance from the parts themselves; absent, it falls back to the legacy
   * component categories. Optional so fixtures and older callers keep working.
   */
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
  /** Per-placement resolved data used by cost and construction planning. */
  readonly components: readonly ComponentSummary[];
  readonly findings: readonly Finding[];
  /** Present only on a design fitted for colonial service, so an unfitted design's compiled hash is unchanged. */
  readonly colonialService?: ColonialFittingResult;
  /** Present only on a design that asks for an aluminium superstructure, so every other design's hash is unchanged. */
  readonly aluminium?: AluminiumResult;
  /** Present only on a design that asks for an AA fit, so every other design's hash is unchanged. */
  readonly antiAircraft?: AntiAircraftResult;
  readonly valid: boolean;
  /** SHA-256 over the canonical serialisation of the whole result. */
  readonly hash: string;
}

export interface ComponentSummary {
  readonly instanceId: string;
  readonly componentId: string;
  readonly category: ComponentCategory;
  readonly weightKg: number;
  readonly costMicro: number;
  readonly maintenanceMonthlyBp: number;
  /** Authored build work, or null to use the balance default. */
  readonly buildWorkMicro: number | null;
  readonly productionLine: string | null;
  readonly requires: readonly string[];
  /** Chosen parameters and evaluated attributes, for adapters (e.g. caliber, barrels, tubes). */
  readonly params: Readonly<Record<string, number>>;
  readonly attr: Readonly<Record<string, number>>;
  readonly torpedoMount: ResolvedTorpedoMount | null;
  /**
   * The armament identity a gun placement compiled from (ADR-0093 Step 3). Present for gun categories
   * when the context carried first-class armament content and the combination resolved; absent otherwise.
   */
  readonly armament?: CompiledWeaponArmament;
}

/**
 * The compiled weapon contract (ADR-0093 Step 3, section 5): the armament identity and mapped deterministic
 * values used to compile one installed weapon. Every value is grounded in `ResolvedArmament`; it carries no
 * combat penetration, hit probability or damage. Values absent from the content are omitted, never guessed.
 *
 * The type is owned by `@bluewave/armament` (as `CompiledArmamentMount`) so ship-design, campaign and combat
 * share one contract; it is re-exported here under the ship-design name.
 */
export type CompiledWeaponArmament = CompiledArmamentMount;

export const WEAPON_CATEGORIES: readonly ComponentCategory[] = [
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
];

/** The neutral torpedo contract a launcher placement carries into the compiled summary. */
export interface ResolvedTorpedoMount {
  readonly mountType: string;
  readonly torpedoModelId: string;
  readonly compiledTorpedo?: CompiledTorpedo;
}

/**
 * One placement resolved once, from its parts (production) or its legacy component (fixtures and
 * the legacy path). Fit and the compile both read this record, so a mount's mass and cost have a
 * single source.
 */
export interface Resolved {
  readonly spec: PlacementSpec;
  /** The legacy component id the placement names: a gun's family, a launcher's base id. */
  readonly componentId: string;
  readonly category: ComponentCategory;
  readonly tags: readonly string[];
  readonly fcClass?: string;
  readonly fcClasses: readonly string[];
  readonly allowedZones?: readonly ZoneId[];
  readonly forbidsCoLocation: readonly ComponentCategory[];
  readonly critical: boolean;
  readonly maintenanceMonthlyBp: number;
  /** Authored build work, or null to use the balance default. */
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
