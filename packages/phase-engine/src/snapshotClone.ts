import type {
  BattleInstance,
  BattleManifest,
  BattleManifestSide,
  BattleResult,
  BlockadeState,
  CampaignSlot,
  CampaignSnapshot,
  CampaignWeatherState,
  CompiledDesignVersion,
  ConstructionMonthUsage,
  ConstructionPackage,
  ConstructionProject,
  DesignFamily,
  DesignStudy,
  ForeignConstructionContract,
  ForeignContractImpoundmentRecord,
  ForeignContractPaymentRecord,
  ForeignInsightAwardRecord,
  ProcurementIntent,
  DiplomaticRelation,
  FleetState,
  IntelligenceState,
  NationState,
  Officer,
  PermanentDivision,
  PoliticalState,
  ResearchState,
  Ship,
  TechnologyProgress,
  WarDeclaration,
  WarParticipantMembership,
  WarState,
  WorldState,
  PossessionData,
  TechnologyDefinitionData,
} from "@bluewave/campaign";
import type { SafeInt } from "@bluewave/contracts";
import { PhaseEngineError } from "./errors.js";

type AreaData = WorldState["areas"][number];
type RouteData = WorldState["routes"][number];
type PortData = WorldState["ports"][number];

// Field-exhaustive structural deep-clone of the campaign snapshot.
// Every record type has an explicit copy entry in `F`. Compile-time
// assertions below fail the build if a field is added/renamed without a
// matching clone entry. Runtime clone is deterministic, pollution-safe,
// and fail-closed.

const UNSAFE_KEYS = new Set<string>(["__proto__", "constructor", "prototype"]);

type ValueClone = (value: unknown, seen?: WeakMap<object, unknown>) => unknown;

/** Deterministic, pollution-safe deep copy. Handles primitives, Date, RegExp,
 *  Map, Set, Array, ArrayBuffer/TypedArray/DataView and plain records.
 *  Throws on circular refs (snapshot must be acyclic). */
function cloneValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  // functions are not expected in snapshot; preserve reference (deterministic)
  if (t === "function") return value;
  if (t !== "object") return value; // string, number, boolean, bigint, symbol

  const obj = value as object;
  if (seen.has(obj))
    throw new PhaseEngineError({ message: "cloneValue: circular reference detected" });

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Map) {
    const out = new Map<unknown, unknown>();
    seen.set(obj, out);
    for (const [k, v] of value as Map<unknown, unknown>) {
      const ck = cloneValue(k, seen);
      if (typeof ck === "string" && UNSAFE_KEYS.has(ck)) continue;
      out.set(ck, cloneValue(v, seen));
    }
    return out;
  }
  if (value instanceof Set) {
    const out = new Set<unknown>();
    seen.set(obj, out);
    for (const v of value as Set<unknown>) out.add(cloneValue(v, seen));
    return out;
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(obj, out);
    for (let i = 0; i < value.length; i++) out[i] = cloneValue((value as unknown[])[i], seen);
    return out;
  }
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) {
      return new DataView((value as DataView).buffer.slice(0), value.byteOffset, value.byteLength);
    }
    // TypedArray — copy via constructor
    // Erasing to `any` is required to invoke the arbitrary TypedArray constructor
    // for the value's runtime type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (value as any).constructor(value as any);
  }
  if (value instanceof ArrayBuffer) return (value as ArrayBuffer).slice(0);

  // Plain record — preserve prototype, copy only own enumerable string+symbol keys
  const out: Record<string, unknown> = {};
  seen.set(obj, out);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (UNSAFE_KEYS.has(key)) continue;
    out[key] = cloneValue((value as Record<string, unknown>)[key], seen);
  }
  for (const sym of Object.getOwnPropertySymbols(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, sym);
    if (desc?.enumerable) {
      // The symbol key is not statically known, so erasure is required to assign
      // through it on the generic clone output.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[sym] = cloneValue((value as any)[sym], seen);
    }
  }
  return out;
}

/** Builds fresh object copying exactly `fields` in declared order (deterministic
 *  key order for canonical hashing). Skips absent optional fields to preserve
 *  missing vs explicit undefined. Filters pollution keys. */
