import { canonicalSerialize } from "@bluewave/deterministic";
import { SafeInt } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import { RandomEngine } from "@bluewave/random";
import type { TacticalBattleState, TacticalShipUnit } from "../src/tactical/index.js";
import type { MovementState } from "../src/movement/state.js";
import type { TacticalContact } from "../src/contact/lifecycle.js";
import { advanceMinute, type MinuteResult } from "../src/simulation/engine.js";
import { initialDamageState } from "../src/damage/minuteDamage.js";
import {
  computeBaseBreachRateKgMin,
  EMPTY_TUBE,
  NO_RELOAD_IN_PROGRESS,
  withTorpedoLauncherStateHash,
  type TorpedoContext,
  type TorpedoLaunchCommand,
  type TorpedoLauncherState,
} from "../src/torpedoes/index.js";

function unit(id: string, sideId: "ATTACKER" | "DEFENDER", className: string): TacticalShipUnit {
  return {
    assetId: id,
    campaignShipId: id,
    sideId,
    name: id,
    className,
    designVersionId: "dv-1",
    shipType: "BB",
    displacementKg: SafeInt(30_000_000),
    designedSpeedUms: SafeInt(15_433_320),
    armorBeltUm: SafeInt(305_000),
    mainGunsCaliberUm: SafeInt(343_000),
    mainGunsCount: SafeInt(10),
    crewComplement: SafeInt(1_000),
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    sourceStateHash: "pre-1",
    provenance: {
      battleAssetId: id,
      campaignAssetId: id,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "dv-1",
      sourceCompiledDesignHash: "design-1",
      preBattleStateHash: "pre-1",
      projectionReason: "child-process",
      persistenceDisposition: "persistent",
      provenanceHash: "prov-1",
    },
  };
}

const BATTLE_ID = "b7-torpedo-determinism";

const TORPEDOES: Readonly<Record<string, CompiledTorpedo>> = {
  rn_21in_mk_iv_1916: {
    partId: "rn_21in_mk_iv_1916",
    revision: "base",
    diameterUm: 533_000,
    massKg: 1_454,
    warheadType: "TNT",
    warheadExplosiveMassKg: 234,
    warheadExplosiveEquivalentMassKg: 234,
    propulsionType: "WET_HEATER",
    speedSettings: [
      { settingId: "35kn", speedMilliKnots: 35_000, rangeM: 7_315 },
      { settingId: "29kn", speedMilliKnots: 29_000, rangeM: 9_144 },
      { settingId: "25kn", speedMilliKnots: 25_000, rangeM: 12_344 },
    ],
    minimumArmingDistanceM: 50,
    reliabilityBp: 93_500,
    guidanceCapability: "gyro",
    launchTypes: ["UNDERWATER_FIXED", "UNDERWATER_TRAINABLE", "ABOVE_WATER_TRAINABLE"],
    technologyPrerequisiteIds: ["wet_heater_engine"],
    tubeHitHazardPolicy: "ORDINARY",
  },
};

const launcherState: TorpedoLauncherState = withTorpedoLauncherStateHash({
  launcherId: "LCH-1",
  ownerPlatformId: "a1",
  launcherFamilyId: "533mm_underwater_trainable",
  mountPosition: "bow_amidships",
  mountType: "UNDERWATER_TRAINABLE",
  tubeCount: 4,
  loadedPerTube: ["rn_21in_mk_iv_1916", "rn_21in_mk_iv_1916", EMPTY_TUBE, "rn_21in_mk_iv_1916"],
  reserveAmmunition: { rn_21in_mk_iv_1916: 2 },
  reloadState: NO_RELOAD_IN_PROGRESS,
  trainingLimitsMdeg: { min: -90_000, max: 90_000 },
  underwaterLaunchCapability: true,
  fireControlConnectionState: "CONNECTED",
  damageState: "OPERATIONAL",
  floodingIsolationState: "INTACT",
  activeFireSolution: "SOL-1",
  rulesetVersion: "torpedo_ruleset_v1",
  formulaVersion: "torpedo_formula_v1",
});

const units: TacticalShipUnit[] = [
  unit("a1", "ATTACKER", "Battleship"),
  unit("d1", "DEFENDER", "Battleship"),
];

function mv(
  assetId: string,
  xUm: number,
  headingDeg: number,
  speedBp: number,
): [string, MovementState] {
  return [
    assetId,
    {
      position: [xUm, 5_000_000_000],
      heading: headingDeg,
      orderedSpeed: speedBp,
      currentSpeed: speedBp,
      acceleration: 0,
      turningRate: 1_000,
      collisionRadius: 5_000_000,
      propulsionState: "steam",
      machineryReliability: 10_000,
      fuelState: "coal",
      formationStation: "LEAD",
    },
  ];
}

const movementStates: Record<string, MovementState> = Object.fromEntries([
  mv("a1", 0, 0, 0),
  mv("d1", 1_000_000_000, 270, 0),
]);

const contact: TacticalContact = {
  contactId: `${BATTLE_ID}:d1`,
  battleId: BATTLE_ID,
  assetId: "d1",
  sideId: "DEFENDER",
  estimatedIdentity: "Battleship",
  position: movementStates["d1"]!.position,
  course: 270,
  speed: 0,
  confidence: 10_000,
  observationTime: "1900-01-01T00:00:00.000Z",
  source: "visual",
  uncertainty: 0,
  lastUpdateMinute: 1,
  stale: false,
  sources: ["visual"],
};

const state: TacticalBattleState = {
  battleId: BATTLE_ID,
  mapId: "eng_ch",
  sides: [
    { sideId: "ATTACKER", participantIds: ["a1"] },
    { sideId: "DEFENDER", participantIds: ["d1"] },
  ],
  forces: { ATTACKER: ["a1"], DEFENDER: ["d1"] },
  divisions: [],
  units,
  contacts: [contact],
  movementStates,
  objectives: [],
  weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
  exitZones: [],
  battleEventLedger: [],
};

