import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  DesignFamily,
  NationState,
} from "../src/state.js";
import {
  UNIFIED_SNAPSHOT_HASH_CONTEXT,
  missingSnapshotHashFields,
  unifiedSnapshotHash,
} from "../src/snapshotHash.js";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";

const PRESTIGE_RULES = {
  lowerBound: SafeInt(0),
  upperBound: SafeInt(100),
  sackingThreshold: SafeInt(10),
  sackingProbabilityBp: SafeInt(2_500),
  rules: {
    UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS" as const, basisPoints: SafeInt(300) },
    BATTLE_LOST: { kind: "PROPORTIONAL_LOSS" as const, basisPoints: SafeInt(500) },
    BATTLE_WON: { kind: "FIXED_GAIN" as const, amount: SafeInt(1) },
  },
};

function nation(activeCandidates: Map<string, string>): NationState {
  return {
    id: "uk",
    name: "United Kingdom",
    tag: "GBR",
    treasury: SafeInt(100),
    income: SafeInt(10),
    expenses: SafeInt(5),
    baseResources: SafeInt(10),
    navalAppropriationRateBp: SafeInt(1_000),
    maintenanceCost: SafeInt(1),
    prestige: SafeInt(20),
    fleets: [],
    divisions: [],
    research: {
      nationId: "uk",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates,
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  };
}

function design(id: string): CompiledDesignVersion {
  return {
    designVersionId: id,
    designFamilyId: "family-a",
    className: "A",
    nationId: "uk",
    hullType: "battleship",
    normalizedDisplacementKg: SafeInt(1_000),
    normalizedSpeedUms: SafeInt(1_000),
    normalizedArmorUm: SafeInt(1_000),
    hitPoints: SafeInt(10),
    mainGunsCaliber: SafeInt(10),
    mainGunsCount: SafeInt(4),
    machineryType: "steam",
    crewComplement: SafeInt(100),
    contentVersion: "0.1.0",
    compiledHash: "a".repeat(64),
  };
}

function family(id: string): DesignFamily {
  return {
    designFamilyId: id,
    nationId: "uk",
    rootDesignVersionId: "design-a",
    memberDesignVersionIds: ["design-a"],
    familyCreationMonth: "1880-01",
  };
}

function snapshot(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    version: "0.1.0",
    turnNumber: SafeInt(0),
    campaignId: "campaign-test",
    startYear: 1880,
    startMonth: 1,
    slots: [{ nationId: "uk", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["uk", nation(new Map([["torpedo", "tech-a"]]))]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map([["design-a", design("design-a")]]),
    designFamilies: new Map([["family-a", family("family-a")]]),
    strategicWeather: [],
    prestigeRules: PRESTIGE_RULES,
    rulesetVersion: "1.0.0",
    compatibilityVersion: "4.0.0",
    ...overrides,
  };
}

describe("unified snapshot hash", () => {
  it("is stable for the same snapshot and carries an explicit version and domain", () => {
    const first = snapshot();
    expect(unifiedSnapshotHash(first)).toBe(unifiedSnapshotHash(snapshot()));
    expect(UNIFIED_SNAPSHOT_HASH_CONTEXT).toBe("bluewave/campaign/snapshot/v1");
  });

  it("changes when a Map-backed nation field changes", () => {
    const changed = snapshot({
      nations: new Map([
        ["uk", { ...nation(new Map([["torpedo", "tech-a"]])), treasury: SafeInt(101) }],
      ]),
    });
    expect(unifiedSnapshotHash(changed)).not.toBe(unifiedSnapshotHash(snapshot()));
  });

  it("changes when a design changes", () => {
    const changed = snapshot({
      designs: new Map([["design-a", { ...design("design-a"), hitPoints: SafeInt(11) }]]),
    });
    expect(unifiedSnapshotHash(changed)).not.toBe(unifiedSnapshotHash(snapshot()));
  });

  it("changes when a design family changes", () => {
    const changed = snapshot({
      designFamilies: new Map([
        ["family-a", { ...family("family-a"), memberDesignVersionIds: ["design-a", "design-b"] }],
      ]),
    });
    expect(unifiedSnapshotHash(changed)).not.toBe(unifiedSnapshotHash(snapshot()));
  });

  it("changes when active research candidates change", () => {
    const changed = snapshot({
      nations: new Map([["uk", nation(new Map([["torpedo", "tech-b"]]))]]),
    });
    expect(unifiedSnapshotHash(changed)).not.toBe(unifiedSnapshotHash(snapshot()));
  });

  it("changes when prestige rules or the player nation change", () => {
    const prestige = snapshot({
      prestigeRules: { ...PRESTIGE_RULES, sackingThreshold: SafeInt(11) },
    });
    const playerNation = snapshot({
      slots: [{ nationId: "france", type: "playable" }],
    });
    const base = unifiedSnapshotHash(snapshot());
    expect(unifiedSnapshotHash(prestige)).not.toBe(base);
    expect(unifiedSnapshotHash(playerNation)).not.toBe(base);
  });
});

describe("snapshot hash completeness guard", () => {
  it("covers every field of the authoritative snapshot", () => {
    expect(missingSnapshotHashFields(snapshot())).toEqual([]);
  });

  it("names a field that the hash subject does not cover", () => {
    const extended = { ...snapshot(), futureAuthority: 1 } as CampaignSnapshot;
    expect(missingSnapshotHashFields(extended)).toEqual(["futureAuthority"]);
  });
});