function recordClone<T extends object>(
  source: T,
  fields: readonly (keyof T)[],
  special: Partial<Record<keyof T, ValueClone>> = {},
  seen = new WeakMap<object, unknown>(),
): T {
  if (source === null || typeof source !== "object") {
    throw new PhaseEngineError({ message: "recordClone: source must be a non-null object" });
  }
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const key = field as string;
    if (UNSAFE_KEYS.has(key)) continue;
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    const value = (source as Record<string, unknown>)[key];
    const cloner = (special as Record<string, ValueClone>)[key];
    out[key] = cloner ? cloner(value, seen) : cloneValue(value, seen);
  }
  return out as T;
}

// Helper to enforce exhaustiveness at call-site: `fields<T>(...)` fails if any
// key of T is missing or an unknown key is present.
function fields<T>() {
  return <U extends readonly (keyof T)[]>(
    ...keys: U &
      (Exclude<keyof T, U[number]> extends never ? unknown : never) &
      (Exclude<U[number], keyof T> extends never ? unknown : never)
  ): U => keys;
}

const F = {
  Ship: fields<Ship>()(
    "id",
    "name",
    "classId",
    "nationId",
    "locationAreaId",
    "designVersionId",
    "hitPoints",
    "maxHitPoints",
    "speed",
    "firepower",
    "armor",
    "isUnderConstruction",
    "constructionProgress",
    "constructionTotalWork",
    "readiness",
    "crewQuality",
    "repairMonthsRemaining",
    "stationAssignment",
    "inBattleId",
    "availability",
    "availabilityProjectId",
  ),
  FleetState: fields<FleetState>()("id", "nationId", "name", "ships", "locationAreaId"),
  TechnologyProgress: fields<TechnologyProgress>()("techId", "investedPoints", "completed"),
  ResearchState: fields<ResearchState>()(
    "nationId",
    "technologies",
    "currentProjectTechId",
    "fieldPriorities",
    "researchBudget",
    "standingResearchBudget",
    "annualResearchAllocation",
    "activeCandidates",
    "discoveredTechs",
  ),
  PermanentDivision: fields<PermanentDivision>()(
    "divisionId",
    "nationId",
    "shipOrder",
    "flagshipShipId",
    "commanderOfficerId",
    "divisionRole",
    "preferredFormation",
    "experience",
    "cohesion",
    "locationAreaId",
    "creationMonth",
    "lastReorganizationMonth",
    "provenanceRefs",
    "rulesetVersion",
    "aggregateHash",
  ),
  ConstructionProject: fields<ConstructionProject>()(
    "id",
    "type",
    "projectType",
    "targetId",
    "designVersionId",
    "totalWork",
    "completedWork",
    "paidWork",
    "status",
    "startedAt",
    "holdUntilMonth",
    "packages",
    "yardId",
    "monthUsage",
    "targetShipId",
    "nationalProfileId",
    "costMultiplierBp",
    "buildTimeMultiplierBp",
    "capacityUnits",
    "newConstructionReservedMassKg",
    "shipName",
    "batchId",
    "namedClassId",
    "batchOrdinal",
    "namePoolId",
    "namePoolOrdinal",
    "accelerationPremiumAppliedAtWorkPosition",
    "elapsedActiveMonths",
    "dockExpansionDurationMonths",
    "dockExpansionStepKg",
    "foreignContractId",
    "foreignBuilderNationId",
    "delayReasonCode",
  ),
  ConstructionMonthUsage: fields<ConstructionMonthUsage>()("month", "used", "startDone"),
  ConstructionPackage: fields<ConstructionPackage>()(
    "id",
    "kind",
    "line",
    "totalWork",
    "doneWork",
    "dependsOn",
  ),
  Officer: fields<Officer>()("id", "name", "rank", "skill"),
  DesignStudy: fields<DesignStudy>()(
    "designStudyId",
    "nationId",
    "builderContext",
    "baselineDesignVersionId",
    "designFamilyId",
    "newFamily",
    "derived",
    "failedCriteria",
    "baseStudyWork",
    "baseStudyCost",
    "discountBp",
    "finalStudyWork",
    "finalStudyCost",
    "workDone",
    "costPaid",
    "status",
    "startMonth",
    "completionMonth",
    "rulesetVersion",
    "formulaVersion",
    "projectHash",
    "design",
  ),
  ForeignConstructionContract: fields<ForeignConstructionContract>()(
    "contractId",
    "orderingNationId",
    "builderNationId",
    "builderShipyardId",
    "designVersionId",
    "quantity",
    "totalWorkPerUnit",
    "totalPriceUnits",
    "currencyUnit",
    "paymentSchedule",
    "capacityReservationSchedule",
    "authorizationMonth",
    "plannedKeelMonth",
    "plannedDeliveryMonth",
    "builderCapabilitySnapshotHash",
    "technologyTransferPolicyId",
    "warDelayPolicyId",
    "impoundmentPolicyId",
    "deliveryGuaranteeClauseId",
    "occupationDestructionPolicyId",
    "cancellationRefundPolicyId",
    "governingTreatyIds",
    "rulesetVersion",
    "formulaVersion",
    "contractHash",
  ),
  ForeignContractPaymentRecord: fields<ForeignContractPaymentRecord>()(
    "contractId",
    "paidDueMonths",
  ),
  ForeignInsightAwardRecord: fields<ForeignInsightAwardRecord>()(
    "contractId",
    "milestones",
    "awardedByFamily",
  ),
  ForeignContractImpoundmentRecord: fields<ForeignContractImpoundmentRecord>()(
    "contractId",
    "authorizingPredicate",
    "custodyNationId",
    "legalTitle",
    "paidAmountUnits",
    "unpaidAmountUnits",
    "compensationOrForfeiture",
    "projectStatus",
    "futureDeliveryEligible",
    "month",
  ),
  NationState: fields<NationState>()(
    "id",
    "name",
    "tag",
    "treasury",
    "income",
    "expenses",
    "baseResources",
    "navalAppropriationRateBp",
    "maintenanceCost",
    "prestige",
    "homeAreaId",
    "fleets",
    "divisions",
    "officers",
    "research",
    "constructionProjects",
    "dock",
    "dockExpansion",
    "designStudies",
    "procurementIntents",
    "foreignContracts",
    "foreignContractPayments",
    "foreignInsightAwards",
    "foreignContractImpoundments",
    "aircraft",
    "carrierOperations",
    "isPlayable",
    "isAI",
  ),
  DiplomaticRelation: fields<DiplomaticRelation>()(
    "nationA",
    "nationB",
    "relation",
    "tension",
    "nap",
    "since",
  ),
  PoliticalState: fields<PoliticalState>()("relations", "shells"),
  IntelligenceState: fields<IntelligenceState>()("shells"),
  AreaData: fields<AreaData>()("id", "name", "type", "controller"),
  RouteData: fields<RouteData>()("id", "from", "to", "type", "distance"),
  PortData: fields<PortData>()("id", "name", "areaId", "nationId", "level"),
  PossessionData: fields<PossessionData>()("id", "nationId", "areaId"),
  WorldState: fields<WorldState>()("areas", "routes", "ports", "technologies", "possessions"),
  TechnologyDefinitionData: fields<TechnologyDefinitionData>()(
    "techId",
    "researchFieldId",
    "cost",
    "discoveryWeight",
    "prerequisites",
    "availabilityMonth",
  ),
  WarDeclaration: fields<WarDeclaration>()(
    "id",
    "attackerSideId",
    "defenderSideId",
    "attackerSideMembers",
    "defenderSideMembers",
    "attackerWarScore",
    "defenderWarScore",
    "attackerId",
    "defenderId",
    "startDate",
    "status",
    "endDate",
  ),
  WarParticipantMembership: fields<WarParticipantMembership>()(
    "warId",
    "nationId",
    "sideId",
    "entryMonth",
    "exitMonth",
    "status",
    "nationalContributionPoints",
  ),
  BlockadeState: fields<BlockadeState>()(
    "blockaderId",
    "blockadedNationId",
    "areaId",
    "establishedMonth",
  ),
  BattleInstance: fields<BattleInstance>()(
    "id",
    "phase",
    "attackerId",
    "defenderId",
    "areaId",
    "attackerFleetIds",
    "defenderFleetIds",
    "manifestHash",
    "result",
  ),
  BattleResult: fields<BattleResult>()(
    "winnerId",
    "loserId",
    "attackerLosses",
    "defenderLosses",
    "damageReport",
    "explanation",
    "lostShips",
  ),
  BattleManifest: fields<BattleManifest>()(
    "battleId",
    "opportunityId",
    "warId",
    "areaId",
    "missionType",
    "attackerId",
    "defenderId",
    "acceptanceClass",
    "missionObjectives",
    "sides",
    "persistentAssets",
    "temporaryAssets",
    "permanentDivisionIds",
    "tacticalDivisions",
    "commanders",
    "weather",
    "seaState",
    "visibility",
    "environment",
    "sourceStateHashes",
    "reservations",
    "autoResolutionProof",
    "provenanceRecords",
    "battleSeed",
    "rulesetVersion",
    "formulaVersion",
    "aiPolicyVersion",
    "rngVersion",
    "contentVersion",
    "manifestHash",
  ),
  BattleManifestSide: fields<BattleManifestSide>()("sideId", "participantIds"),
  WarState: fields<WarState>()(
    "wars",
    "battles",
    "participantMemberships",
    "blockadeState",
    "battleManifests",
  ),
  CampaignSlot: fields<CampaignSlot>()("nationId", "type"),
  CompiledDesignVersion: fields<CompiledDesignVersion>()(
    "designVersionId",
    "designFamilyId",
    "className",
    "nationId",
    "hullType",
    "normalizedDisplacementKg",
    "normalizedSpeedUms",
    "normalizedArmorUm",
    "hitPoints",
    "mainGunsCaliber",
    "mainGunsCount",
    "machineryType",
    "crewComplement",
    "contentVersion",
    "compiledHash",
    "armament",
    "torpedoArmament",
    "sourceDraft",
    "constructionCostUnits",
    "constructionPlan",
  ),
  DesignFamily: fields<DesignFamily>()(
    "designFamilyId",
    "nationId",
    "rootDesignVersionId",
    "memberDesignVersionIds",
    "familyCreationMonth",
  ),
  CampaignWeatherState: fields<CampaignWeatherState>()(
    "areaId",
    "month",
    "climateProfileId",
    "seasonId",
    "persistentWeatherStateId",
    "seaState",
    "windDirectionDeg",
    "windSpeedUmPerSec",
    "precipitationType",
    "precipitationIntensityBp",
    "fogMistDensityBp",
    "cloudCoverBp",
    "daylightProfileId",
    "glareEligible",
    "baseVisibilityUm",
    "generatedAtPhase",
    "rulesetVersion",
    "climateVersion",
    "formulaVersion",
    "rngVersion",
    "stateHash",
  ),
  CampaignSnapshot: fields<CampaignSnapshot>()(
    "version",
    "turnNumber",
    "campaignId",
    "startYear",
    "startMonth",
    "slots",
    "world",
    "nations",
    "wars",
    "politics",
    "intelligence",
    "designs",
    "designFamilies",
    "strategicWeather",
    "prestigeRules",
    "rulesetVersion",
    "compatibilityVersion",
  ),
} as const;

