import type { CompiledDesignVersion, NationState, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";

export function makeDesign(overrides: Partial<CompiledDesignVersion> = {}): CompiledDesignVersion {
  return {
    designVersionId: "des_test_dreadnought",
    designFamilyId: "fam_test",
    className: "Test Dreadnought",
    nationId: "gb",
    hullType: "dreadnought",
    normalizedDisplacementKg: SafeInt(18_000_000),
    normalizedSpeedUms: SafeInt(11 * 514_444),
    normalizedArmorUm: SafeInt(305_000),
    hitPoints: SafeInt(90),
    mainGunsCaliber: SafeInt(305_000),
    mainGunsCount: SafeInt(10),
    machineryType: "steam_turbine",
    crewComplement: SafeInt(810),
    contentVersion: "0.3.0",
    compiledHash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    ...overrides,
  };
}

export function makeShip(
  overrides: Partial<Ship> = {},
  { designVersionId = "des_test_dreadnought" }: { designVersionId?: string } = {},
): Ship {
  return {
    id: "ship_1",
    name: "HMS Test",
    classId: "DesTest",
    nationId: "gb",
    locationAreaId: "area_north_sea",
    designVersionId,
    hitPoints: SafeInt(90),
    maxHitPoints: SafeInt(90),
    speed: SafeInt(11),
    firepower: SafeInt(50),
    armor: SafeInt(30),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    inBattleId: undefined,
    ...overrides,
  };
}

export function makeNation(
  id: string,
  overrides: Partial<NationState> & { ships?: Ship[] } = {},
): NationState {
  return {
    id,
    name: id.toUpperCase(),
    tag: id,
    treasury: SafeInt(500),
    income: SafeInt(100),
    expenses: SafeInt(50),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: overrides.ships
      ? [
          {
            id: `${id}_fleet`,
            nationId: id,
            name: `${id} Fleet`,
            locationAreaId: "area_north_sea",
            ships: overrides.ships,
          },
        ]
      : [],
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
    ...overrides,
  };
}
