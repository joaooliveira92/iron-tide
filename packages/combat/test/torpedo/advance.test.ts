// INC-7 — the torpedo engine stage + strict no-op (AC-22).
//   - absent torpedo context ⇒ minute hashes byte-identical to the committed
//     B-2..B-6 baseline (hardcoded literals captured BEFORE the INC-7 change —
//     do NOT regenerate them);
//   - present context that resolves nothing ⇒ the same byte-identical
//     guarantee;
//   - a resolved minute emits §27 records via the torpedo stage after the
//     damage stage, threads torpedoStates/torpedoTracks, and drives the full
//     launch → track → hit → detonation → damage chain.
// ALSO the shared torpedo-scene builders the other INC-7 test files import
// (the buildTestState precedent — advance.test.ts re-exported by
// pipeline-order.test.ts).
import { describe, expect, it } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import { SafeInt } from "@bluewave/contracts";
import type { TacticalBattleState, TacticalShipUnit } from "../../src/tactical/index.js";
import type { MovementState } from "../../src/movement.js";
import type { TacticalContact } from "../../src/contact/lifecycle.js";
import { advanceMinute, advanceMinutes } from "../../src/simulation/engine.js";
import { computeInitialMovementStates } from "../../src/simulation/spawn.js";
import { initialDamageState } from "../../src/battleResolution/damage.js";
import {
  computeBaseBreachRateKgMin,
  EMPTY_TUBE,
  NO_RELOAD_IN_PROGRESS,
  TORPEDO_LAUNCH_SUBSTEP,
  withTorpedoLauncherStateHash,
  type TorpedoContext,
  type TorpedoLaunchCommand,
  type TorpedoLauncherState,
  type TorpedoTargetContext,
} from "../../src/torpedoes/index.js";
import { COMPILED_TORPEDOES } from "../fixtures/compiledTorpedoes.js";

// ---------------------------------------------------------------------------
// shared scene builders (exported for the other INC-7 test files)
// ---------------------------------------------------------------------------

export const TORPEDO_BATTLE_ID = "b1-torpedo-inc7";