// Compile-time exhaustiveness assertions (redundant with fields<T>() but
// documents intent and survives `as const` widening). If any line errors,
// a field was added/renamed without updating F.
type _Assert<T, U extends readonly (keyof T)[]> =
  Exclude<keyof T, U[number]> extends never ? true : never;
const _assert: [
  _Assert<Ship, typeof F.Ship>,
  _Assert<FleetState, typeof F.FleetState>,
  _Assert<TechnologyProgress, typeof F.TechnologyProgress>,
  _Assert<ResearchState, typeof F.ResearchState>,
  _Assert<PermanentDivision, typeof F.PermanentDivision>,
  _Assert<ConstructionProject, typeof F.ConstructionProject>,
  _Assert<ConstructionPackage, typeof F.ConstructionPackage>,
  _Assert<ConstructionMonthUsage, typeof F.ConstructionMonthUsage>,
  _Assert<Officer, typeof F.Officer>,
  _Assert<NationState, typeof F.NationState>,
  _Assert<DiplomaticRelation, typeof F.DiplomaticRelation>,
  _Assert<PoliticalState, typeof F.PoliticalState>,
  _Assert<IntelligenceState, typeof F.IntelligenceState>,
  _Assert<AreaData, typeof F.AreaData>,
  _Assert<RouteData, typeof F.RouteData>,
  _Assert<PortData, typeof F.PortData>,
  _Assert<PossessionData, typeof F.PossessionData>,
  _Assert<WorldState, typeof F.WorldState>,
  _Assert<TechnologyDefinitionData, typeof F.TechnologyDefinitionData>,
  _Assert<WarDeclaration, typeof F.WarDeclaration>,
  _Assert<WarParticipantMembership, typeof F.WarParticipantMembership>,
  _Assert<BlockadeState, typeof F.BlockadeState>,
  _Assert<BattleInstance, typeof F.BattleInstance>,
  _Assert<BattleResult, typeof F.BattleResult>,
  _Assert<BattleManifest, typeof F.BattleManifest>,
  _Assert<BattleManifestSide, typeof F.BattleManifestSide>,
  _Assert<WarState, typeof F.WarState>,
  _Assert<CampaignSlot, typeof F.CampaignSlot>,
  _Assert<CompiledDesignVersion, typeof F.CompiledDesignVersion>,
  _Assert<DesignFamily, typeof F.DesignFamily>,
  _Assert<DesignStudy, typeof F.DesignStudy>,
  _Assert<ForeignConstructionContract, typeof F.ForeignConstructionContract>,
  _Assert<ForeignContractPaymentRecord, typeof F.ForeignContractPaymentRecord>,
  _Assert<ForeignInsightAwardRecord, typeof F.ForeignInsightAwardRecord>,
  _Assert<ForeignContractImpoundmentRecord, typeof F.ForeignContractImpoundmentRecord>,
  _Assert<CampaignWeatherState, typeof F.CampaignWeatherState>,
  _Assert<CampaignSnapshot, typeof F.CampaignSnapshot>,
] = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];
void _assert;

