import type { CampaignSnapshot } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine } from "@bluewave/random";
import { determineMissionOpportunities, type BattleMissionOpportunity } from "./opportunity.js";
import { determineParticipatingSides } from "./sides.js";
import { buildManifest, type BattleManifest } from "./manifest.js";
import { GENERATION_SEED_FORMULA_VERSION, deriveBattleSeed } from "./seed.js";
import { reserveAssets } from "./reservation.js";
import { proveAutoResolvable, shippedResolverCapabilities } from "./autoResolutionProof.js";
import { resolveDecisionBoundary } from "./acceptance.js";
import { gatherEligibleAssets, type EligibleAsset } from "./eligibility.js";
import { createForceRequirements, assignMandatoryRoles } from "./force.js";
import { optionalAssetSelectionV1, optionalAssetStreamKey } from "./optional.js";
import { revalidateReachabilityAndLegality } from "./reachability.js";
import { battleCompositionRepairV1 } from "./repair.js";
import { FLEET_BATTLE_MIN_STRENGTH, CRUISER_BATTLE_MIN_STRENGTH } from "./mission.js";
import {
  BATTLE_MANDATORY_ROLE_UNFILLED,
  BATTLE_COMPOSITION_IRREPARABLE,
  BATTLE_REACHABILITY_FAILED,
} from "./reasonCodes.js";

export const GENERATION_STAGES = [
  "DETERMINE_MISSION_OPPORTUNITIES",
  "DETERMINE_PARTICIPATING_SIDES",
  "CREATE_FORCE_REQUIREMENTS",
  "GATHER_ELIGIBLE_ASSETS",
  "PRESERVE_PERMANENT_DIVISIONS",
  "ASSIGN_MANDATORY_ROLES",
  "SELECT_OPTIONAL_ASSETS",
  "ADD_ALLIED_SUPPORT",
  "INSTANTIATE_GENERATED_ELEMENTS",
  "VALIDATE_REACHABILITY_AND_LEGALITY",
  "REPAIR_GENERATED_COMPOSITION",
  "REJECT_IRREPARABLE_ENGAGEMENTS",
  "CANONICALIZE_BATTLE_MANIFEST",
  "ASSIGN_BATTLE_SEED",
  "CREATE_INTELLIGENCE_LIMITED_PRESENTATION",
] as const;
export type GenerationStage = (typeof GENERATION_STAGES)[number];

export interface BattleGenerationStageRecord {
  opportunityId: string;
  prospectiveBattleId: string;
  stageId: GenerationStage;
  ordinal: number;
  inputHashes: string[];
  orderedCandidates: string[];
  predicateResults: string[];
  selections: string[];
  exclusions: string[];
  randomDecisionRefs: string[];
  repairs: string[];
  resultCode: string;
  outputHash: string;
  rulesetVersion: string;
  formulaVersion: string;
}

export interface BattleGenerationRecord {
  month: string;
  opportunities: BattleMissionOpportunity[];
  accepted: string[];
  rejected: string[];
  declined: string[];
  expired: string[];
  superseded: string[];
  stageRecords: BattleGenerationStageRecord[];
  eligibleAssets: string[];
  excludedAssets: string[];
  permanentDivisionProjections: string[];
  mandatorySelections: string[];
  optionalSelections: string[];
  alliedSupportDecisions: string[];
  generatedElements: string[];
  repairs: string[];
  reservations: string[];
  manifests: string[];
  battleSeeds: string[];
  estimateProjections: string[];
  acceptanceRecords: string[];
  declineRecords: string[];
  politicalWarScoreObjectiveEffects: string[];
  rngDecisions: string[];
  rulesetVersion: string;
  formulaVersion: string;
  recordHash: string;
}

export interface BattleGenerationInputs {
  snapshot: CampaignSnapshot;
  campaignMonth: string;
  campaignSeed: string;
  rngVersion: string;
  formulaVersion: string;
  rulesetVersion: string;
  contentVersion: string;
  resolveStrength: (shipId: string) => number;
  resolveShipType: (shipId: string) => string;
  resolveReadiness: (shipId: string) => number;
  reservedAssetIds?: ReadonlySet<string>;
}

export interface BattleGenerationResult {
  records: BattleGenerationRecord[];
  manifests: BattleManifest[];
  battleIds: string[];
  rejections: string[];
}

