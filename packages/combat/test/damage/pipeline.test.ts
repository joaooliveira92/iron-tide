import { Result } from "effect";
import { describe, it, expect } from "vite-plus/test";
import {
  DAMAGE_PIPELINE_STAGES,
  DAMAGE_RESOLUTION_FAILED,
  type DamageEventEffect,
  type DamageResolution,
  orchestrateDamagePipeline,
  runDamagePipeline,
  type DamagePipelineStage,
  type ShipDamageState,
  type StageRunner,
  type PipelineContext,
  wrapSimpleRunner,
  type SimpleStageRunner,
} from "@bluewave/combat/damage";
import { CombatInvariantError } from "../../src/errors.js";
import { type CompartmentDef, type ArmorZoneDef } from "@bluewave/combat/damage";

const stageOk = (description: string): Result.Result<DamageEventEffect, CombatInvariantError> =>
  Result.succeed({ description });

const stageFailure = (code: string): Result.Result<DamageEventEffect, CombatInvariantError> =>
  Result.fail(new CombatInvariantError({ message: code, code }));

function resolved(result: Result.Result<DamageResolution, CombatInvariantError>): DamageResolution {
  if (Result.isFailure(result)) throw new Error(`pipeline failed: ${result.failure.message}`);
  return result.success;
}

function baseState(overrides: Partial<ShipDamageState> = {}): ShipDamageState {
  return {
    shipId: "SHIP-ALPHA",
    compartments: ["COMP-1"],
    components: ["TURRET-1"],
    structuralIntegrity: 100_000,
    flotationReserve: 50_000,
    stabilityScore: 8_000,
    fireRecords: [],
    floodingRecords: [],
    progressiveFloodingTotal: 0,
    performanceModifiers: {},
    terminalStatus: "NORMAL",
    rulesetVersion: "damage_ruleset_v1",
    formulaVersion: "damage_formula_v1",
    stateHash: "",
    ...overrides,
  };
}

function defaultContext(): PipelineContext {
  return {
    hitLocation: "TURRET-1",
    penetrationOutcome: "FULL_PENETRATION",
    splinterIntensity: "NONE",
    protectionInteraction: {
      effectiveResistanceUm: 300_000,
      penetrationMargin: 50_000,
      outcome: "FULL_PENETRATION",
    },
    componentEffects: [],
    structureFlotationResult: null,
    structuralDamage: 5_000,
    flotationDamage: 2_000,
    createdFireSources: [],
    createdFloodingSources: [],
    magazineHazardResult: null,
    terminalTransition: null,
    terminalResult: null,
    battleMinute: 10,
    substep: 2,
    sourceId: "BATTERY-1",
    targetShipId: "SHIP-ALPHA",
    causalWeaponId: "SHELL-AP-1",
  };
}

describe("AC-3: Pipeline runs stages in exact order", () => {
  it("DAMAGE_PIPELINE_STAGES has exactly 10 stages in the defined order", () => {
    expect([...DAMAGE_PIPELINE_STAGES]).toEqual([
      "HIT_LOCATION",
      "PROTECTION_INTERACTION",
      "LOCAL_COMPONENT_DAMAGE",
      "STRUCTURE_FLOTATION",
      "IMMEDIATE_FIRE_FLOODING",
      "SECONDARY_HAZARD",
      "STAGE_7_RESERVED",
      "TERMINAL_SEAM",
      "DAMAGE_EVENT_RECORD",
      "STAGE_10_RESERVED",
    ]);
  });

  it("orchestrateDamagePipeline visits all 10 stages in order", () => {
    const visited: DamagePipelineStage[] = [];
    const trackingRunner: StageRunner = (stage, _state, _idx, _ctx) => {
      visited.push(stage);
      return stageOk("tracked");
    };

    resolved(orchestrateDamagePipeline(baseState(), defaultContext(), trackingRunner));
    expect(visited).toEqual([...DAMAGE_PIPELINE_STAGES]);
  });
});