const cloneShip = (s: Ship): Ship => recordClone(s, F.Ship);
const cloneFleet = (f: FleetState): FleetState =>
  recordClone(f, F.FleetState, {
    ships: (v) => (v as Ship[]).map((x) => cloneShip(x as Ship)),
  });
const cloneTechnology = (t: TechnologyProgress): TechnologyProgress =>
  recordClone(t, F.TechnologyProgress);
const cloneResearch = (r: ResearchState): ResearchState =>
  recordClone(r, F.ResearchState, {
    technologies: (v) => (v as TechnologyProgress[]).map(cloneTechnology),
  });
const cloneDivision = (d: PermanentDivision): PermanentDivision =>
  recordClone(d, F.PermanentDivision);
const cloneConstructionPackage = (p: ConstructionPackage): ConstructionPackage =>
  recordClone(p, F.ConstructionPackage, {
    dependsOn: (v) => [...(v as string[])],
  });
const cloneMonthUsage = (u: ConstructionMonthUsage): ConstructionMonthUsage =>
  recordClone(u, F.ConstructionMonthUsage, {
    used: (v) => ({ ...(v as Record<string, SafeInt>) }),
    startDone: (v) => ({ ...(v as Record<string, SafeInt>) }),
  });
const cloneConstructionProject = (c: ConstructionProject): ConstructionProject =>
  recordClone(c, F.ConstructionProject, {
    packages: (v) =>
      v === undefined ? undefined : (v as ConstructionPackage[]).map(cloneConstructionPackage),
    monthUsage: (v) => (v === undefined ? undefined : cloneMonthUsage(v as ConstructionMonthUsage)),
    capacityUnits: (v) => (v === undefined ? undefined : { ...(v as Record<string, SafeInt>) }),
  });