function stageRecord(
  opp: BattleMissionOpportunity,
  prospectiveBattleId: string,
  stageId: GenerationStage,
  rulesetVersion: string,
  formulaVersion: string,
  extra: Partial<BattleGenerationStageRecord> = {},
): BattleGenerationRecord["stageRecords"][number] {
  return {
    opportunityId: opp.opportunityId,
    prospectiveBattleId,
    stageId,
    ordinal: GENERATION_STAGES.indexOf(stageId) + 1,
    inputHashes: [],
    orderedCandidates: [],
    predicateResults: [],
    selections: [],
    exclusions: [],
    randomDecisionRefs: [],
    repairs: [],
    resultCode: "OK",
    outputHash: sha256Hex(canonicalSerialize({ stageId, opportunityId: opp.opportunityId })),
    rulesetVersion,
    formulaVersion,
    ...extra,
  };
}

function roleScoreFor(a: EligibleAsset): number {
  const core = new Set(["BB", "B", "BC", "CA", "CV", "CVL"]);
  return core.has(a.shipType) ? 10 : 1;
}

function nationHasAsset(nationId: string, assets: EligibleAsset[]): boolean {
  return assets.some((a) => a.nationId === nationId);
}
export function generateBattles(inputs: BattleGenerationInputs): BattleGenerationResult {
  const { snapshot } = inputs;
  const opportunities = determineMissionOpportunities({
    snapshot,
    campaignMonth: inputs.campaignMonth,
    acceptedOpportunityIds: new Set(),
    acceptedWarAreaPairs: new Set(),
  });

  const records: BattleGenerationRecord[] = [];
  const manifests: BattleManifest[] = [];
  const battleIds: string[] = [];
  const rejections: string[] = [];

  for (const opp of opportunities) {
    if (opp.status === "REJECTED") {
      rejections.push(opp.opportunityId);
      continue;
    }

    const prospectiveBattleId = `battle_${opp.warId}_${opp.areaId}_${opp.missionType.toLowerCase()}_${inputs.campaignMonth}`;
    const stageRecords: BattleGenerationStageRecord[] = [];

    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "DETERMINE_MISSION_OPPORTUNITIES",
        inputs.rulesetVersion,
        inputs.formulaVersion,
      ),
    );

    let sides;
    try {
      sides = determineParticipatingSides(
        opp.attackerCandidateNationId,
        opp.defenderCandidateNationId,
        [],
        [],
      );
    } catch {
      rejections.push(opp.opportunityId);
      continue;
    }
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "DETERMINE_PARTICIPATING_SIDES",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          selections: sides.map((s) => s.sideId),
        },
      ),
    );

    const forcePolicy = createForceRequirements(opp.missionType);
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "CREATE_FORCE_REQUIREMENTS",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          selections: [forcePolicy.policyId],
        },
      ),
    );

    const shipsOfNation = (nationId: string) => {
      const nation = snapshot.nations.get(nationId);
      return nation ? nation.fleets.flatMap((f) => f.ships) : [];
    };
    const gatherSideSync = (nationId: string, sideId: string): EligibleAsset[] => {
      const ships = shipsOfNation(nationId).filter((s) => !s.isUnderConstruction);
      const { eligible } = gatherEligibleAssets({
        ships,
        sideId,
        nationId,
        areaId: opp.areaId,
        reservedAssetIds: inputs.reservedAssetIds ?? new Set(),
        resolveStrength: (ship) => inputs.resolveStrength(ship.id),
        resolveShipType: (ship) => inputs.resolveShipType(ship.id),
        resolveReadiness: (ship) => inputs.resolveReadiness(ship.id),
      });
      return eligible;
    };

    const attackerEligible = gatherSideSync(opp.attackerCandidateNationId, "ATTACKER");
    const defenderEligible = gatherSideSync(opp.defenderCandidateNationId, "DEFENDER");
    const eligibleAssets = [...attackerEligible, ...defenderEligible];
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "GATHER_ELIGIBLE_ASSETS",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          orderedCandidates: eligibleAssets.map((e) => e.assetId),
          selections: eligibleAssets.map((e) => e.assetId),
          resultCode: eligibleAssets.length > 0 ? "OK" : "BATTLE_ELIGIBLE_ASSETS_NONE",
        },
      ),
    );

    const attackerStrength = attackerEligible.reduce((s, e) => s + e.effectiveStrength, 0);
    const defenderStrength = defenderEligible.reduce((s, e) => s + e.effectiveStrength, 0);
    const minStrength =
      opp.missionType === "FLEET_BATTLE" ? FLEET_BATTLE_MIN_STRENGTH : CRUISER_BATTLE_MIN_STRENGTH;
    if (attackerStrength < minStrength || defenderStrength < minStrength) {
      stageRecords.push(
        stageRecord(
          opp,
          prospectiveBattleId,
          "VALIDATE_REACHABILITY_AND_LEGALITY",
          inputs.rulesetVersion,
          inputs.formulaVersion,
          { resultCode: "BATTLE_OPPORTUNITY_INELIGIBLE" as const },
        ),
      );
      rejections.push(opp.opportunityId);
      stageRecords.push(
        stageRecord(
          opp,
          prospectiveBattleId,
          "REJECT_IRREPARABLE_ENGAGEMENTS",
          inputs.rulesetVersion,
          inputs.formulaVersion,
          {
            resultCode: "BATTLE_REACHABILITY_FAILED" as const,
          },
        ),
      );
      continue;
    }

    const permanentDivisionIds: string[] = [];
    const tacticalDivisions: never[] = [];
    for (const [nationId, nation] of snapshot.nations) {
      if (!nationHasAsset(nationId, eligibleAssets)) continue;
      for (const division of nation.divisions ?? []) {
        const members = division.shipOrder.filter((id) =>
          eligibleAssets.some((e) => e.shipId === id && e.nationId === nationId),
        );
        if (members.length > 0) {
          permanentDivisionIds.push(division.divisionId);
        }
      }
    }
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "PRESERVE_PERMANENT_DIVISIONS",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          selections: permanentDivisionIds,
        },
      ),
    );

    const mandatoryAssets: EligibleAsset[] = [];
    for (const side of ["ATTACKER", "DEFENDER"] as const) {
      const sideAssets = eligibleAssets.filter((a) => a.sideId === side);
      const core = assignMandatoryRoles(
        sideAssets.map((a) => ({
          assetId: a.assetId,
          sideId: a.sideId,
          roleScore: roleScoreFor(a),
          effectiveStrength: a.effectiveStrength,
          readiness: a.readiness,
          commanderSuitability: 0,
          assetIdentifier: a.assetId,
        })),
        "CORE",
      );
      if (!core) {
        stageRecords.push(
          stageRecord(
            opp,
            prospectiveBattleId,
            "ASSIGN_MANDATORY_ROLES",
            inputs.rulesetVersion,
            inputs.formulaVersion,
            {
              resultCode: BATTLE_MANDATORY_ROLE_UNFILLED,
            },
          ),
        );
        rejections.push(opp.opportunityId);
        continue;
      }
      mandatoryAssets.push(sideAssets.find((a) => a.assetId === core.assetId)!);
    }
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "ASSIGN_MANDATORY_ROLES",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          selections: mandatoryAssets.map((a) => a.assetId),
        },
      ),
    );

    const reservedIds = new Set(mandatoryAssets.map((a) => a.assetId));
    const optionalCandidates = eligibleAssets.filter((a) => !reservedIds.has(a.assetId));
    let selectedOptional: string[] = [];
    if (optionalCandidates.length > 0) {
      const stream = new RandomEngine(inputs.campaignSeed).stream(
        optionalAssetStreamKey(
          inputs.campaignMonth,
          opp.warId,
          opp.areaId,
          opp.missionType,
          sha256Hex(canonicalSerialize(optionalCandidates.map((a) => a.assetId).sort())),
          "OPTIONAL",
        ),
      );
      selectedOptional = optionalAssetSelectionV1(
        optionalCandidates.map((a) => ({
          assetId: a.assetId,
          baseMissionWeight: 10_000,
          readinessMultiplierBp: 10_000 - Math.min(10_000, a.readiness * 100),
          missionFitMultiplierBp: 10_000,
          commanderMultiplierBp: 10_000,
          objectiveMultiplierBp: 10_000,
          fatigueMultiplierBp: 10_000,
        })),
        "OPTIONAL",
        stream,
        Math.max(0, Math.min(5, optionalCandidates.length)),
      );
    }
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "SELECT_OPTIONAL_ASSETS",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          selections: selectedOptional,
        },
      ),
    );

    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "ADD_ALLIED_SUPPORT",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          resultCode: "OK",
        },
      ),
    );
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "INSTANTIATE_GENERATED_ELEMENTS",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          resultCode: "OK",
        },
      ),
    );

    try {
      revalidateReachabilityAndLegality([], {
        areaId: opp.areaId,
        reservedAssetIds: new Set(),
        workingUpExcluded: true,
      });
      stageRecords.push(
        stageRecord(
          opp,
          prospectiveBattleId,
          "VALIDATE_REACHABILITY_AND_LEGALITY",
          inputs.rulesetVersion,
          inputs.formulaVersion,
          {
            resultCode: "OK",
          },
        ),
      );
    } catch {
      stageRecords.push(
        stageRecord(
          opp,
          prospectiveBattleId,
          "VALIDATE_REACHABILITY_AND_LEGALITY",
          inputs.rulesetVersion,
          inputs.formulaVersion,
          {
            resultCode: BATTLE_REACHABILITY_FAILED,
          },
        ),
      );
      rejections.push(opp.opportunityId);
      continue;
    }

    const repair = battleCompositionRepairV1([], []);
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "REPAIR_GENERATED_COMPOSITION",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          repairs: repair.actions.map((a) => a.kind),
          resultCode: repair.repaired ? "OK" : BATTLE_COMPOSITION_IRREPARABLE,
        },
      ),
    );
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "REJECT_IRREPARABLE_ENGAGEMENTS",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          resultCode: "OK",
        },
      ),
    );

    const persistentAssets = [
      ...mandatoryAssets,
      ...eligibleAssets.filter((a) => selectedOptional.includes(a.assetId)),
    ].map((a) => a.assetId);

    const manifest = buildManifest({
      battleId: prospectiveBattleId,
      opportunityId: opp.opportunityId,
      warId: opp.warId,
      areaId: opp.areaId,
      missionType: opp.missionType,
      attackerId: opp.attackerCandidateNationId,
      defenderId: opp.defenderCandidateNationId,
      acceptanceClass: opp.acceptanceClass,
      missionObjectives: opp.objectiveIds,
      sides,
      persistentAssets,
      temporaryAssets: [],
      permanentDivisionIds,
      tacticalDivisions,
      commanders: [],
      weather: "clear",
      seaState: "moderate",
      visibility: "good",
      environment: "day",
      sourceStateHashes: {},
      reservations: [],
      autoResolutionProof: "",
      provenanceRecords: [],
      rulesetVersion: inputs.rulesetVersion,
      formulaVersion: inputs.formulaVersion,
      aiPolicyVersion: "1",
      rngVersion: inputs.rngVersion,
      contentVersion: inputs.contentVersion,
    });
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "CANONICALIZE_BATTLE_MANIFEST",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          outputHash: manifest.manifestHash,
        },
      ),
    );

    const seedInputs = {
      rngVersion: inputs.rngVersion,
      campaignSeed: inputs.campaignSeed,
      campaignMonth: inputs.campaignMonth,
      warId: opp.warId,
      areaId: opp.areaId,
      missionType: opp.missionType,
      opportunityId: opp.opportunityId,
      battleGenerationFormulaVersion: GENERATION_SEED_FORMULA_VERSION,
    };
    const seed = deriveBattleSeed(seedInputs, manifest);
    const manifestWithSeed = { ...manifest, battleSeed: seed };
    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "ASSIGN_BATTLE_SEED",
        inputs.rulesetVersion,
        inputs.formulaVersion,
        {
          selections: [seed],
        },
      ),
    );

    stageRecords.push(
      stageRecord(
        opp,
        prospectiveBattleId,
        "CREATE_INTELLIGENCE_LIMITED_PRESENTATION",
        inputs.rulesetVersion,
        inputs.formulaVersion,
      ),
    );

    proveAutoResolvable(manifestWithSeed, shippedResolverCapabilities());
    const decision = resolveDecisionBoundary({
      acceptanceClass: manifestWithSeed.acceptanceClass,
      hasAutomationPolicy: true,
      isAiOnly: true,
    });
    if (decision === null) {
      rejections.push(opp.opportunityId);
      continue;
    }

    reserveAssets(manifestWithSeed.battleId, manifestWithSeed.persistentAssets, new Set());

    manifests.push(manifestWithSeed);
    battleIds.push(manifestWithSeed.battleId);

    const record: BattleGenerationRecord = {
      month: inputs.campaignMonth,
      opportunities: [opp],
      accepted: [manifestWithSeed.battleId],
      rejected: [],
      declined: [],
      expired: [],
      superseded: [],
      stageRecords,
      eligibleAssets: [],
      excludedAssets: [],
      permanentDivisionProjections: permanentDivisionIds,
      mandatorySelections: mandatoryAssets.map((a) => a.assetId),
      optionalSelections: selectedOptional,
      alliedSupportDecisions: [],
      generatedElements: [],
      repairs: repair.actions.map((a) => a.kind),
      reservations: manifestWithSeed.persistentAssets,
      manifests: [manifestWithSeed.manifestHash],
      battleSeeds: [seed],
      estimateProjections: [],
      acceptanceRecords: [decision.resolutionMode],
      declineRecords: [],
      politicalWarScoreObjectiveEffects: [],
      rngDecisions: [],
      rulesetVersion: inputs.rulesetVersion,
      formulaVersion: inputs.formulaVersion,
      recordHash: "",
    };
    record.recordHash = sha256Hex(canonicalSerialize(record));
    records.push(record);
  }

  return { records, manifests, battleIds, rejections };
}