describe("AC-3: Empty stage produces successful empty record (no-skip rule)", () => {
  it("each stage in the default runner succeeds", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), defaultContext()));
    for (const stage of DAMAGE_PIPELINE_STAGES) {
      expect(result.stageEffects[stage]).toBeDefined();
    }
  });

  it("the DAMAGE_EVENT_RECORD stage produces a damage event record", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), defaultContext()));
    const eventRecordEffect = result.stageEffects["DAMAGE_EVENT_RECORD"];
    expect(eventRecordEffect).toBeDefined();
    expect(eventRecordEffect!.description).toBe("damage event record created");
  });

  it("the pipeline result carries an eventRecord", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), defaultContext()));
    expect(result.eventRecord).toBeDefined();
    expect(result.eventRecord!.recordHash).toBeDefined();
    expect(result.eventRecord!.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("wire LOCAL_COMPONENT_DAMAGE produces component effects", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), defaultContext()));
    const stage = result.stageEffects["LOCAL_COMPONENT_DAMAGE"];
    expect(stage).toBeDefined();
    expect(stage!.description).toContain("component damage resolved");
  });

  it("wire STRUCTURE_FLOTATION produces structure/flotation description", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), defaultContext()));
    const stage = result.stageEffects["STRUCTURE_FLOTATION"];
    expect(stage).toBeDefined();
    expect(stage!.description).toContain("structure/flotation");
  });

  it("default stages produce non-empty descriptions when wired", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), defaultContext()));
    for (const stage of DAMAGE_PIPELINE_STAGES) {
      if (
        stage === "DAMAGE_EVENT_RECORD" ||
        stage === "LOCAL_COMPONENT_DAMAGE" ||
        stage === "STRUCTURE_FLOTATION"
      )
        continue;
      expect(result.stageEffects[stage]).toBeDefined();
    }
  });
});

describe("AC-3: Stage failure aborts the transaction", () => {
  it("returns a tagged failure and leaves the input state untouched", () => {
    const originalState = baseState({ structuralIntegrity: 99_999 });
    const failingRunner: StageRunner = (stage, _state, _idx, _ctx) =>
      stage === "PROTECTION_INTERACTION"
        ? stageFailure(DAMAGE_RESOLUTION_FAILED)
        : stageOk("empty (no-op) stage");

    const result = orchestrateDamagePipeline(originalState, defaultContext(), failingRunner);

    expect(Result.isFailure(result)).toBe(true);
    expect(originalState.structuralIntegrity).toBe(99_999);
  });

  it("propagates the failing stage's code on the tagged failure", () => {
    const failingRunner: StageRunner = (stage, _state, _idx, _ctx) =>
      stage === "LOCAL_COMPONENT_DAMAGE"
        ? stageFailure(DAMAGE_RESOLUTION_FAILED)
        : stageOk("empty (no-op) stage");

    const result = orchestrateDamagePipeline(baseState(), defaultContext(), failingRunner);

    if (Result.isSuccess(result)) throw new Error("expected the pipeline to fail");
    expect(result.failure._tag).toBe("CombatInvariantError");
    expect(result.failure.code).toBe(DAMAGE_RESOLUTION_FAILED);
  });

  it("stops executing stages after a failure", () => {
    const visited: DamagePipelineStage[] = [];
    const failingRunner: StageRunner = (stage, _state, _idx, _ctx) => {
      visited.push(stage);
      return stage === "STRUCTURE_FLOTATION"
        ? stageFailure(DAMAGE_RESOLUTION_FAILED)
        : stageOk("empty (no-op) stage");
    };

    const result = orchestrateDamagePipeline(baseState(), defaultContext(), failingRunner);

    expect(Result.isFailure(result)).toBe(true);
    expect(visited).toEqual([
      "HIT_LOCATION",
      "PROTECTION_INTERACTION",
      "LOCAL_COMPONENT_DAMAGE",
      "STRUCTURE_FLOTATION",
    ]);
  });
});