const cloneDesignStudy = (st: DesignStudy): DesignStudy =>
  recordClone(st, F.DesignStudy, {
    failedCriteria: (v) => [...(v as string[])],
    design: (v) => cloneDesign(v as CompiledDesignVersion),
  });
const cloneForeignContract = (c: ForeignConstructionContract): ForeignConstructionContract =>
  recordClone(c, F.ForeignConstructionContract, {
    paymentSchedule: (v) =>
      (v as ForeignConstructionContract["paymentSchedule"]).map((i) => ({ ...i })),
    capacityReservationSchedule: (v) =>
      (v as ForeignConstructionContract["capacityReservationSchedule"]).map((r) => ({ ...r })),
    governingTreatyIds: (v) => [...(v as string[])],
  });
const cloneForeignContractPayment = (
  r: ForeignContractPaymentRecord,
): ForeignContractPaymentRecord =>
  recordClone(r, F.ForeignContractPaymentRecord, {
    paidDueMonths: (v) => [...(v as string[])],
  });
const cloneForeignInsightAward = (r: ForeignInsightAwardRecord): ForeignInsightAwardRecord =>
  recordClone(r, F.ForeignInsightAwardRecord, {
    milestones: (v) => [...(v as string[])],
    awardedByFamily: (v) => ({ ...(v as Record<string, number>) }),
  });