const dmg0 = initialDamageState("d1");

function childCommand(tubeIndex: number): TorpedoLaunchCommand {
  return {
    shipId: "a1",
    launcherId: "LCH-1",
    tubeIndexes: [tubeIndex],
    targetContactId: `${BATTLE_ID}:d1`,
    selectedSettingId: "35kn",
    depthSettingM: 4,
    salvoPolicy: {
      missionObjective: "ATTACK",
      withdrawalState: "NORMAL",
      targetCombatValueBp: 5_000,
      targetSizeBp: 5_000,
      targetEstimatedRangeM: 1_000,
      solutionQualityBp: 8_000,
      remainingTotalAmmunition: 6,
      friendlyLauncherCount: 1,
      overkillEstimateBp: 0,
    },
  };
}

const torpedoes: TorpedoContext = {
  launchers: [
    {
      launcher: launcherState,
      ownerShipId: "a1",
      sideId: "ATTACKER",
      crewQualityBp: 8_000,
      commandSource: "CENTRAL",
      aboveWaterMaxLaunchSpeedKnots: null,
    },
  ],
  commands: [],
  targets: {
    d1: {
      shipId: "d1",
      contactId: `${BATTLE_ID}:d1`,
      profile: {
        targetId: "d1",
        contactId: `${BATTLE_ID}:d1`,
        collisionRadiusM: 100,
        draftM: 9,
        terminalStatus: "NORMAL",
      },
      zone: "MACHINERY",
      protectionLevel: "STANDARD",
      scene: {
        impactSide: "STARBOARD",
        longitudinalPositionM: 150,
        hullBreachAreaM2: 30,
        fireProbabilityBp: 2_000,
        crewCasualties: 40,
        damageControlAccessibility: "ACCESSIBLE",
        isolationState: "INTACT",
      },
      damageState: dmg0,
      designFlotationReserve: 50_000,
      designStabilityScore: 8_000,
      flooding: [
        {
          compartmentId: "MACHINERY",
          baseBreachRateKgMin: computeBaseBreachRateKgMin(30),
          isolationState: "INTACT",
        },
      ],
      machinery: { zone: "MACHINERY", machineryComponents: ["ENGINE-1", "ENGINE-2"] },
      shockCandidates: [{ stableSystemId: "DIRECTOR-1", band: "PRIMARY" }],
      turretComponents: [{ id: "TURRET-1", state: "OPERATIONAL" }],
    },
  },
  tracks: [],
  torpedoes: TORPEDOES,
};

async function main(): Promise<void> {
  const engine = new RandomEngine("torpedo-child-master-seed");
  const results: MinuteResult[] = [];
  let runState: TacticalBattleState = {
    ...state,
    contacts: state.contacts.map((c) => ({ ...c })),
    movementStates: { ...state.movementStates },
  };
  let torpedo: TorpedoContext = { ...torpedoes, tracks: [] };
  const minuteCommands: readonly { tubeIndexes: readonly number[] }[] = [
    { tubeIndexes: [0, 1] },
    { tubeIndexes: [] },
    { tubeIndexes: [] },
  ];
  for (let minute = 1; minute <= 3; minute++) {
    const commands = minuteCommands[minute - 1]!.tubeIndexes.map(childCommand);
    const res = advanceMinute({
      state: runState,
      minute,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 0, orderedSpeedBp: 0 } },
      engine,
      torpedoes: { ...torpedo, commands },
    });
    results.push(res);
    runState = {
      ...runState,
      contacts: res.contacts.map((c) => ({ ...c })),
      movementStates: Object.fromEntries(
        Object.entries(res.movementStates).map(([k, v]) => [k, { ...v }]),
      ),
    };
    if (res.torpedoStates) {
      torpedo = {
        ...torpedo,
        launchers: torpedo.launchers.map((wiring) => {
          const next = res.torpedoStates![wiring.launcher.launcherId];
          return next ? { ...wiring, launcher: next } : wiring;
        }),
      };
    }
    if (res.torpedoTracks)
      torpedo = { ...torpedo, tracks: res.torpedoTracks.map((t) => ({ ...t })) };
    if (res.damageStates) {
      torpedo = { ...torpedo, targets: { ...torpedo.targets } };
      for (const [sid, st] of Object.entries(res.damageStates)) {
        const tgt = torpedo.targets[sid];
        if (tgt) torpedo.targets[sid] = { ...tgt, damageState: st };
      }
    }
  }
  const out = {
    hashes: results.map((r) => r.minuteHash),
    torpedoEventCounts: results.map(
      (r) => r.events.filter((e) => e.eventType.startsWith("torpedo_")).length,
    ),
    recordIds: results.flatMap((r) => (r.torpedoRecords ?? []).map((rec) => rec.recordId)).sort(),
    trackCounts: results.map((r) => (r.torpedoTracks ?? []).length),
    lastDamageStates: Object.entries(
      [...results].reverse().find((r) => r.damageStates && Object.keys(r.damageStates).length > 0)
        ?.damageStates ?? {},
    )
      .map(([shipId, st]) => ({
        shipId,
        structuralIntegrity: st.structuralIntegrity,
        flotationReserve: st.flotationReserve,
        terminalStatus: st.terminalStatus,
        floodingRecords: st.floodingRecords.length,
      }))
      .sort((a, b) => (a.shipId < b.shipId ? -1 : 1)),
  };
  process.stdout.write(canonicalSerialize(out) + "\n");
}

main().catch((e) => {
  process.stderr.write(`CHILD_FAILED: ${(e as Error).message}\n`);
  process.exitCode = 1;
});
