import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionPackage,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { LINE_IDS } from "@bluewave/ship-design";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

export const capacity = (perLine: number): Record<string, SafeInt> =>
  Object.fromEntries(LINE_IDS.map((line) => [line, SafeInt(perLine)]));

export function packages(): ConstructionPackage[] {
  return LINE_IDS.map((line, index) => ({
    id: `pkg-${String(index)}`,
    kind: "HULL",
    line,
    totalWork: SafeInt(100),
    doneWork: SafeInt(0),
    dependsOn: [],
  }));
}

export interface ProjectOverrides {
  readonly id?: string;
  readonly status?: ConstructionProject["status"];
  readonly projectType?: ConstructionProject["projectType"];
  readonly totalWork?: number;
  readonly completedWork?: number;
  readonly designVersionId?: string;
  readonly withPackages?: boolean;
}

export function project(over: ProjectOverrides = {}): ConstructionProject {
  const withPackages = over.withPackages ?? false;
  const pkgList = withPackages ? packages() : undefined;
  const totalWork = over.totalWork ?? (withPackages ? 600 : 200);
  return {
    id: over.id ?? "proj-1",
    type: "ship",
    projectType: over.projectType ?? "NEW_CONSTRUCTION",
    targetId: "ship-x",
    designVersionId: over.designVersionId ?? "",
    totalWork: SafeInt(totalWork),
    completedWork: SafeInt(over.completedWork ?? 0),
    paidWork: SafeInt(0),
    status: over.status ?? "ACTIVE",
    startedAt: "1880-01",
    ...(pkgList === undefined ? {} : { packages: pkgList }),
  };
}

export function design(id = "d1", perLine = 10): CompiledDesignVersion {
  return {
    designVersionId: id,
    designFamilyId: "fam",
    className: "Test",
    nationId: "GBR",
    hullType: "DD",
    normalizedDisplacementKg: SafeInt(1_000_000),
    normalizedSpeedUms: SafeInt(10_000_000),
    normalizedArmorUm: SafeInt(0),
    hitPoints: SafeInt(100),
    mainGunsCaliber: SafeInt(0),
    mainGunsCount: SafeInt(0),
    machineryType: "steam",
    crewComplement: SafeInt(10),
    contentVersion: "t",
    compiledHash: "h",
    constructionCostUnits: SafeInt(600),
    constructionPlan: { yardId: "yard_small", packages: [], capacityUnits: capacity(perLine) },
  };
}

export function nation(
  projects: ConstructionProject[],
  baseResources = 0,
  treasury = 1_000,
): NationState {
  return {
    prestige: SafeInt(20),
    id: "GBR",
    name: "Great Britain",
    tag: "GBR",
    treasury: SafeInt(treasury),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(baseResources),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: projects,
    isPlayable: true,
    isAI: false,
  };
}

export function snapshot(
  projects: ConstructionProject[],
  designs: Map<string, CompiledDesignVersion> = new Map(),
  baseResources = 0,
  treasury = 1_000,
): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "acceleration-pressure",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", nation(projects, baseResources, treasury)]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs,
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "1.2.0",
  };
}
