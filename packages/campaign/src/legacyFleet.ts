import type { CompiledContentBundle, CampaignFleet, ContentPack } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { compareCodePoints, hashWithContext } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  allocateShipNames,
  buildShipBuildingContent,
  compileDesign,
  dockRecordFor,
  HULL_TYPE_FOR_SHIP_TYPE,
  newConstructionDockEligibility,
  planProcurementDecision,
  PROCUREMENT_TYPES,
  shipTypeForHullType,
  starterFor,
  type DesignDraft,
  type FleetShipView,
  type NationNavalProfile,
  type ShipBuildingContent,
  type ShipTypeId,
} from "@bluewave/ship-design";
import type { CampaignFileData } from "./campaignInput.js";
import { buildDesignVersion, pricingFor, shipStatsFromDesign } from "./designVersion.js";
import { deriveEconomicBase, monthlyRevenue, START_APPROPRIATION_RATE_BP } from "./economy.js";
import {
  LEGACY_FLEET_ATTEMPT_LIMIT,
  LEGACY_FLEET_BASE_COUNT,
  LEGACY_FLEET_CANDIDATE_COUNT,
  LEGACY_FLEET_COMPILES_PER_ARCHETYPE,
  LEGACY_FLEET_GENERATION_FAILED,
  LEGACY_FLEET_MAINTENANCE_SHARE_BP,
  LEGACY_FLEET_UNIT_BUDGET,
} from "./legacyFleetConstants.js";
import { shipMonthlyMaintenanceCost } from "./maintenance.js";
import { shipBuildingDataFromBundle } from "./shipBuildingData.js";
import type { CompiledDesignVersion, DesignFamily } from "./state.js";

export type LegacyFleetStop = "target_met" | "maintenance_ceiling";

export interface LegacyFleetNationReport {
  readonly nationId: string;
  readonly baseCount: number;
  readonly generated: number;
  readonly fallbacks: number;
  readonly attempts: number;
  readonly skippedRoles: readonly ShipTypeId[];
  readonly roles: Readonly<Record<string, number>>;
  readonly maintenance: number;
  readonly maintenanceCeiling: number;
  readonly stoppedBy: LegacyFleetStop;
}

export interface LegacyFleetReport {
  readonly campaignSeed: string;
  readonly scaleBp: number;
  readonly nations: readonly LegacyFleetNationReport[];
}

export interface LegacyFleetInput {
  readonly campaignSeed: string;
  readonly scaleBp: number;
}

export interface LegacyFleetResult {
  readonly fleets: readonly CampaignFleet[];
  readonly designs: readonly CompiledDesignVersion[];
  readonly families: readonly DesignFamily[];
  readonly report: LegacyFleetReport;
}

export interface GenerateLegacyFleetsArgs extends LegacyFleetInput {
  readonly pack: ContentPack;
  readonly bundle: CompiledContentBundle;
  readonly data: CampaignFileData;
  readonly month: string;
  readonly rulesetVersion: string;
  readonly collector: DiagnosticCollector;
  readonly nationIds?: readonly string[];
}

interface Accepted {
  readonly draft: DesignDraft;
  readonly design: CompiledDesignVersion;
  readonly naturalClass: string;
  readonly fallback: boolean;
}

export function legacyFleetBaseCount(scaleBp: number): number {
  return Math.floor((LEGACY_FLEET_BASE_COUNT * scaleBp) / 10_000);
}

function sortedUnique<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort(compareCodePoints);
}

function historicalViews(
  nationId: string,
  data: CampaignFileData,
): { views: FleetShipView[]; names: string[]; hitPoints: SafeInt[] } {
  const hullOf = new Map(data.designs.map((d) => [d.designVersionId, d.hullType]));
  const views: FleetShipView[] = [];
  const names: string[] = [];
  const hitPoints: SafeInt[] = [];
  for (const fleet of data.fleets) {
    if (fleet.nationId !== nationId) continue;
    for (const ship of fleet.ships) {
      names.push(ship.name);
      if (!ship.isUnderConstruction) hitPoints.push(SafeInt(ship.hitPoints));
      const hull =
        ship.designVersionId === undefined ? undefined : hullOf.get(ship.designVersionId);
      const type = hull === undefined ? null : shipTypeForHullType(hull);
      if (type === null) continue;
      views.push({ shipType: type, status: ship.isUnderConstruction ? "BUILDING" : "ACTIVE" });
    }
  }
  return { views, names, hitPoints };
}

function maintenanceCeiling(data: CampaignFileData, nationId: string): number {
  const income = data.economies.find((e) => e.nationId === nationId)?.income ?? 0;
  if (income <= 0) return 0;
  const revenue = monthlyRevenue(
    deriveEconomicBase(SafeInt(income), SafeInt(START_APPROPRIATION_RATE_BP)),
    SafeInt(START_APPROPRIATION_RATE_BP),
  );
  return Math.floor((revenue * LEGACY_FLEET_MAINTENANCE_SHARE_BP) / 10_000);
}

