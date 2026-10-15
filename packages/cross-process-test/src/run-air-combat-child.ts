//packages/cross-process-test/src/run-air-combat-child.ts
// D-3 / INC-8: Air-combat cross-process determinism child (AC-21).
// Creates a minimal TacticalBattleState with ships, CAP patrol states, and
// strike mission states, then runs advanceMinutes with the air-combat context.
// Outputs all hashes as JSON to stdout for cross-process byte-comparison.
import { RandomEngine } from "@bluewave/random";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  advanceMinutes,
  createCapPatrolState,
  createStrikeMissionState,
  computeInitialMovementStates,
  type TacticalBattleState,
  type TacticalShipUnit,
  type MovementState,
} from "@bluewave/combat";

const BATTLE_ID = "battle-air-combat-1";

function unit(id: string): TacticalShipUnit {
  return {
    assetId: id,
    campaignShipId: id,
    sideId: "ATTACKER",
    name: id,
    className: "Carrier",
    designVersionId: "dv-1",
    shipType: "CV",
    displacementKg: SafeInt(25_000_000),
    designedSpeedUms: SafeInt(15_433_320),
    armorBeltUm: SafeInt(100_000_000),
    mainGunsCaliberUm: SafeInt(127_000),
    mainGunsCount: SafeInt(8),
    crewComplement: SafeInt(1_500),
    hitPoints: SafeInt(80),
    maxHitPoints: SafeInt(80),
    sourceStateHash: "pre",
    provenance: {
      battleAssetId: id,
      campaignAssetId: id,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "dv-1",
      sourceCompiledDesignHash: "design-1",
      preBattleStateHash: "pre",
      projectionReason: "test",
      persistenceDisposition: "persistent",
      provenanceHash: "prov",
    },
  };
}

function buildAirCombatBattleState(): TacticalBattleState {
  const units = [unit("ship-carrier-1"), unit("ship-carrier-2")];
  const movementStates: Record<string, MovementState> = computeInitialMovementStates(
    { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 },
    units.map((u) => ({
      assetId: u.assetId,
      sideId: "ATTACKER",
      orderedSpeedBpKnots: 10_000,
      designedSpeedBpKnots: 20_000,
      turningRateMdegS: 1_000,
    })),
  );
  return {
    battleId: BATTLE_ID,
    mapId: "eng_ch",
    sides: [{ sideId: "ATTACKER", participantIds: ["ship-carrier-1", "ship-carrier-2"] }],
    forces: { ATTACKER: ["ship-carrier-1", "ship-carrier-2"] },
    divisions: [],
    units,
    contacts: [],
    movementStates,
    objectives: [],
    weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
    exitZones: [],
    battleEventLedger: [],
  };
}

function run(): void {
  try {
    const state = buildAirCombatBattleState();

    // Create CAP patrol states (INC-1 pattern)
    const capPatrol1 = createCapPatrolState(
      "sq-cap-1",
      ["CAP"],
      SafeInt(6),
      SafeInt(400),
      SafeInt(60),
      [0, 0],
    );
    // Setting engagement state to active for recording
    const activeCapPatrol = {
      ...capPatrol1,
      engagementState: "PATROLLING" as const,
      interceptTargetId: "strike-1",
    };

    // Create a second CAP
    const capPatrol2 = createCapPatrolState(
      "sq-cap-2",
      ["CAP"],
      SafeInt(4),
      SafeInt(350),
      SafeInt(75),
      [5000, 0],
    );

    // Create a strike mission state (INC-3 pattern)
    const strike = createStrikeMissionState(
      "mission-strike-1",
      "strike-1",
      ["sq-bomber-1", "sq-bomber-2"],
      "ship-target-1",
      [100000, 5000],
      SafeInt(150),
      SafeInt(45),
    );

    // Run 3 minutes of simulation with air-combat context
    const result = advanceMinutes({
      state,
      minutes: 3,
      observationTime: "1900-01-01T00:00:00.000Z",
      engine: new RandomEngine("air-combat-test-seed"),
      airCombat: {
        battleId: BATTLE_ID,
        minute: 1,
        capPatrols: [activeCapPatrol, capPatrol2],
        strikeMissions: [strike],
        engine: new RandomEngine("air-combat-test-seed"),
      },
    });

    // Hash the air-combat surface across all minutes
    const airCombatSurface = result.results.map((r) => ({
      minute: r.minute,
      ...(r.airCombatRecords && r.airCombatRecords.length > 0
        ? {
            airCombatRecords: r.airCombatRecords.map((rec) => ({
              recordId: rec.recordId,
              minute: Number(rec.minute),
              recordKind: rec.recordKind,
              actorId: rec.actorId,
              targetId: rec.targetId,
              recordHash: rec.recordHash,
            })),
            airCombatSummary: r.airCombatSummary ?? null,
          }
        : {}),
    }));
    const resolveAirCombatHash = sha256Hex(canonicalSerialize(airCombatSurface));

    // Hash the full minute results for broader determinism proof
    const minuteSnapshot = result.results.map((r) => ({
      minute: r.minute,
      minuteHash: r.minuteHash,
    }));
    const closingSnapshotHash = sha256Hex(canonicalSerialize(minuteSnapshot));

    // Hash events as well
    const eventLedgerHash = sha256Hex(
      canonicalSerialize(result.results.flatMap((r) => r.events.map((e) => e.eventId).sort())),
    );

    const output = {
      contentArtifactHash: "air-combat-child-placeholder",
      initialSnapshotHash: "air-combat-child-placeholder",
      closingSnapshotHash,
      commandLedgerHash: "air-combat-child-placeholder",
      eventLedgerHash,
      financialLedgerHash: "air-combat-child-placeholder",
      randomDecisionLedgerHash: "air-combat-child-placeholder",
      resolveAirCombatHash,
      success: true,
    };

    process.stdout.write(JSON.stringify(output) + "\n");
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        contentArtifactHash: "",
        initialSnapshotHash: "",
        closingSnapshotHash: "",
        commandLedgerHash: "",
        eventLedgerHash: "",
        financialLedgerHash: "",
        randomDecisionLedgerHash: "",
        resolveAirCombatHash: "",
        success: false,
        error: String(err),
      }) + "\n",
    );
  }
}

run();