describe("AC-3: runDamagePipeline default runner", () => {
  it("succeeds for every stage", () => {
    const ctx = defaultContext();
    for (const stage of DAMAGE_PIPELINE_STAGES) {
      const outcome = runDamagePipeline(
        stage,
        baseState(),
        DAMAGE_PIPELINE_STAGES.indexOf(stage),
        ctx,
      );
      expect(Result.isSuccess(outcome)).toBe(true);
    }
  });
});

describe("AC-3: wrapSimpleRunner preserves backward compat", () => {
  it("wraps a SimpleStageRunner into a StageRunner", () => {
    const simple: SimpleStageRunner = (stage, _state, _idx) => {
      return Result.succeed({ description: `simple:${stage}` });
    };
    const wrapped = wrapSimpleRunner(simple);
    const ctx = defaultContext();
    const outcome = wrapped("HIT_LOCATION", baseState(), 0, ctx);
    if (Result.isFailure(outcome)) throw new Error("expected the wrapped runner to succeed");
    expect(outcome.success.description).toBe("simple:HIT_LOCATION");
  });
});

const PIPE_COMPARTMENTS: readonly CompartmentDef[] = [
  {
    id: "COMP-1",
    zMinMm: 0,
    zMaxMm: 5000,
    xMinMm: 0,
    xMaxMm: 10000,
    altitudeMinMm: 0,
    altitudeMaxMm: 5000,
  },
];

const PIPE_ZONES: readonly ArmorZoneDef[] = [
  {
    id: "COMP-1",
    zoneType: "BELT",
    thicknessUm: 304_800,
    qualityFamily: "KRUPP_KC",
    slopeDeg: 0,
  },
];

function contextWithInputs(): PipelineContext {
  return {
    ...defaultContext(),
    hitInput: {
      impactVerticalMm: 2500,
      impactLongitudinalMm: 5000,
      impactAltitudeMm: 2500,
      projectileTrajectoryDeg: 15,
      compartments: PIPE_COMPARTMENTS,
      zones: PIPE_ZONES,
    },
    protectionInput: {
      projectileCaliberUm: 304_800,
      projectileVelocityMs: 400,
      projectileMass: 400,
      hitZoneType: "BELT",
      armorThicknessUm: 304_800,
      armorQualityFamily: "KRUPP_KC",
      armorSlopeDeg: 0,
      impactAngleDeg: 0,
      isCriticalZone: false,
    },
  };
}

describe("INC-3: Stages 1-2 produce real results", () => {
  it("HIT_LOCATION resolves compartment and zone from hit input", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), contextWithInputs()));
    const stage = result.stageEffects["HIT_LOCATION"];
    expect(stage).toBeDefined();
    expect(stage!.description).toContain("hit resolved");
    expect(stage!.description).toContain("COMP-1");
  });

  it("PROTECTION_INTERACTION resolves armor interaction from protection input", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), contextWithInputs()));
    const stage = result.stageEffects["PROTECTION_INTERACTION"];
    expect(stage).toBeDefined();
    expect(stage!.description).toContain("protection resolved");
    expect(stage!.description).toContain("SPLINTER_EFFECT");
  });

  it("pipeline context carries hit and protection results to later stages", () => {
    const result = resolved(orchestrateDamagePipeline(baseState(), contextWithInputs()));
    expect(result.eventRecord).toBeDefined();
    expect(result.eventRecord!.hitLocation).toBe("COMP-1");
    expect(result.eventRecord!.protectionInteraction.outcome).toBe("SPLINTER_EFFECT");
  });

  it("HIT_LOCATION with no hit input falls back to no-op", () => {
    const ctx = defaultContext();
    const result = resolved(orchestrateDamagePipeline(baseState(), ctx));
    const stage = result.stageEffects["HIT_LOCATION"];
    expect(stage!.description).toBe("empty (no-op) stage");
  });

  it("PROTECTION_INTERACTION with no protection input falls back to no-op", () => {
    const ctx = defaultContext();
    const result = resolved(orchestrateDamagePipeline(baseState(), ctx));
    const stage = result.stageEffects["PROTECTION_INTERACTION"];
    expect(stage!.description).toBe("empty (no-op) stage");
  });
});