const cloneForeignContractImpoundment = (
  r: ForeignContractImpoundmentRecord,
): ForeignContractImpoundmentRecord => recordClone(r, F.ForeignContractImpoundmentRecord);
const cloneNation = (n: NationState): NationState =>
  recordClone(n, F.NationState, {
    fleets: (v) => (v as FleetState[]).map(cloneFleet),
    divisions: (v) => (v as PermanentDivision[]).map(cloneDivision),
    officers: (v) => (v === undefined ? undefined : (v as Officer[]).map((o) => ({ ...o }))),
    research: (v) => cloneResearch(v as ResearchState),
    constructionProjects: (v) => (v as ConstructionProject[]).map(cloneConstructionProject),
    designStudies: (v) =>
      v === undefined ? undefined : (v as DesignStudy[]).map(cloneDesignStudy),
    procurementIntents: (v) =>
      v === undefined
        ? undefined
        : (v as ProcurementIntent[]).map((p) => ({
            ...p,
            dockRequirement: p.dockRequirement === null ? null : { ...p.dockRequirement },
          })),
    foreignContracts: (v) =>
      v === undefined ? undefined : (v as ForeignConstructionContract[]).map(cloneForeignContract),
    foreignContractPayments: (v) =>
      v === undefined
        ? undefined
        : (v as ForeignContractPaymentRecord[]).map(cloneForeignContractPayment),
    foreignInsightAwards: (v) =>
      v === undefined
        ? undefined
        : (v as ForeignInsightAwardRecord[]).map(cloneForeignInsightAward),
    foreignContractImpoundments: (v) =>
      v === undefined
        ? undefined
        : (v as ForeignContractImpoundmentRecord[]).map(cloneForeignContractImpoundment),
  });
const cloneBattleResult = (r: BattleResult): BattleResult =>
  recordClone(r, F.BattleResult, {
    lostShips: (v) =>
      v === undefined
        ? undefined
        : (v as NonNullable<BattleResult["lostShips"]>).map((s) => ({ ...s })),
  });
const cloneBattle = (b: BattleInstance): BattleInstance =>
  recordClone(b, F.BattleInstance, {
    result: (v) => (v === undefined ? undefined : cloneBattleResult(v as BattleResult)),
  });
const cloneManifest = (m: BattleManifest): BattleManifest =>
  recordClone(m, F.BattleManifest, {
    sides: (v) =>
      (v as BattleManifestSide[]).map((side) => recordClone(side, F.BattleManifestSide)),
  });
const cloneWeather = (w: CampaignWeatherState): CampaignWeatherState =>
  recordClone(w, F.CampaignWeatherState);
const cloneDesign = (d: CompiledDesignVersion): CompiledDesignVersion =>
  recordClone(d, F.CompiledDesignVersion);
const cloneDesignFamily = (d: DesignFamily): DesignFamily => recordClone(d, F.DesignFamily);
const cloneDesigns = (designs: CampaignSnapshot["designs"]): CampaignSnapshot["designs"] => {
  if (designs instanceof Map)
    return new Map([...designs].map(([id, d]) => [id, cloneDesign(d as CompiledDesignVersion)]));
  throw new PhaseEngineError({ message: "cloneSnapshot: designs must be a Map" });
};
const cloneDesignFamilies = (
  designFamilies: CampaignSnapshot["designFamilies"],
): CampaignSnapshot["designFamilies"] => {
  if (designFamilies instanceof Map)
    return new Map(
      [...designFamilies].map(([id, d]) => [id, cloneDesignFamily(d as DesignFamily)]),
    );
  throw new PhaseEngineError({ message: "cloneSnapshot: designFamilies must be a Map" });
};

