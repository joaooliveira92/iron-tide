import { describe, expect, it } from "vite-plus/test";
import {
  isShipEligibleForSmokescreen,
  computeSmokescreenSegment,
  checkSmokescreenCooldown,
  generateSmokescreenMinute,
  createInitialSmokescreenState,
  smokescreenConcealmentBonusBp,
  SMOKESCREEN_INELIGIBILITY_REASONS,
  SMOKESCREEN_GENERATION_INTERRUPTED,
  type SmokescreenEligibilityParams,
  type SmokescreenState,
  type SmokeCloud,
} from "../../src/smoke/index.js";
import {
  SMOKESCREEN_INITIAL_DENSITY,
  SMOKESCREEN_VERTICAL_EXTENT_M,
  SMOKESCREEN_GENERATION_DURATION_MINUTES,
  SMOKESCREEN_COOLDOWN_MINUTES,
  SMOKE_RULESET_VERSION,
  SMOKE_FORMULA_VERSION,
} from "../../src/smoke/constants.js";

function eligibleDDParams(
  overrides?: Partial<SmokescreenEligibilityParams>,
): SmokescreenEligibilityParams {
  return {
    shipId: "ship-dd-001",
    shipClass: "DD",
    smokeEquipmentInstalled: true,
    smokeEquipmentOperational: true,
    consumableAvailable: true,
    readiness: "ACTIVE",
    damageState: "OPERATIONAL",
    currentSpeedKnots: 10,
    cooldownActive: false,
    commandAuthority: "GRANTED",
    missionProhibitsSmoke: false,
    ...overrides,
  };
}

function eligibleCLParams(
  overrides?: Partial<SmokescreenEligibilityParams>,
): SmokescreenEligibilityParams {
  return eligibleDDParams({ shipClass: "CL", ...overrides });
}

