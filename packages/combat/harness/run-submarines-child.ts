import { canonicalSerialize } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import { RandomLedger } from "@bluewave/random";
import {
  computeStrategicMissionEffectiveness,
  evaluateCoastalRestriction,
  coastalLocalEfficiencyOnly,
  seaStateCategory,
  submarineDetectionMultiplierBp,
  submarineObservationMultiplierBp,
  submarineAttackMultiplierBp,
  isSeaStateOperationProhibited,
  computeScreenRatioBp,
  screeningOpportunityMultiplierBp,
  computeAttackOpportunityValue,
  createAttackOpportunityRecord,
  isMinelayingCapable,
  evaluateMineLayingEligibility,
  computeMisidentificationProbability,
  withSubmarineOperationsRecordHash,
  computeSubmarineOperationsRecordHash,
} from "../src/submarines/index.js";

const LEDGER = new RandomLedger();

function main(): void {
  const month = SafeInt(42);

  const effectiveness = computeStrategicMissionEffectiveness({
    baseMissionStrength: SafeInt(10_000),
    typeRemoteEfficiencyBp: SafeInt(12_500),
    reliabilityMultiplierBp: SafeInt(11_000),
  });

  const coastalRestriction = evaluateCoastalRestriction({
    submarineTypeId: "COASTAL",
    atWar: true,
    targetProximityBand: "LOCAL",
    isWithinHomeArea: true,
    isAdjacentToSupportBase: false,
    isEmergencyRedeployment: false,
  });
  const localOnly = coastalLocalEfficiencyOnly("COASTAL", "LOCAL");

  const category = seaStateCategory(SafeInt(4));
  const detection = submarineDetectionMultiplierBp(SafeInt(3));
  const observation = submarineObservationMultiplierBp(SafeInt(7));
  const attack = submarineAttackMultiplierBp(SafeInt(9));
  const prohibited = isSeaStateOperationProhibited(SafeInt(8));

  const screenRatio = computeScreenRatioBp(SafeInt(200), SafeInt(100));
  const oppMultiplier = screeningOpportunityMultiplierBp(SafeInt(5_000));

  const oppValue = computeAttackOpportunityValue({
    policyWeightBp: 8_000,
    targetAvailabilityFactorBp: 10_000,
    intelligenceFactorBp: 10_000,
    regionalProtectionFactorBp: 10_000,
    missionStrengthFactorBp: 10_000,
  });
  const oppRecord = createAttackOpportunityRecord(
    "opp-child-001",
    "war-GDW",
    "area-NorthSea",
    "sub-child-001",
    month,
    "FLEET_SUPPORT",
    oppValue,
  );

  const minelayingCapable = isMinelayingCapable("MINELAYING");
  const mineVerdict = evaluateMineLayingEligibility(
    "MINELAYING",
    SafeInt(70),
    SafeInt(60),
    SafeInt(5_000),
    true,
    {
      targetAreaId: "area-NorthSea",
      legalRouteAvailable: true,
      mineInventory: SafeInt(100),
      requiredInventory: SafeInt(20),
      targetBelligerents: ["nation-enemy"],
      availableTechnologyIds: new Set(["sub_minelaying"]),
    },
  );

  const misidProb = computeMisidentificationProbability({
    baseProbabilityBp: SafeInt(500),
    visibilityModifierBp: SafeInt(1_000),
    communicationModifierBp: SafeInt(500),
    doctrineModifierBp: SafeInt(500),
    fatigueModifierBp: SafeInt(0),
    identificationQualityBp: SafeInt(1_000),
  });

  const record = withSubmarineOperationsRecordHash({
    month,
    warIds: ["war-GDW"],
    areaIds: ["area-NorthSea"],
    assetIds: ["sub-child-001"],
    missionIds: ["MERCHANT_RAIDING"],
    targetIds: ["target-child-001"],
    battleIds: [],
    aswContactIds: [],
    friendlyFireCheckIds: [],
    rulesetVersion: "submarine_ruleset_v1",
    formulaVersion: "submarine_formula_v1",
  });

  const hash = computeSubmarineOperationsRecordHash({
    month: SafeInt(43),
    warIds: ["war-GDW-2"],
    areaIds: ["area-Baltic"],
    assetIds: ["sub-child-002"],
    missionIds: ["MINE_LAYING"],
    targetIds: [],
    battleIds: [],
    aswContactIds: [],
    friendlyFireCheckIds: [],
    rulesetVersion: "submarine_ruleset_v1",
    formulaVersion: "submarine_formula_v1",
  });

  const out = {
    childId: "run-submarines-child",
    effectiveness,
    coastalRestriction: {
      restricted: coastalRestriction.restricted,
      movementKind: coastalRestriction.movementKind,
    },
    localOnly,
    category,
    detection,
    observation,
    attack,
    prohibited,
    screenRatio,
    oppMultiplier,
    oppValue,
    oppStreamKey: oppRecord.streamKey,
    minelayingCapable,
    mineVerdictAccepted: mineVerdict.accepted,
    misidProb,
    recordHash: record.recordHash,
    verificationHash: hash,
    rngHash: LEDGER.hash(),
  };
  process.stdout.write(canonicalSerialize(out) + "\n");
}

main();