/**
 * Structural deep-clone of the campaign snapshot. Produces fully disjoint
 * graph — no shared reference with input, no shared reference between
 * consecutive turns. Deterministic, no RNG/IO, preserves missing vs undefined.
 */
export function cloneSnapshot(snapshot: CampaignSnapshot): CampaignSnapshot {
  if (snapshot === null || typeof snapshot !== "object")
    throw new PhaseEngineError({ message: "cloneSnapshot: snapshot must be a non-null object" });
  const seen = new WeakMap<object, unknown>();
  return recordClone(
    snapshot,
    F.CampaignSnapshot,
    {
      slots: (v) => (v as CampaignSlot[]).map((s) => recordClone(s, F.CampaignSlot, {}, seen)),
      world: (v) =>
        recordClone(
          v as WorldState,
          F.WorldState,
          {
            areas: (areas) =>
              (areas as AreaData[]).map((a) => recordClone(a, F.AreaData, {}, seen)),
            routes: (routes) =>
              (routes as RouteData[]).map((r) => recordClone(r, F.RouteData, {}, seen)),
            ports: (ports) =>
              (ports as PortData[]).map((p) => recordClone(p, F.PortData, {}, seen)),
            technologies: (technologies) =>
              technologies === undefined
                ? undefined
                : (technologies as TechnologyDefinitionData[]).map((t) =>
                    recordClone(
                      t,
                      F.TechnologyDefinitionData,
                      { prerequisites: (p) => [...(p as string[])] },
                      seen,
                    ),
                  ),
            possessions: (possessions) =>
              possessions === undefined
                ? undefined
                : (possessions as PossessionData[]).map((p) =>
                    recordClone(p, F.PossessionData, {}, seen),
                  ),
          },
          seen,
        ),
      nations: (v) => {
        if (!(v instanceof Map))
          throw new PhaseEngineError({ message: "cloneSnapshot: nations must be a Map" });
        return new Map([...(v as Map<string, NationState>)].map(([id, n]) => [id, cloneNation(n)]));
      },
      wars: (v) =>
        recordClone(
          v as WarState,
          F.WarState,
          {
            wars: (wars) =>
              (wars as WarDeclaration[]).map((w) => recordClone(w, F.WarDeclaration, {}, seen)),
            battles: (battles) => (battles as BattleInstance[]).map(cloneBattle),
            participantMemberships: (memberships) =>
              (memberships as WarParticipantMembership[]).map((m) =>
                recordClone(m, F.WarParticipantMembership, {}, seen),
              ),
            blockadeState: (state) =>
              (state as BlockadeState[]).map((b) => recordClone(b, F.BlockadeState, {}, seen)),
            battleManifests: (manifests) =>
              manifests === undefined
                ? undefined
                : (manifests as BattleManifest[]).map(cloneManifest),
          },
          seen,
        ),
      politics: (v) =>
        recordClone(
          v as PoliticalState,
          F.PoliticalState,
          {
            relations: (relations) =>
              (relations as DiplomaticRelation[]).map((r) =>
                recordClone(r, F.DiplomaticRelation, {}, seen),
              ),
          },
          seen,
        ),
      intelligence: (v) => recordClone(v as IntelligenceState, F.IntelligenceState, {}, seen),
      designs: (v) => cloneDesigns(v as CampaignSnapshot["designs"]),
      designFamilies: (v) => cloneDesignFamilies(v as CampaignSnapshot["designFamilies"]),
      strategicWeather: (v) =>
        v === undefined ? undefined : (v as CampaignWeatherState[]).map(cloneWeather),
    },
    seen,
  );
}

/** Audit surface: type name → ordered field list. Frozen to prevent tampering. */
export const CLONE_COVERAGE: Readonly<Record<string, readonly string[]>> = (() => {
  const entries = Object.entries(F).map(
    ([k, v]) => [k, Object.freeze([...(v as readonly string[])])] as const,
  );
  return Object.freeze(Object.fromEntries(entries)) as Readonly<Record<string, readonly string[]>>;
})();
