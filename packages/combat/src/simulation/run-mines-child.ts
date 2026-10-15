//packages/combat/src/simulation/run-mines-child.ts
// Deterministic child-process script for the C-2 mine-warfare slice (AC-23).
// Spawned TWICE by test/mines/determinism.test.ts and byte-compared — two clean
// Node processes must emit IDENTICAL canonical-serialized lines. Builds a
// REPRESENTATIVE PURE monthly mine-warfare resolution from INC-1..INC-7
// functions (pressure records, laying value + reinforcement, regional sweeping
// + §10 allocation, defensive standoff, route risk, underwater-explosion
// classification, decay, post-war persistence, ownership transition,
// clearance) and assembles the ONE §28 MineWarfareResolutionRecord (INC-8).
//
// ONLY mines + contracts + deterministic + random APIs; NO torpedo imports;
// a FIXED master seed (RandomEngine); no Date/env/fs-order. Prints ONE
// canonical-serialized JSON line (canonicalSerialize) incl. a couple of
// record hashes + the resolution record hash.
import { canonicalSerialize } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import {
  allocateSweeping,
  applyOwnershipTransition,
  applySweptPressure,
  assembleMineWarfareResolutionRecord,
  assessPostWarDisposition,
  buildMineIncidentReport,
  classifyUnderwaterExplosion,
  clearRecord,
  computeAreaPressureRecordHash,
  computeDecayedPressure,
  computeDefensiveStandoff,
  computeEffectiveLayingValue,
  computeRegionalSweepingValue,
  computeRouteRiskBp,
  MINE_FORMULA_VERSION,
  MINE_REPORT_SIGNATURE_POLICY_ID,
  MINE_RULESET_VERSION,
  reinforcePressureRecord,
  routeRiskBpToAllocationPriority,
  type AreaMinePressureRecord,
  type MineWarfareResolutionAssemblerInput,
  type UnderwaterExplosionContext,
  withAreaMinePressureRecordHash,
} from "../mines/index.js";

const ENGINE = new RandomEngine("mines-child-master-seed-v1");
const LEDGER = new RandomLedger();

function openingRecord(
  minePressureId: string,
  areaId: string,
  layingParticipantId: string,
  mineTypeId: "CONTACT" | "MAGNETIC",
  pressure: number,
  freshnessBp: number,
): AreaMinePressureRecord {
  return withAreaMinePressureRecordHash({
    minePressureId,
    areaId,
    layingParticipantId,
    targetBelligerents: ["BRITAIN", "FRANCE"],
    mineTypeId,
    pressure: SafeInt(pressure),
    freshnessBp: SafeInt(freshnessBp),
    sourceComposition: [
      { layingSourceId: `${layingParticipantId}:SRC-1`, contributingValue: pressure, count: 1 },
    ],
    mineCountOrAbstractedEquivalent: SafeInt(10),
    detectionConfidenceRecords: [{ observingParticipantId: "UK_ADM", confidenceBp: 5_000 }],
    creationMonth: SafeInt(40),
    lastReinforcedMonth: null,
    lastDecayedMonth: null,
    lastSweptMonth: null,
    legalOwnerOfSourceFacilities: layingParticipantId,
    militaryControllerOfSourceFacilities: layingParticipantId,
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
  });
}

function eligibleSweepingShip(
  shipId: string,
): Parameters<typeof computeRegionalSweepingValue>[0][number] {
  return {
    shipId,
    eligibility: {
      shipId,
      shipType: "DD_WITH_MINE_SWEEPING_EQUIPMENT",
      sweepEquipmentInstalled: true,
      sweepEquipmentOperational: true,
      sweepEquipmentCompatibleWithMineType: true,
      mission: "MINE_WARFARE",
      sweepingAuthorization: true,
      readiness: "ACTIVE",
      damage: "OPERATIONAL",
      locatedInSweptAreaOrConnectedApproach: true,
      fuelSufficient: true,
      supplySufficient: true,
      crewSufficient: true,
      ammunitionOrSweepInventorySufficient: true,
      unavailableFlags: [],
      validatedSweepingCommandOrPlanActive: true,
    },
    baseValueKey: "DD_WITH_MINE_SWEEPING_EQUIPMENT",
    equipmentIsDualPurpose: false,
    lockedMissionOrEquipmentCommand: null,
    technologyMultiplierBp: 10_000,
    crewMultiplierBp: 10_000,
    readinessMultiplierBp: 10_000,
    damageMultiplierBp: 10_000,
    supportMultiplierBp: 10_000,
  };
}