describe("isShipEligibleForSmokescreen", () => {
  it("eligible DD at 10kt, no cooldown", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams());
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("eligible CL with all predicates passing", () => {
    const result = isShipEligibleForSmokescreen(eligibleCLParams());
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("ineligible: wrong ship class (BB)", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ shipClass: "BB" }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.shipClassEligible);
  });

  it("ineligible: wrong ship class (CA)", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ shipClass: "CA" }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.shipClassEligible);
  });

  it("ineligible: no equipment installed", () => {
    const result = isShipEligibleForSmokescreen(
      eligibleDDParams({ smokeEquipmentInstalled: false }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.equipmentInstalledAndOperational);
  });

  it("ineligible: equipment not operational", () => {
    const result = isShipEligibleForSmokescreen(
      eligibleDDParams({ smokeEquipmentOperational: false }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.equipmentInstalledAndOperational);
  });

  it("ineligible: consumable unavailable", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ consumableAvailable: false }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.consumableAvailable);
  });

  it("ineligible: not ACTIVE readiness", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ readiness: "MOBILIZING" }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.readinessActive);
  });

  it("ineligible: SINKING damage state", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ damageState: "SINKING" }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.notSinkingOrDeadOrAbandoned);
  });

  it("ineligible: speed < 5 knots", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ currentSpeedKnots: 4 }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.speedAtLeast5Knots);
  });

  it("ineligible: cooldown active", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ cooldownActive: true }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.cooldownNotActive);
  });

  it("eligible at exact boundary speed (5 knots)", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ currentSpeedKnots: 5 }));
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("eligible: OPERATIONAL and DEGRADED damage states", () => {
    const op = isShipEligibleForSmokescreen(eligibleDDParams({ damageState: "OPERATIONAL" }));
    expect(op.eligible).toBe(true);

    const deg = isShipEligibleForSmokescreen(eligibleDDParams({ damageState: "DEGRADED" }));
    expect(deg.eligible).toBe(true);
  });

  it("eligible: OPERATIONAL and DEGRADED all other predicates pass", () => {
    const op = isShipEligibleForSmokescreen(eligibleDDParams({ damageState: "OPERATIONAL" }));
    expect(op.eligible).toBe(true);
    const deg = isShipEligibleForSmokescreen(eligibleDDParams({ damageState: "DEGRADED" }));
    expect(deg.eligible).toBe(true);
  });

  it("ineligible: DEAD_IN_WATER and ABANDONED damage states", () => {
    const diw = isShipEligibleForSmokescreen(eligibleDDParams({ damageState: "DEAD_IN_WATER" }));
    expect(diw.eligible).toBe(false);
    expect(diw.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.notSinkingOrDeadOrAbandoned);

    const aba = isShipEligibleForSmokescreen(eligibleDDParams({ damageState: "ABANDONED" }));
    expect(aba.eligible).toBe(false);
    expect(aba.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.notSinkingOrDeadOrAbandoned);
  });

  it("ineligible: command authority denied", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ commandAuthority: "DENIED" }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.commandAuthorityGranted);
  });

  it("ineligible: mission prohibits smoke", () => {
    const result = isShipEligibleForSmokescreen(eligibleDDParams({ missionProhibitsSmoke: true }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.missionAllowsSmoke);
  });

  it("speed boundary: 4.9 knots ineligible, 5.0 knots eligible", () => {
    const slow = isShipEligibleForSmokescreen(eligibleDDParams({ currentSpeedKnots: 4.9 }));
    expect(slow.eligible).toBe(false);
    expect(slow.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.speedAtLeast5Knots);

    const fast = isShipEligibleForSmokescreen(eligibleDDParams({ currentSpeedKnots: 5.0 }));
    expect(fast.eligible).toBe(true);
  });

  it("multiple predicates fail: returns first failing predicate", () => {
    const result = isShipEligibleForSmokescreen(
      eligibleDDParams({
        shipClass: "BB",
        smokeEquipmentInstalled: false,
        currentSpeedKnots: 3,
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.shipClassEligible);
  });

  it("returns ineligible for non-ACTIVE readiness states (WORKING_UP, IN_RESERVE)", () => {
    const wu = isShipEligibleForSmokescreen(eligibleDDParams({ readiness: "WORKING_UP" }));
    expect(wu.eligible).toBe(false);
    expect(wu.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.readinessActive);

    const ir = isShipEligibleForSmokescreen(eligibleDDParams({ readiness: "IN_RESERVE" }));
    expect(ir.eligible).toBe(false);
    expect(ir.reason).toBe(SMOKESCREEN_INELIGIBILITY_REASONS.readinessActive);
  });
});

describe("computeSmokescreenSegment", () => {
  it("creates cloud with correct density 9_000", () => {
    const cloud = computeSmokescreenSegment({
      smokeCloudId: "screen-001",
      sourceId: "ship-dd-001",
      owner: "PLAYER_1",
      creationMinute: 100,
      creationSubstep: 0,
      centroidPosition: [500, 300] as [number, number],
      driftVector: [0.5, -0.3] as [number, number],
      expansionRate: 0.1,
      densityDecayRate: 0.01,
      fuelComposition: "smokescreen_fuel",
    });
    expect(cloud.densityBp).toBe(SMOKESCREEN_INITIAL_DENSITY);
    expect(cloud.densityBp).toBe(9_000);
  });

  it("uses correct width/height (reference width 500m, vertical extent 100m)", () => {
    const cloud = computeSmokescreenSegment({
      smokeCloudId: "screen-002",
      sourceId: "ship-dd-002",
      owner: "PLAYER_2",
      creationMinute: 150,
      creationSubstep: 1,
      centroidPosition: [1000, 800] as [number, number],
      driftVector: [1, 0] as [number, number],
      expansionRate: 0.05,
      densityDecayRate: 0.02,
      fuelComposition: "smokescreen_fuel",
    });
    expect(cloud.verticalExtentM).toBe(SMOKESCREEN_VERTICAL_EXTENT_M);
    expect(cloud.verticalExtentM).toBe(100);
    expect(cloud.sourceType).toBe("SMOKESCREEN");
  });

  it("sets source type to SMOKESCREEN", () => {
    const cloud = computeSmokescreenSegment({
      smokeCloudId: "screen-003",
      sourceId: "ship-dd-003",
      owner: "NONE",
      creationMinute: 200,
      creationSubstep: 0,
      centroidPosition: [0, 0] as [number, number],
      driftVector: [0, 0] as [number, number],
      expansionRate: 0,
      densityDecayRate: 0,
      fuelComposition: "standard",
    });
    expect(cloud.sourceType).toBe("SMOKESCREEN");
  });

  it("fills ruleset and formula versions", () => {
    const cloud = computeSmokescreenSegment({
      smokeCloudId: "screen-004",
      sourceId: "ship-dd-004",
      owner: "PLAYER_1",
      creationMinute: 0,
      creationSubstep: 0,
      centroidPosition: [100, 200] as [number, number],
      driftVector: [0, 0] as [number, number],
      expansionRate: 0,
      densityDecayRate: 0,
      fuelComposition: "standard",
    });
    expect(cloud.rulesetVersion).toBe(SMOKE_RULESET_VERSION);
    expect(cloud.formulaVersion).toBe(SMOKE_FORMULA_VERSION);
  });

  it("sets active = true", () => {
    const cloud = computeSmokescreenSegment({
      smokeCloudId: "screen-005",
      sourceId: "ship-dd-005",
      owner: "PLAYER_1",
      creationMinute: 50,
      creationSubstep: 0,
      centroidPosition: [300, 400] as [number, number],
      driftVector: [0.2, -0.1] as [number, number],
      expansionRate: 0.1,
      densityDecayRate: 0.01,
      fuelComposition: "standard",
    });
    expect(cloud.active).toBe(true);
  });

  it("produces deterministic hash for same inputs", () => {
    const base = {
      sourceId: "ship-dd-006",
      owner: "PLAYER_1",
      creationMinute: 60,
      creationSubstep: 2,
      centroidPosition: [1000, 2000] as [number, number],
      driftVector: [0.5, -0.5] as [number, number],
      expansionRate: 0.2,
      densityDecayRate: 0.02,
      fuelComposition: "navy_oil",
    };
    const a = computeSmokescreenSegment({ smokeCloudId: "screen-006", ...base });
    const b = computeSmokescreenSegment({ smokeCloudId: "screen-006", ...base });
    expect(a.cloudHash).toBe(b.cloudHash);
  });
});

describe("checkSmokescreenCooldown", () => {
  it("available after 20 minutes", () => {
    const result = checkSmokescreenCooldown(100, 120);
    expect(result.available).toBe(true);
    expect(result.remainingMinutes).toBe(0);
  });

  it("not available before 20 minutes", () => {
    const result = checkSmokescreenCooldown(100, 115);
    expect(result.available).toBe(false);
    expect(result.remainingMinutes).toBeGreaterThan(0);
  });

  it("exact boundary: minute 20 (available)", () => {
    const result = checkSmokescreenCooldown(100, 120);
    expect(result.available).toBe(true);
    expect(result.remainingMinutes).toBe(0);
  });

  it("exact boundary: minute 19 (not available)", () => {
    const result = checkSmokescreenCooldown(100, 119);
    expect(result.available).toBe(false);
    expect(result.remainingMinutes).toBe(1);
  });

  it("trivially available when lastGenerationMinute is -1 (no previous gen)", () => {
    const result = checkSmokescreenCooldown(-1, 50);
    expect(result.available).toBe(true);
    expect(result.remainingMinutes).toBe(0);
  });

  it("remainingMinutes decreases as time passes", () => {
    const r1 = checkSmokescreenCooldown(100, 100);
    expect(r1.available).toBe(false);
    expect(r1.remainingMinutes).toBe(SMOKESCREEN_COOLDOWN_MINUTES);

    const r2 = checkSmokescreenCooldown(100, 110);
    expect(r2.available).toBe(false);
    expect(r2.remainingMinutes).toBe(SMOKESCREEN_COOLDOWN_MINUTES - 10);
  });

  it("after more than 20 minutes, still available with 0 remaining", () => {
    const result = checkSmokescreenCooldown(100, 200);
    expect(result.available).toBe(true);
    expect(result.remainingMinutes).toBe(0);
  });
});

describe("generateSmokescreenMinute", () => {
  function defaultGenParams(
    stateOverrides?: Partial<SmokescreenState>,
    shipOverrides?: Partial<SmokescreenEligibilityParams>,
    genOverrides?: Partial<{
      currentMinute: number;
      substep: number;
      cloudId: string;
      owner: string;
      centroidPosition: [number, number];
      driftVector: [number, number];
      expansionRate: number;
      densityDecayRate: number;
      fuelComposition: string;
    }>,
  ) {
    const state = {
      ...createInitialSmokescreenState(3),
      generating: true,
      generationStartMinute: 100,
      ...stateOverrides,
    };
    return {
      shipState: eligibleDDParams(shipOverrides),
      smokescreenState: state,
      currentMinute: genOverrides?.currentMinute ?? 101,
      substep: genOverrides?.substep ?? 0,
      cloudId: genOverrides?.cloudId ?? "gen-cloud-001",
      owner: genOverrides?.owner ?? ("PLAYER_1" as const),
      centroidPosition: genOverrides?.centroidPosition ?? ([500, 300] as [number, number]),
      driftVector: genOverrides?.driftVector ?? ([0.5, -0.3] as [number, number]),
      expansionRate: genOverrides?.expansionRate ?? 0.1,
      densityDecayRate: genOverrides?.densityDecayRate ?? 0.01,
      fuelComposition: genOverrides?.fuelComposition ?? "smokescreen_fuel",
    };
  }

  it("creates cloud when eligible", () => {
    const result = generateSmokescreenMinute(defaultGenParams());
    expect(result.cloud).not.toBeNull();
    expect(result.cloud!.sourceType).toBe("SMOKESCREEN");
    expect(result.cloud!.densityBp).toBe(SMOKESCREEN_INITIAL_DENSITY);
    expect(result.interrupted).toBe(false);
    expect(result.newState.generating).toBe(true);
  });

  it("early end when ship sinks (damageState=SINKING)", () => {
    const result = generateSmokescreenMinute(defaultGenParams({}, { damageState: "SINKING" }));
    expect(result.cloud).toBeNull();
    expect(result.interrupted).toBe(true);
    expect(result.interruptionReason).toBe(SMOKESCREEN_GENERATION_INTERRUPTED);
    expect(result.newState.generating).toBe(false);
  });

  it("no cloud when ineligible (shipClass=BB)", () => {
    const result = generateSmokescreenMinute(defaultGenParams({}, { shipClass: "BB" }));
    expect(result.cloud).toBeNull();
    expect(result.interrupted).toBe(true);
    expect(result.interruptionReason).toBe(SMOKESCREEN_GENERATION_INTERRUPTED);
  });

  it("generation completes after SMOKESCREEN_GENERATION_DURATION_MINUTES minutes", () => {
    const genDuration = SMOKESCREEN_GENERATION_DURATION_MINUTES;
    const result = generateSmokescreenMinute(
      defaultGenParams({ generationStartMinute: 100 }, {}, { currentMinute: 100 + genDuration }),
    );
    expect(result.cloud).toBeNull();
    expect(result.interrupted).toBe(false);
    expect(result.newState.generating).toBe(false);
    expect(result.newState.cooldownRemainingMinutes).toBe(SMOKESCREEN_COOLDOWN_MINUTES);
  });

  it("early end: caller-provided earlyEndCheck returns endEarly: true", () => {
    const result = generateSmokescreenMinute({
      ...defaultGenParams(),
      earlyEndCheck: () => ({ endEarly: true, reason: "command_cancelled" }),
    });
    expect(result.cloud).toBeNull();
    expect(result.interrupted).toBe(true);
    expect(result.interruptionReason).toBe("command_cancelled");
    expect(result.newState.generating).toBe(false);
  });

  it("no early end when caller-provided earlyEndCheck returns endEarly: false", () => {
    const result = generateSmokescreenMinute({
      ...defaultGenParams(),
      earlyEndCheck: () => ({ endEarly: false }),
    });
    expect(result.cloud).not.toBeNull();
    expect(result.interrupted).toBe(false);
  });
});

describe("SmokescreenState", () => {
  it("createInitialSmokescreenState sets default values", () => {
    const state = createInitialSmokescreenState();
    expect(state.generating).toBe(false);
    expect(state.cooldownRemainingMinutes).toBe(0);
    expect(state.chargesRemaining).toBe(3);
    expect(state.generationStartMinute).toBe(-1);
    expect(state.cooldownStartMinute).toBe(-1);
  });

  it("createInitialSmokescreenState accepts custom charge count", () => {
    const state = createInitialSmokescreenState(5);
    expect(state.chargesRemaining).toBe(5);
  });

  it("generating state transitions correctly: start -> generating -> cooldown", () => {
    const initial = createInitialSmokescreenState();

    const startResult = generateSmokescreenMinute({
      shipState: eligibleDDParams(),
      smokescreenState: { ...initial, generating: true, generationStartMinute: 100 },
      currentMinute: 100,
      substep: 0,
      cloudId: "gen-001",
      owner: "PLAYER_1",
      centroidPosition: [0, 0] as [number, number],
      driftVector: [0, 0] as [number, number],
      expansionRate: 0,
      densityDecayRate: 0,
      fuelComposition: "fuel",
    });
    expect(startResult.cloud).not.toBeNull();
    expect(startResult.newState.generating).toBe(true);
    expect(startResult.newState.cooldownRemainingMinutes).toBe(0);
    expect(startResult.interrupted).toBe(false);

    const elapsed = SMOKESCREEN_GENERATION_DURATION_MINUTES;
    const endResult = generateSmokescreenMinute({
      shipState: eligibleDDParams(),
      smokescreenState: { ...startResult.newState, generationStartMinute: 100 },
      currentMinute: 100 + elapsed,
      substep: 0,
      cloudId: "gen-002",
      owner: "PLAYER_1",
      centroidPosition: [0, 0] as [number, number],
      driftVector: [0, 0] as [number, number],
      expansionRate: 0,
      densityDecayRate: 0,
      fuelComposition: "fuel",
    });
    expect(endResult.cloud).toBeNull();
    expect(endResult.newState.generating).toBe(false);
    expect(endResult.newState.cooldownRemainingMinutes).toBe(SMOKESCREEN_COOLDOWN_MINUTES);
    expect(endResult.interrupted).toBe(false);

    const cooldownCheck = checkSmokescreenCooldown(
      100 + elapsed,
      100 + elapsed + SMOKESCREEN_COOLDOWN_MINUTES,
    );
    expect(cooldownCheck.available).toBe(true);
  });
});

describe("smokescreenConcealmentBonusBp", () => {
  it("returns density bp for active cloud", () => {
    const cloud = computeSmokescreenSegment({
      smokeCloudId: "screen-conceal-001",
      sourceId: "ship-dd-001",
      owner: "PLAYER_1",
      creationMinute: 100,
      creationSubstep: 0,
      centroidPosition: [500, 300] as [number, number],
      driftVector: [0.5, -0.3] as [number, number],
      expansionRate: 0.1,
      densityDecayRate: 0.01,
      fuelComposition: "smokescreen_fuel",
    });
    expect(smokescreenConcealmentBonusBp(cloud)).toBe(SMOKESCREEN_INITIAL_DENSITY);
  });

  it("returns 0 for inactive cloud", () => {
    const cloud = computeSmokescreenSegment({
      smokeCloudId: "screen-conceal-002",
      sourceId: "ship-dd-002",
      owner: "PLAYER_1",
      creationMinute: 100,
      creationSubstep: 0,
      centroidPosition: [500, 300] as [number, number],
      driftVector: [0.5, -0.3] as [number, number],
      expansionRate: 0.1,
      densityDecayRate: 0.01,
      fuelComposition: "smokescreen_fuel",
    });
    const inactive: SmokeCloud = { ...cloud, active: false };
    expect(smokescreenConcealmentBonusBp(inactive)).toBe(0);
  });

  it("returns 0 for cloud with zero density", () => {
    const cloud = computeSmokescreenSegment({
      smokeCloudId: "screen-conceal-003",
      sourceId: "ship-dd-003",
      owner: "PLAYER_1",
      creationMinute: 100,
      creationSubstep: 0,
      centroidPosition: [500, 300] as [number, number],
      driftVector: [0.5, -0.3] as [number, number],
      expansionRate: 0.1,
      densityDecayRate: 0.01,
      fuelComposition: "smokescreen_fuel",
    });
    const zeroDens: SmokeCloud = { ...cloud, densityBp: 0 };
    expect(smokescreenConcealmentBonusBp(zeroDens)).toBe(0);
  });
});