function acceptDraft(
  draft: DesignDraft,
  role: ShipTypeId,
  ordinal: number,
  nationId: string,
  profile: NationNavalProfile,
  content: ShipBuildingContent,
  month: string,
  rulesetVersion: string,
  fallback: boolean,
): Accepted | undefined {
  const env = content.environmentFor(month, nationId);
  const compiled = compileDesign(draft, env.ctx);
  if (!compiled.valid || compiled.findings.some((f) => f.severity === "BLOCKING")) return undefined;
  const designVersionId = `des_${nationId}_gen_${String(ordinal)}`;
  const design = buildDesignVersion(
    compiled,
    draft,
    {
      designVersionId,
      designFamilyId: `fam_${designVersionId}`,
      className: `Generated ${role} ${String(ordinal)}`,
      hullType: HULL_TYPE_FOR_SHIP_TYPE[role as keyof typeof HULL_TYPE_FOR_SHIP_TYPE],
      machineryType: draft.machinery.plantId,
      contentVersion: rulesetVersion,
      kgPerHitPoint: content.kgPerHitPoint,
    },
    pricingFor(content, month),
  );
  const dock = newConstructionDockEligibility(dockRecordFor(profile), {
    lengthMm: 0,
    beamMm: 0,
    displacementKg: Number(design.normalizedDisplacementKg),
    heaviestKg: 0,
  });
  if (!dock.eligible) return undefined;
  return { draft, design, naturalClass: compiled.naturalClass ?? "", fallback };
}

interface NationRun {
  readonly fleet: CampaignFleet | undefined;
  readonly designs: CompiledDesignVersion[];
  readonly families: DesignFamily[];
  readonly report: LegacyFleetNationReport;
}

