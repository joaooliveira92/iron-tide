import { SafeInt } from "@bluewave/contracts";
import type {
  CampaignSnapshot,
  CampaignState,
  CompiledDesignVersion,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";

/**
 * Hand-built fixtures for `campaign-engine`'s pure projection/configuration
 * helpers. These functions consume plain `CampaignSnapshot`/`CampaignState`
 * data — they don't need a real compiler run, so tests build the minimal
 * shape directly rather than paying for a full YAML-fixture compile.
 */

export function fixtureNation(overrides: Partial<NationState> & { id: string }): NationState {
  const { id, ...rest } = overrides;
  return {
    id,
    name: id,
    tag: id.toUpperCase(),
    treasury: SafeInt(0),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
    ...rest,
  };
}

export function fixtureConstructionProject(
  overrides: Partial<ConstructionProject> = {},
): ConstructionProject {
  return {
    id: "con-1",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "target-1",
    designVersionId: "design-1",
    totalWork: SafeInt(100),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status: "PLANNED",
    startedAt: "1880-01",
    ...overrides,
  };
}

export function fixtureDesign(
  nationId: string,
  designVersionId: string,
  overrides: Partial<CompiledDesignVersion> = {},
): CompiledDesignVersion {
  return {
    designVersionId,
    designFamilyId: `${designVersionId}-family`,
    className: "Test Class",
    nationId,
    hullType: "battleship",
    normalizedDisplacementKg: SafeInt(0),
    normalizedSpeedUms: SafeInt(0),
    normalizedArmorUm: SafeInt(0),
    hitPoints: SafeInt(100),
    mainGunsCaliber: SafeInt(0),
    mainGunsCount: SafeInt(0),
    machineryType: "steam",
    crewComplement: SafeInt(0),
    contentVersion: "0.1.0",
    compiledHash: "hash",
    ...overrides,
  };
}

export function fixtureSnapshot(
  nations: NationState[],
  designs: CompiledDesignVersion[] = [],
  overrides: Partial<CampaignSnapshot> = {},
): CampaignSnapshot {
  const nationsMap = new Map(nations.map((n) => [n.id, n]));
  const designsMap = new Map(designs.map((d) => [d.designVersionId, d]));
  return {
    version: "0.1.0",
    turnNumber: SafeInt(0),
    campaignId: "campaign-test",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: nations.map((n) => ({ nationId: n.id, type: n.isPlayable ? "playable" : "ai" })),
    world: { areas: [], routes: [], ports: [] },
    nations: nationsMap,
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: designsMap,
    designFamilies: new Map(),
    rulesetVersion: "1.0",
    compatibilityVersion: "1.2.0",
    ...overrides,
  };
}

export function fixtureState(snapshot: CampaignSnapshot, rawHash = "raw-hash"): CampaignState {
  return {
    snapshot,
    envelope: {
      algorithm: "sha256",
      artifactKind: "campaign-snapshot",
      compatibilityVersion: snapshot.compatibilityVersion,
      bodyHash: "body-hash",
      bodyLength: 0,
    },
    rawHash,
  };
}
