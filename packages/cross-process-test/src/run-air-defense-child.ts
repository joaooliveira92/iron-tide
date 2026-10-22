import { RandomEngine } from "@bluewave/random";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  AttackType,
  Category,
  Layer,
  computeAirDefenseStateHash,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  type AirDefenseState,
} from "@bluewave/combat/air-defense";
import { advanceMinutes } from "@bluewave/combat/simulation";
import type { TacticalBattleState } from "@bluewave/combat/tactical";

function buildDefenderState(): AirDefenseState {
  const system = createAirDefenseSystemDefinition({
    systemId: "sys_heavy_01",
    layer: Layer.HEAVY_AA,
    category: Category.HEAVY_AA,
    baseKillBp: SafeInt(2_000),
    baseDamageBp: SafeInt(2_000),
    baseAbortBp: SafeInt(2_000),
    baseDisruptionBp: SafeInt(2_000),
    roundsPerEngagement: SafeInt(5),
    profileEligibility: new Set(["AIRCRAFT_LEVEL_BOMBING"]),
    engagementChannels: new Set(["ch001"]),
  });
  const state: AirDefenseState = {
    defenderId: "ship_001",
    scope: "SHIP",
    systems: [system],
    directorState: {
      channelId: "dir_01",
      assignedLayer: Layer.HEAVY_AA,
      directorIndex: SafeInt(0),
      scalingBp: SafeInt(10_000),
    },
    radarState: {
      channelId: "radar_01",
      assignedLayer: Layer.HEAVY_AA,
      saturationGroup: SafeInt(0),
      diminishingReturnsBp: SafeInt(10_000),
    },
    crewQuality: SafeInt(10_000),
    damageBp: SafeInt.ZERO,
    powerBp: SafeInt(10_000),
    ammunitionByType: new Map([[system.systemId, SafeInt(100)]]),
    targetAllocations: new Map<string, string>(),
    channelReservations: new Map<string, string>(),
    disruptionRecords: [],
    stateHash: "",
  };
  state.stateHash = computeAirDefenseStateHash(state);
  return state;
}

function buildBattleState(): TacticalBattleState {
  return {
    battleId: "battle-air-defense-1",
    mapId: "eng_ch",
    sides: [{ sideId: "DEFENDER", participantIds: ["ship_001"] }],
    forces: { DEFENDER: ["ship_001"] },
    divisions: [],
    units: [],
    contacts: [],
    objectives: [],
    weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
    exitZones: [],
    battleEventLedger: [],
  };
}

function run(): void {
  try {
    const result = advanceMinutes({
      state: buildBattleState(),
      minutes: 4,
      observationTime: "1940-06-01T12:00:00.000Z",
      airDefense: {
        defenders: [
          {
            state: buildDefenderState(),
            operability: {
              defenderSunk: false,
              defenderAbandoned: false,
              systemPowered: true,
              systemOperational: true,
            },
            directorAvailable: true,
            radarAvailable: true,
          },
        ],
        attacks: [
          createAirDefenseAttack({
            attackId: "atk_001",
            formationId: "frm_001",
            targetId: "ship_001",
            attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
            speedKnots: SafeInt(150),
            speedMps: SafeInt(77),
            currentRangeM: SafeInt(5_000),
            currentAltitudeM: SafeInt(3_000),
            bearingDegrees: SafeInt(0),
            releaseRangeM: SafeInt(5_000),
            releaseAltitudeM: SafeInt(2_000),
            isReleased: false,
            fireControlSolutionBp: SafeInt(10_000),
            timeToImpactMs: SafeInt(30_000),
            formationSize: SafeInt(4),
            cohesionBp: SafeInt(10_000),
            defensiveSusceptibilityBp: SafeInt(10_000),
          }),
        ],
        engine: new RandomEngine("air-defense-test-seed"),
      },
    });

    const surface = result.results.map((r) => ({
      minute: r.minute,
      records: (r.airDefenseRecords ?? []).map((rec) => ({
        recordId: rec.recordId,
        outcome: rec.outcome,
        draw: Number(rec.draw),
        roundsConsumed: Number(rec.roundsConsumed),
        recordHash: rec.recordHash,
      })),
    }));
    const recordCount = surface.reduce((n, m) => n + m.records.length, 0);
    const output = {
      resolveAirDefenseHash: sha256Hex(canonicalSerialize(surface)),
      closingSnapshotHash: sha256Hex(canonicalSerialize(result.hashes)),
      recordCount,
      success: true,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        resolveAirDefenseHash: "",
        closingSnapshotHash: "",
        recordCount: 0,
        success: false,
        error: String(err),
      }) + "\n",
    );
  }
}

run();