function main(): void {
  const month41 = SafeInt(41);
  const month42 = SafeInt(42);
  const records: AreaMinePressureRecord[] = [
    openingRecord("MP-1", "NorthSea", "BRITAIN", "CONTACT", 600_000, 8_000),
    openingRecord("MP-2", "Helgoland", "GERMANY", "MAGNETIC", 300_000, 6_000),
  ];

  // ---- §4 effective laying value (INC-2) ----
  const effectiveLaying = computeEffectiveLayingValue(100, {
    technologyMultiplierBp: 10_000,
    crewMultiplierBp: 10_000,
    readinessMultiplierBp: 10_000,
    damageMultiplierBp: 10_000,
    supplyMultiplierBp: 10_000,
    missionMultiplierBp: 10_000,
  }).effectiveLayingValue;

  // ---- §5 reinforcement (INC-2) ----
  const reinforced0 = reinforcePressureRecord(
    records[0]!,
    effectiveLaying,
    "BRITAIN:SRC-1",
    month41,
    ["FRANCE"],
  );
  const reinforced1 = reinforcePressureRecord(
    records[1]!,
    effectiveLaying,
    "GERMANY:SRC-1",
    month41,
    ["BRITAIN"],
  );

  // ---- §10 regional sweeping + allocation (INC-3/INC-4) ----
  const regional = computeRegionalSweepingValue([eligibleSweepingShip("LON-WIDGEON")]);
  const allocation = allocateSweeping(regional.regionalSweepingValue, [reinforced0, reinforced1], {
    sweepingBelligerentId: "BRITAIN",
    hasMatchingSweepCapability: (r) => r.mineTypeId === "MAGNETIC" || r.mineTypeId === "CONTACT",
    recordRiskPriority: (r) =>
      routeRiskBpToAllocationPriority(
        Number(computeRouteRiskBp(r.pressure, r.freshnessBp, 10_000, 8_000).routeRiskBp),
      ),
  });
  const allocation0 = allocation.allocations[0]!;
  const allocation1 = allocation.allocations[1]!;
  const swept0 = applySweptPressure(reinforced0, allocation0.sweptPressure, month41);
  const swept1 = applySweptPressure(reinforced1, allocation1.sweptPressure, month41);

  // ---- §16 defensive standoff (INC-5) ----
  const standoff = computeDefensiveStandoff(swept0.pressure);

  // ---- §13 route risk (INC-5) ----
  const routeRisk = computeRouteRiskBp(swept0.pressure, swept0.freshnessBp, 10_000, 8_000);

  // ---- §22 post-war persistence (INC-7) ----
  const postWar = assessPostWarDisposition([swept0, swept1], true);
  // ---- §23 ownership transition (INC-7) ----
  const ownership = applyOwnershipTransition(postWar.records[0]!.record, "PRESERVE_ACTIVE", {
    newLegalOwner: "UK-ADMINISTRATOR",
    newMilitaryController: "CONTROL-AUTHORITY",
    controlInfrastructureOperational: true,
  });
  // ---- §21 decay (INC-7) ----
  const decayed = computeDecayedPressure(ownership.record, true);

  // ---- §19 report + §20 classifier (INC-6) ----
  const explosionContext: UnderwaterExplosionContext = {
    reportId: "REP-41-A",
    knownHostileMinePressure: true,
    observedTorpedoTrack: false,
    noSubmarineContact: false,
    portOrChokePointLocation: true,
    multipleSimultaneousExplosions: false,
  };
  const classification = classifyUnderwaterExplosion(explosionContext, ENGINE, LEDGER);
  const reported = buildMineIncidentReport({
    reportId: "REP-41-A",
    recipientParticipantId: "FRANCE",
    areaOrRoute: "NorthSea",
    observedTime: month41,
    receivedTime: month42,
    affectedShipOrForceId: "FR-DDG-3",
    reportedCause: classification.classification,
    estimatedMineType: "CONTACT",
    estimatedLayingParticipantId: "BRITAIN",
    confidenceBp: SafeInt(9_900),
    positionErrorMeters: SafeInt(200),
    deliveryDelayMonths: SafeInt(1),
    possibleDeception: false,
    generatedKnowledgeAssertions: [],
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
    reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
  });

  // ---- §27 clearance (INC-7): a swept-to-zero transitional record closes ----
  const zeroed = applySweptPressure(reinforced1, reinforced1.pressure, month41);
  const cleared = clearRecord(zeroed, "SWEEPING", month42);

  // ---- §28 resolution record (INC-8 assembler) ----
  const assembleInput: MineWarfareResolutionAssemblerInput = {
    month: month42,
    areaAndWarContexts: [
      { areaId: "NorthSea", warIds: ["GDW"] },
      { areaId: "Helgoland", warIds: ["GDW"] },
    ],
    openingPressureRecords: records,
    layingSourcesAndValues: [
      {
        source: "BRITAIN:SRC-1",
        layingParticipant: "BRITAIN",
        area: "NorthSea",
        value: Number(effectiveLaying),
        month: month41,
      },
      {
        source: "GERMANY:SRC-1",
        layingParticipant: "GERMANY",
        area: "Helgoland",
        value: Number(effectiveLaying),
        month: month41,
      },
    ],
    sweepingShipsModesValues: [
      {
        shipId: "HMS-WIDGEON",
        equipmentMode: "SINGLE_PURPOSE",
        sweepingValue: regional.over[0]!.effectiveSweepingValue as number,
      },
    ],
    dualEquipmentReductions: [],
    allocatedSweeping: [
      {
        minePressureId: swept0.minePressureId,
        sweptPressure: allocation0.sweptPressure,
        typeAdjustedSweeping: allocation0.typeAdjustedSweeping,
        pressureAfter: allocation0.pressureAfter,
        mineTypeId: swept0.mineTypeId,
        threatensSweepingSide: false,
        strikeRiskPriority: Number(
          routeRiskBpToAllocationPriority(
            Number(
              computeRouteRiskBp(swept0.pressure, swept0.freshnessBp, 10_000, 8_000).routeRiskBp,
            ),
          ),
        ),
      },
      {
        minePressureId: swept1.minePressureId,
        sweptPressure: allocation1.sweptPressure,
        typeAdjustedSweeping: allocation1.typeAdjustedSweeping,
        pressureAfter: allocation1.pressureAfter,
        mineTypeId: swept1.mineTypeId,
        threatensSweepingSide: false,
        strikeRiskPriority: Number(
          routeRiskBpToAllocationPriority(
            Number(
              computeRouteRiskBp(swept1.pressure, swept1.freshnessBp, 10_000, 8_000).routeRiskBp,
            ),
          ),
        ),
      },
    ],
    pressureRemoved: SafeInt(Number(allocation0.sweptPressure) + Number(allocation1.sweptPressure)),
    routes: [{ routeEdgeId: "EDGE-HELG", routeRiskBp: routeRisk.routeRiskBp }],
    battle: [],
    strikeDecisionsAndOutcomes: [],
    standoffLevels: [
      {
        minePressureId: swept0.minePressureId,
        level: standoff.level,
        utilityMultiplierBp: standoff.utilityMultiplierBp,
      },
    ],
    decay: [
      {
        minePressureId: ownership.record.minePressureId,
        retentionMultiplierBp: decayed.retentionMultiplierBp,
        decayedPressure: decayed.decayedPressure,
        pressureAfterDecay: decayed.pressureAfterDecay,
      },
    ],
    postWarAndOwnershipDispositions: [
      { minePressureId: ownership.record.minePressureId, disposition: ownership.disposition },
    ],
    reportsAndKnowledgeChanges: [
      { reportId: reported.report.reportId, participantId: reported.report.recipientParticipantId },
    ],
    friendlyFireChecks: [],
    inventoryWarScorePoliticalAndDamageEffects: [],
    rngDecisions: LEDGER.all,
  };
  const resolution = assembleMineWarfareResolutionRecord(assembleInput);

  const out = {
    childId: "run-mines-child",
    openingRecordHashes: records.map(computeAreaPressureRecordHash),
    reinforcedHashes: [reinforced0.recordHash, reinforced1.recordHash],
    sweptPressure0: Number(swept0.pressure),
    sweptPressure1: Number(swept1.pressure),
    routeRiskBp: Number(routeRisk.routeRiskBp),
    standoffLevel: standoff.level,
    classificationOutcome: classification.classification,
    classificationDraw: classification.draw,
    reportHash: reported.report.reportHash,
    clearedEmittedCode: cleared.emittedCode,
    decayedPressure: Number(decayed.decayedPressure),
    resolutionRecordHash: resolution.recordHash,
    rngHash: LEDGER.hash(),
  };
  process.stdout.write(canonicalSerialize(out) + "\n");
}

main();
