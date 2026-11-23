import type { BattleManifest } from "@bluewave/campaign";
import { ATTACKER_NATION, DEFENDER_NATION } from "../battle-fixtures.js";

export function makeBattleManifestsFixture(): BattleManifest[] {
  return [
    {
      battleId: "battle-1",
      opportunityId: "opp-001",
      warId: "war_1",
      areaId: "a-1",
      missionType: "open_fleet_engagement",
      attackerId: ATTACKER_NATION,
      defenderId: DEFENDER_NATION,
      acceptanceClass: "accepted",
      missionObjectives: ["destroy_defenders"],
      sides: [
        { sideId: "ATTACKER", participantIds: [ATTACKER_NATION] },
        { sideId: "DEFENDER", participantIds: [DEFENDER_NATION] },
      ],
      persistentAssets: [],
      temporaryAssets: [],
      permanentDivisionIds: [],
      tacticalDivisions: [],
      commanders: [],
      weather: "clear",
      seaState: "calm",
      visibility: "good",
      environment: "open_sea",
      sourceStateHashes: { state: "abc" },
      reservations: [],
      autoResolutionProof: "auto-resolvable",
      provenanceRecords: [],
      battleSeed: "seed",
      rulesetVersion: "0.1.0",
      formulaVersion: "f1",
      aiPolicyVersion: "a1",
      rngVersion: "rng_v1",
      contentVersion: "fixture_v1",
      manifestHash: "manifest-hash",
      shortRangeStartUm: 1_200_000_000,
    },
  ];
}