function generateForNation(
  args: GenerateLegacyFleetsArgs,
  content: ShipBuildingContent,
  nationId: string,
  homeAreaId: string | undefined,
  profile: NationNavalProfile,
): NationRun {
  const { data, month, collector } = args;
  const baseCount = legacyFleetBaseCount(args.scaleBp);
  const seed = hashWithContext(`legacy_fleet/nation/${nationId}`, args.campaignSeed);
  const history = historicalViews(nationId, data);
  const fleetViews: FleetShipView[] = [...history.views];
  const skip = new Set<ShipTypeId>(
    PROCUREMENT_TYPES.filter(
      (t) => starterFor(t, content.starterDesigns, month, nationId) === null,
    ),
  );
  const startingSkips = sortedUnique(skip);
  const ceiling = maintenanceCeiling(data, nationId);
  let maintenance = history.hitPoints.reduce(
    (sum, hp) => sum + Number(shipMonthlyMaintenanceCost(hp, "ACTIVE", false)),
    0,
  );
  const ships: CampaignFleet["ships"][number][] = [];
  const designs: CompiledDesignVersion[] = [];
  const families: DesignFamily[] = [];
  const roles: Record<string, number> = {};
  const recentClassIds: string[] = [];
  const takenNames = [...history.names];
  let attempts = 0;
  let fallbacks = 0;
  let stoppedBy: LegacyFleetStop = "target_met";
  let ordinal = 0;

  const plan = (decisionId: string) =>
    planProcurementDecision({
      profile,
      month,
      seed,
      decisionId,
      budgetUnits: LEGACY_FLEET_UNIT_BUDGET,
      fleet: fleetViews,
      content,
      starters: content.starterDesigns,
      recentClassIds,
      candidateCount: LEGACY_FLEET_CANDIDATE_COUNT,
      compilesPerArchetype: LEGACY_FLEET_COMPILES_PER_ARCHETYPE,
      baseCount,
      skipRoles: [...skip],
    });

  const iterationBound = baseCount + PROCUREMENT_TYPES.length;
  for (let iteration = 0; iteration < iterationBound; iteration++) {
    const first = plan(`${nationId}:gen:${String(ordinal + 1)}:0`);
    const role = first.role;
    if (role === null) break;
    const next = ordinal + 1;
    let accepted: Accepted | undefined;
    for (
      let attempt = 0;
      attempt < LEGACY_FLEET_ATTEMPT_LIMIT && accepted === undefined;
      attempt++
    ) {
      attempts += 1;
      const decision =
        attempt === 0 ? first : plan(`${nationId}:gen:${String(next)}:${String(attempt)}`);
      if (decision.selectedDraft === null) continue;
      accepted = acceptDraft(
        decision.selectedDraft,
        role,
        next,
        nationId,
        profile,
        content,
        month,
        args.rulesetVersion,
        false,
      );
    }
    if (accepted === undefined) {
      const starter = starterFor(role, content.starterDesigns, month, nationId);
      if (starter !== null)
        accepted = acceptDraft(
          starter.draft,
          role,
          next,
          nationId,
          profile,
          content,
          month,
          args.rulesetVersion,
          true,
        );
    }
    if (accepted === undefined) {
      collector.addError(
        LEGACY_FLEET_GENERATION_FAILED,
        `Legacy fleet of nation '${nationId}' could not field a legal ${role}: ${String(LEGACY_FLEET_ATTEMPT_LIMIT)} procurement attempts and the starter fallback all failed legality, availability or dock limits`,
        { stage: "legacy-fleet", entityId: nationId },
      );
      skip.add(role);
      continue;
    }

    const stats = shipStatsFromDesign(accepted.design);
    const upkeep = Number(shipMonthlyMaintenanceCost(SafeInt(stats.hitPoints), "ACTIVE", false));
    if (maintenance + upkeep > ceiling) {
      stoppedBy = "maintenance_ceiling";
      break;
    }
    maintenance += upkeep;
    if (accepted.fallback) fallbacks += 1;
    ordinal = next;

    const stems = profile.namingPolicy.stems[role] ?? [];
    const naming = allocateShipNames({
      pool: { poolId: `name_pool:${nationId}:${role}`, stems },
      count: 1,
      taken: takenNames,
      placeholderStem: accepted.design.className,
    });
    const name = naming.allocations[0]?.name ?? `${accepted.design.className}`;
    takenNames.push(name);
    ships.push({
      id: `${nationId}_gen_${String(ordinal)}`,
      name,
      classId: stats.className,
      designVersionId: accepted.design.designVersionId,
      hitPoints: stats.hitPoints,
      maxHitPoints: stats.maxHitPoints,
      speed: stats.speed,
      firepower: stats.firepower,
      armor: stats.armor,
      isUnderConstruction: false,
      constructionProgress: 0,
      constructionTotalWork: 0,
    });
    designs.push(accepted.design);
    families.push({
      designFamilyId: accepted.design.designFamilyId,
      nationId,
      rootDesignVersionId: accepted.design.designVersionId,
      memberDesignVersionIds: [accepted.design.designVersionId],
      familyCreationMonth: month,
    });
    fleetViews.push({ shipType: role, status: "ACTIVE" });
    recentClassIds.push(accepted.naturalClass);
    roles[role] = (roles[role] ?? 0) + 1;
  }

  const location = data.fleets.find((f) => f.nationId === nationId)?.locationAreaId ?? homeAreaId;
  const fleet: CampaignFleet | undefined =
    ships.length === 0 || location === undefined
      ? undefined
      : {
          id: `fleet_${nationId}_generated`,
          nationId,
          name: "Reserve Squadron",
          locationAreaId: location,
          ships,
        };
  return {
    fleet,
    designs,
    families,
    report: {
      nationId,
      baseCount,
      generated: ships.length,
      fallbacks,
      attempts,
      skippedRoles: startingSkips,
      roles,
      maintenance,
      maintenanceCeiling: ceiling,
      stoppedBy,
    },
  };
}

export function generateLegacyFleets(
  args: GenerateLegacyFleetsArgs,
): LegacyFleetResult | undefined {
  const shipBuilding = shipBuildingDataFromBundle(args.bundle);
  if (shipBuilding === undefined) {
    args.collector.addError(
      LEGACY_FLEET_GENERATION_FAILED,
      "Legacy fleet generation needs the ship-building catalogue, which the content bundle does not carry",
      { stage: "legacy-fleet" },
    );
    return undefined;
  }
  const content = buildShipBuildingContent(shipBuilding);
  const fleets: CampaignFleet[] = [];
  const designs: CompiledDesignVersion[] = [];
  const families: DesignFamily[] = [];
  const nations: LegacyFleetNationReport[] = [];
  const wanted = args.nationIds === undefined ? undefined : new Set(args.nationIds);
  const candidates = [...args.pack.nations]
    .filter((n) => n.isPlayable && (wanted === undefined || wanted.has(n.id)))
    .sort((a, b) => compareCodePoints(a.id, b.id));
  for (const nation of candidates) {
    const profile = content.navalProfileFor(nation.id, args.month);
    if (profile === null) continue;
    const run = generateForNation(args, content, nation.id, nation.homeArea, profile);
    if (run.fleet !== undefined) fleets.push(run.fleet);
    designs.push(...run.designs);
    families.push(...run.families);
    nations.push(run.report);
  }
  return {
    fleets,
    designs,
    families,
    report: { campaignSeed: args.campaignSeed, scaleBp: args.scaleBp, nations },
  };
}