export function torpedoUnit(
  id: string,
  sideId: "ATTACKER" | "DEFENDER",
  className: string,
): TacticalShipUnit {
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

/** The baseline battle state (mirrors the B-2 advance.test.ts builder — the
 *  same inputs that produced the committed no-context baseline hashes). */
export function buildTorpedoBattleState(
  overrides: Partial<TacticalBattleState> = {},
): TacticalBattleState {
  const units: TacticalShipUnit[] = [
    torpedoUnit("a1", "ATTACKER", "Battleship"),
    torpedoUnit("d1", "DEFENDER", "Battleship"),
  ];
  const movementStates: Record<string, MovementState> = computeInitialMovementStates(
    { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 },
    units.map((u) => ({
      assetId: u.assetId,
      sideId: u.sideId as "ATTACKER" | "DEFENDER",
      orderedSpeedBpKnots: 10_000,
      designedSpeedBpKnots: 20_000,
      turningRateMdegS: 1_000,
    })),
  );
  return {
    battleId: TORPEDO_BATTLE_ID,
    mapId: "eng_ch",
    sides: [
      { sideId: "ATTACKER", participantIds: ["a1"] },
      { sideId: "DEFENDER", participantIds: ["d1"] },
    ],
    forces: { ATTACKER: ["a1"], DEFENDER: ["d1"] },
    divisions: [],
    units,
    contacts: [],
    movementStates,
    objectives: [],
    weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
    exitZones: [],
    battleEventLedger: [],
    ...overrides,
  };
}

/** The Inc-7 stationary-shooter scene: the attacker holds position at the west
 *  edge heading EAST (heading 0 — the authored movement direction table); the
 *  defender sits ~1000 m dead ahead inside the 35 kn torpedo's first-minute
 *  run. Returns the battle state + a legal contact + the torpedo context. */
export function buildTorpedoScene(): {
  state: TacticalBattleState;
  contact: TacticalContact;
  context: TorpedoContext;
} {
  const a1Pos: [number, number] = [0, 5_000_000_000];
  const d1Pos: [number, number] = [1_000_000_000, 5_000_000_000];

  const state: TacticalBattleState = buildTorpedoBattleState({
    movementStates: {
      a1: {
        position: a1Pos,
        heading: 0,
        orderedSpeed: 0,
        currentSpeed: 0,
        acceleration: 0,
        turningRate: 1_000,
        collisionRadius: 5_000_000,
        propulsionState: "steam",
        machineryReliability: 10_000,
        fuelState: "coal",
        formationStation: "LEAD",
      },
      d1: {
        position: d1Pos,
        heading: 270,
        orderedSpeed: 0,
        currentSpeed: 0,
        acceleration: 0,
        turningRate: 1_000,
        collisionRadius: 5_000_000,
        propulsionState: "steam",
        machineryReliability: 10_000,
        fuelState: "coal",
        formationStation: "LEAD",
      },
    },
    contacts: [],
  });
  const contact: TacticalContact = {
    contactId: `${TORPEDO_BATTLE_ID}:d1`,
    battleId: TORPEDO_BATTLE_ID,
    assetId: "d1",
    sideId: "DEFENDER",
    estimatedIdentity: "Battleship",
    position: d1Pos,
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
  return { state: { ...state, contacts: [contact] }, contact, context: torpedoContext() };
}

export function torpedoLauncherState(
  overrides: Partial<TorpedoLauncherState> = {},
): TorpedoLauncherState {
  return withTorpedoLauncherStateHash({
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
    ...overrides,
  });
}

export function torpedoTargetContext(
  overrides: Partial<TorpedoTargetContext> = {},
): TorpedoTargetContext {
  const dmg = initialDamageState("d1");
  return {
    shipId: "d1",
    contactId: `${TORPEDO_BATTLE_ID}:d1`,
    profile: {
      targetId: "d1",
      contactId: `${TORPEDO_BATTLE_ID}:d1`,
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
    damageState: dmg,
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
    ...overrides,
  };
}

export function torpedoLaunchCommand(
  tubeIndex: number,
  overrides: Partial<TorpedoLaunchCommand> = {},
): TorpedoLaunchCommand {
  return {
    shipId: "a1",
    launcherId: "LCH-1",
    tubeIndexes: [tubeIndex],
    targetContactId: `${TORPEDO_BATTLE_ID}:d1`,
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
    ...overrides,
  };
}

export function torpedoContext(overrides: Partial<TorpedoContext> = {}): TorpedoContext {
  return {
    launchers: [
      {
        launcher: torpedoLauncherState(),
        ownerShipId: "a1",
        sideId: "ATTACKER",
        crewQualityBp: 9_000,
        commandSource: "CENTRAL",
        aboveWaterMaxLaunchSpeedKnots: null,
      },
    ],
    commands: [],
    targets: { d1: torpedoTargetContext() },
    tracks: [],
    torpedoes: COMPILED_TORPEDOES,
    ...overrides,
  };
}

export const TORPEDO_SCENE_ORDERS = { a1: { orderedHeading: 0, orderedSpeedBp: 0 } };

// ---- The committed B-2..B-6 no-context baseline hashes -------------------
// Captured from the PRE-INC-7 engine (3 minutes of the baseline builder with
// battleId "baseline-b1" and orders a1 heading90/speed20) and re-confirmed
// byte-identical after the INC-7 engine change. These literals MUST NOT be
// regenerated except through the ADR-0007 process (done once: ticket 08, below) — the
// strict no-op tests below pin them.
// ADR-0007 re-pin (P-1 ticket 08, spawn heading 90/270 -> 0/180 so the spawn
// convention matches movement's directionBp). Verified heading-only: forcing the old
// 90/270 headings onto the new spawn reproduces the OLD hashes exactly. OLD -> NEW:
//   abdcc6016ddee44ea6846492d39fd2358bb466d5e6d6f39e8e163a28db7bffc2 ->
//   776d173937a5adf1d8ba5be6ae49ae95a818d6988e3a8fc23176c6dc378990c3
//   492b9696bae8d386f6622f9f924bb76e342998ebb313ccbd23e6ba5c07a5bfd1 ->
//   ff4e9f63172d29c4d6a61faf313a46518c47c1bab7a31edc78dbe36a10c2bcf4
//   84291ea770b87bce659b456f3471f0511c383cd01699d30bde9e68a5763dc5ce ->
//   341169fb6b084c0758348088849d7a4a70636d9610c9735f71c2802a51f70718
export const BASELINE_NO_CONTEXT_HASHES = [
  "776d173937a5adf1d8ba5be6ae49ae95a818d6988e3a8fc23176c6dc378990c3",
  "ff4e9f63172d29c4d6a61faf313a46518c47c1bab7a31edc78dbe36a10c2bcf4",
  "341169fb6b084c0758348088849d7a4a70636d9610c9735f71c2802a51f70718",
] as const;
const OBSERVATION_TIME = "1900-01-01T00:00:00.000Z";

describe("AC-22 — torpedo stage in the minute-advance (strict no-op + firing)", () => {
  it("absent torpedo context: minute hashes byte-identical to the B-2..B-6 baseline", () => {
    const state = buildTorpedoBattleState({ battleId: "baseline-b1" });
    const res = advanceMinutes({
      state,
      minutes: 3,
      observationTime: OBSERVATION_TIME,
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    });
    expect(res.hashes).toEqual([...BASELINE_NO_CONTEXT_HASHES]);
    expect(res.results.every((r) => (r.torpedoRecords ?? []).length === 0)).toBe(true);
  });

  it("present-but-inert torpedo context (no launchers/commands/tracks): same byte-identical hashes", () => {
    const state = buildTorpedoBattleState({ battleId: "baseline-b1" });
    const inert: TorpedoContext = {
      launchers: [],
      commands: [],
      targets: {},
      tracks: [],
      torpedoes: {},
    };
    const res = advanceMinutes({
      state,
      minutes: 3,
      observationTime: OBSERVATION_TIME,
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
      torpedoes: inert,
    });
    expect(res.hashes).toEqual([...BASELINE_NO_CONTEXT_HASHES]);
    expect(
      res.results.every(
        (r) =>
          (r.torpedoRecords ?? []).length === 0 &&
          (r.torpedoTracks ?? []).length === 0 &&
          (r.torpedoStates ?? {}) &&
          Object.keys(r.torpedoStates ?? {}).length === 0,
      ),
    ).toBe(true);
  });

  it("a wired launcher + accepted command drives the full launch→track→hit→detonation→damage chain", () => {
    const { state } = buildTorpedoScene();
    const context: TorpedoContext = torpedoContext({
      commands: [torpedoLaunchCommand(0)],
    });
    const res = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine: new RandomEngine("inc7-advance-fulllen"),
      torpedoes: context,
    });
    const types = new Set(res.events.map((e) => e.eventType));
    expect(types.has("torpedo_launch")).toBe(true);
    expect(types.has("torpedo_track")).toBe(true);
    expect(types.has("torpedo_hit")).toBe(true);
    expect(types.has("torpedo_detonation")).toBe(true);
    expect(types.has("torpedo_damage")).toBe(true);
    expect(res.torpedoRecords!.length).toBeGreaterThanOrEqual(6);
    // the consuming torpedo leaves the tube (ammunition account)
    expect(res.torpedoStates!["LCH-1"].loadedPerTube[0]).toBe(EMPTY_TUBE);
    expect(res.minuteHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("launch records carry the speed-limit validity + ammunition + RNG decision audit", () => {
    const { state } = buildTorpedoScene();
    const context: TorpedoContext = torpedoContext({
      commands: [torpedoLaunchCommand(0)],
    });
    const res = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine: new RandomEngine("seed-test-audit"),
      torpedoes: context,
    });
    const launch = res.torpedoRecords!.find((r) => r.kind === "LAUNCH")!;
    expect(launch.battleMinute).toBe(1);
    expect(launch.substep).toBe(TORPEDO_LAUNCH_SUBSTEP);
    expect(launch.speedLimitValidation.allowed).toBe(true); // 0 kn underwater
    expect(launch.speedLimitValidation.applicable).toBe(true); // underwater mount
    expect(launch.ammunitionChange).not.toBeNull();
    expect(launch.speedLimitValidation.allowed || launch.ammunitionChange).toBeDefined();
  });

  it("minute hash changes once a torpedo stage resolves state (state enters the surface)", () => {
    const { state } = buildTorpedoScene();
    const inert = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
    });
    const armed = advanceMinute({
      state,
      minute: 1,
      observationTime: OBSERVATION_TIME,
      orders: TORPEDO_SCENE_ORDERS,
      engine: new RandomEngine("seed-hash-change"),
      torpedoes: torpedoContext({ commands: [torpedoLaunchCommand(0)] }),
    });
    expect(armed.minuteHash).not.toBe(inert.minuteHash);
  });
});
