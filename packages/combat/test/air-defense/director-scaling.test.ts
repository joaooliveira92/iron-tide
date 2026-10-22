import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED,
  AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
  AttackType,
  assignAADirectors,
  type AirDefenseAttack,
  type DirectorAssignmentInput,
  type LayerId,
  Category,
  compareThreatPriority,
  computeDirectorFactorBp,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  directorScalingMarkers,
  INVALID_AIR_DEFENSE_STATE,
  Layer,
} from "@bluewave/combat/air-defense";

const OPERABLE = {
  defenderSunk: false,
  defenderAbandoned: false,
  systemPowered: true,
  systemOperational: true,
};

type SysOverrides = Partial<Parameters<typeof createAirDefenseSystemDefinition>[0]>;
type AtkOverrides = Partial<Parameters<typeof createAirDefenseAttack>[0]>;

function aaSystem(layer: LayerId, overrides: SysOverrides = {}) {
  return createAirDefenseSystemDefinition({
    systemId: "sys_heavy",
    layer,
    category:
      layer === Layer.HEAVY_AA
        ? Category.HEAVY_AA
        : layer === Layer.MEDIUM_AA
          ? Category.MEDIUM_AA
          : layer === Layer.LIGHT_AA
            ? Category.LIGHT_AA
            : Category.CIWS_TERMINAL_DEFENSE,
    profileEligibility: new Set(["AIRCRAFT_LEVEL_BOMBING"]),
    engagementChannels: new Set([`ch_${layer}`]),
    ...overrides,
  });
}

function atk(attackId: string, overrides: AtkOverrides = {}): AirDefenseAttack {
  return createAirDefenseAttack({
    attackId,
    formationId: `frm_${attackId}`,
    targetId: "ship_001",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    isReleased: false,
    timeToImpactMs: SafeInt(60_000),
    formationSize: SafeInt(4),
    ...overrides,
  });
}

function directors(...ids: string[]) {
  return ids.map((directorId) => ({ directorId, operational: true }));
}

function makeInput(partial: Partial<DirectorAssignmentInput>): DirectorAssignmentInput {
  return {
    defenderId: "ship_001",
    systems: [],
    attacks: [],
    candidates: [],
    directorChannels: [],
    operability: OPERABLE,
    ...partial,
  };
}

describe("AC-8: §12 director scaling table", () => {
  it("matches the shipped schedule exactly: 0→5_000, 1→10_000, 2→18_000, 3→25_000, 4→31_000", () => {
    expect(computeDirectorFactorBp(0)).toBe(5_000);
    expect(computeDirectorFactorBp(1)).toBe(10_000);
    expect(computeDirectorFactorBp(2)).toBe(18_000);
    expect(computeDirectorFactorBp(3)).toBe(25_000);
    expect(computeDirectorFactorBp(4)).toBe(31_000);
  });

  it("caps at the shipped normal-scaling cap 4: 5+ stays 31_000 with no additional directed-fire value", () => {
    expect(computeDirectorFactorBp(5)).toBe(31_000);
    expect(computeDirectorFactorBp(6)).toBe(31_000);
    expect(computeDirectorFactorBp(9)).toBe(31_000);
  });

  it("emits AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED only above the shipped cap (5+)", () => {
    expect(directorScalingMarkers(0)).toEqual([]);
    expect(directorScalingMarkers(4)).toEqual([]);
    expect(directorScalingMarkers(5)).toEqual([AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED]);
    expect(directorScalingMarkers(9)).toEqual([AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED]);
  });

  it("fails closed on a negative count with INVALID_AIR_DEFENSE_STATE", () => {
    let caught: unknown;
    try {
      computeDirectorFactorBp(-1);
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);

    let caughtMarkers: unknown;
    try {
      directorScalingMarkers(-2);
    } catch (e) {
      caughtMarkers = e;
    }
    expect(isBluewaveError(caughtMarkers)).toBe(true);
    expect((caughtMarkers as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
  });

  it("fails closed on a non-integer count (SafeInt boundary)", () => {
    expect(() => computeDirectorFactorBp(1.5)).toThrow(BluewaveError);
    expect(() => computeDirectorFactorBp(Number.NaN)).toThrow(BluewaveError);
    expect(() => directorScalingMarkers(2.5)).toThrow(BluewaveError);
  });
});

describe("AC-8: §11 defense layer priority (key 1)", () => {
  it("assigns directors in canonical layer order HEAVY → MEDIUM → LIGHT → CIWS regardless of input order", () => {
    const heavy = aaSystem(Layer.HEAVY_AA, { systemId: "sys_heavy" });
    const medium = aaSystem(Layer.MEDIUM_AA, { systemId: "sys_medium" });
    const light = aaSystem(Layer.LIGHT_AA, { systemId: "sys_light" });
    const ciws = aaSystem(Layer.CIWS_TERMINAL_DEFENSE, { systemId: "sys_ciws" });
    const attack = atk("atk_001");
    const result = assignAADirectors(
      makeInput({
        systems: [light, ciws, heavy, medium],
        attacks: [attack],
        candidates: [
          { systemId: "sys_light", attackId: "atk_001" },
          { systemId: "sys_ciws", attackId: "atk_001" },
          { systemId: "sys_heavy", attackId: "atk_001" },
          { systemId: "sys_medium", attackId: "atk_001" },
        ],
        directorChannels: directors("dir_01", "dir_02", "dir_03", "dir_04"),
      }),
    );
    expect(result.assignments.map((entry) => entry.layer)).toEqual([
      "HEAVY_AA",
      "MEDIUM_AA",
      "LIGHT_AA",
      "CIWS_TERMINAL_DEFENSE",
    ]);
    expect(result.assignments.map((entry) => entry.systemId)).toEqual([
      "sys_heavy",
      "sys_medium",
      "sys_light",
      "sys_ciws",
    ]);
    expect(result.operationalDirectorCount).toBe(4);
    expect(result.directorFactorBp).toBe(31_000);
    expect(result.markers).toEqual([]);
  });

  it("gives the single available director to the HEAVY_AA candidate over lower-priority layers", () => {
    const light = aaSystem(Layer.LIGHT_AA, { systemId: "sys_light" });
    const heavy = aaSystem(Layer.HEAVY_AA, { systemId: "sys_heavy" });
    const attack = atk("atk_001");
    const result = assignAADirectors(
      makeInput({
        systems: [light, heavy],
        attacks: [attack],
        candidates: [
          { systemId: "sys_light", attackId: "atk_001" },
          { systemId: "sys_heavy", attackId: "atk_001" },
        ],
        directorChannels: directors("dir_a"),
      }),
    );
    expect(result.assignments[0]).toMatchObject({
      systemId: "sys_heavy",
      directorId: "dir_a",
      reason: null,
    });
    expect(result.assignments[1]).toMatchObject({
      systemId: "sys_light",
      directorId: null,
      reason: AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
    });
  });
});

describe("AC-8: §11 threat score descending (key 2, the §17 comparator)", () => {
  it("key (1): a released threat is assigned before an unreleased threat even when it is farther from impact (§17.1)", () => {
    const system = aaSystem(Layer.MEDIUM_AA, { systemId: "sys_medium" });
    const released = atk("atk_released", { isReleased: true, timeToImpactMs: SafeInt(90_000) });
    const unreleased = atk("atk_unreleased", {
      isReleased: false,
      timeToImpactMs: SafeInt(10_000),
    });
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks: [released, unreleased],
        candidates: [
          { systemId: "sys_medium", attackId: "atk_unreleased" },
          { systemId: "sys_medium", attackId: "atk_released" },
        ],
        directorChannels: directors("dir_a"),
      }),
    );
    expect(result.assignments[0]!.attackId).toBe("atk_released");
    expect(result.assignments[1]!.directorId).toBeNull();
  });

  it("key (2): among unreleased threats, the closer-to-impact attack is assigned first", () => {
    const system = aaSystem(Layer.MEDIUM_AA, { systemId: "sys_medium" });
    const near = atk("atk_near", { timeToImpactMs: SafeInt(30_000) });
    const far = atk("atk_far", { timeToImpactMs: SafeInt(90_000) });
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks: [far, near],
        candidates: [
          { systemId: "sys_medium", attackId: "atk_far" },
          { systemId: "sys_medium", attackId: "atk_near" },
        ],
        directorChannels: directors("dir_a"),
      }),
    );
    expect(result.assignments[0]!.attackId).toBe("atk_near");
    expect(result.assignments[1]!.directorId).toBeNull();
  });

  it("key (3): a threat against the defended ship beats a protected nearby ship at equal time to impact (§17.3-4)", () => {
    const system = aaSystem(Layer.MEDIUM_AA, { systemId: "sys_medium" });
    const own = atk("atk_own", { targetId: "ship_001" });
    const other = atk("atk_other", { targetId: "ship_002" });
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks: [other, own],
        candidates: [
          { systemId: "sys_medium", attackId: "atk_other" },
          { systemId: "sys_medium", attackId: "atk_own" },
        ],
        directorChannels: directors("dir_a"),
      }),
    );
    expect(result.assignments[0]!.attackId).toBe("atk_own");
    expect(result.assignments[1]!.directorId).toBeNull();
  });

  it("key (4): the larger formation (expected-damage proxy descending, §17.5) is assigned first", () => {
    const system = aaSystem(Layer.MEDIUM_AA, { systemId: "sys_medium" });
    const big = atk("atk_big", { formationSize: SafeInt(8) });
    const small = atk("atk_small", { formationSize: SafeInt(2) });
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks: [small, big],
        candidates: [
          { systemId: "sys_medium", attackId: "atk_small" },
          { systemId: "sys_medium", attackId: "atk_big" },
        ],
        directorChannels: directors("dir_a"),
      }),
    );
    expect(result.assignments[0]!.attackId).toBe("atk_big");
    expect(result.assignments[1]!.directorId).toBeNull();
  });

  it("key (5): at full threat tie, the lower target identifier (codepoint ascending, §17.7) is assigned first", () => {
    const system = aaSystem(Layer.MEDIUM_AA, { systemId: "sys_medium" });
    const a = atk("atk_a", { targetId: "ship_002" });
    const b = atk("atk_b", { targetId: "ship_003" });
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks: [b, a],
        candidates: [
          { systemId: "sys_medium", attackId: "atk_b" },
          { systemId: "sys_medium", attackId: "atk_a" },
        ],
        directorChannels: directors("dir_a"),
      }),
    );
    expect(result.assignments[0]!.attackId).toBe("atk_a");
    expect(result.assignments[1]!.directorId).toBeNull();
  });

  it("compareThreatPriority is antisymmetric and orders each documented key independently", () => {
    const defenderId = "ship_001";
    const released = atk("atk_released", { isReleased: true });
    const unreleased = atk("atk_unreleased", { isReleased: false });
    expect(compareThreatPriority(released, unreleased, defenderId)).toBeLessThan(0);
    expect(compareThreatPriority(unreleased, released, defenderId)).toBeGreaterThan(0);

    const near = atk("atk_near", { timeToImpactMs: SafeInt(5_000) });
    const far = atk("atk_far", { timeToImpactMs: SafeInt(50_000) });
    expect(compareThreatPriority(near, far, defenderId)).toBeLessThan(0);
    expect(compareThreatPriority(far, near, defenderId)).toBeGreaterThan(0);

    const own = atk("atk_own", { targetId: "ship_001" });
    const protectedShip = atk("atk_prot", { targetId: "ship_002" });
    expect(compareThreatPriority(own, protectedShip, defenderId)).toBeLessThan(0);
    expect(compareThreatPriority(protectedShip, own, defenderId)).toBeGreaterThan(0);

    const big = atk("atk_big", { formationSize: SafeInt(9) });
    const small = atk("atk_small", { formationSize: SafeInt(1) });
    expect(compareThreatPriority(big, small, defenderId)).toBeLessThan(0);
    expect(compareThreatPriority(small, big, defenderId)).toBeGreaterThan(0);

    const lowTarget = atk("atk_low", { targetId: "ship_002" });
    const highTarget = atk("atk_high", { targetId: "ship_003" });
    expect(compareThreatPriority(lowTarget, highTarget, defenderId)).toBeLessThan(0);
    expect(compareThreatPriority(highTarget, lowTarget, defenderId)).toBeGreaterThan(0);

    const twinA = atk("atk_a");
    const twinB = atk("atk_b");
    expect(compareThreatPriority(twinA, twinB, defenderId)).toBe(0);
  });
});

describe("AC-8: §11 one channel per director (line 196 / line 206)", () => {
  it("allocates each operational director to at most one engagement; excess candidates are unassigned", () => {
    const system = aaSystem(Layer.CIWS_TERMINAL_DEFENSE, { systemId: "sys_ciws" });
    const attacks = ["atk_001", "atk_002", "atk_003", "atk_004"].map((id) => atk(id));
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks,
        candidates: ["atk_001", "atk_002", "atk_003", "atk_004"].map((attackId) => ({
          systemId: "sys_ciws",
          attackId,
        })),
        directorChannels: [
          { directorId: "dir_b", operational: true },
          { directorId: "dir_a", operational: true },
        ],
      }),
    );
    expect(result.assignments.map((entry) => entry.attackId)).toEqual([
      "atk_001",
      "atk_002",
      "atk_003",
      "atk_004",
    ]);
    expect(result.assignments.map((entry) => entry.directorId)).toEqual([
      "dir_a",
      "dir_b",
      null,
      null,
    ]);
    const assigned = result.assignments
      .map((entry) => entry.directorId)
      .filter((id): id is string => id !== null);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(result.assignments[2]!.reason).toBe(AIR_DEFENSE_DIRECTOR_UNAVAILABLE);
    expect(result.assignments[3]!.reason).toBe(AIR_DEFENSE_DIRECTOR_UNAVAILABLE);
  });

  it("counts only OPERATIONAL directors for availability and the §12 factor", () => {
    const system = aaSystem(Layer.MEDIUM_AA, { systemId: "sys_medium" });
    const attacks = ["atk_001", "atk_002", "atk_003"].map((id) => atk(id));
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks,
        candidates: attacks.map((a) => ({ systemId: "sys_medium", attackId: a.attackId })),
        directorChannels: [
          { directorId: "dir_a", operational: true },
          { directorId: "dir_b", operational: true },
          { directorId: "dir_c", operational: false },
        ],
      }),
    );
    expect(result.operationalDirectorCount).toBe(2);
    expect(result.directorFactorBp).toBe(18_000);
    expect(result.markers).toEqual([]);
    const assigned = result.assignments.map((entry) => entry.directorId);
    expect(assigned.filter((id) => id !== null)).toEqual(["dir_a", "dir_b"]);
    expect(assigned[2]).toBeNull();
  });

  it("an inoperable ship/system receives no director assignment (§7/§15: contributes zero)", () => {
    const system = aaSystem(Layer.HEAVY_AA, { systemId: "sys_heavy" });
    const attacks = ["atk_001", "atk_002"].map((id) => atk(id));
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks,
        candidates: attacks.map((a) => ({ systemId: "sys_heavy", attackId: a.attackId })),
        directorChannels: directors("dir_a", "dir_b", "dir_c"),
        operability: {
          defenderSunk: false,
          defenderAbandoned: false,
          systemPowered: false,
          systemOperational: false,
        },
      }),
    );
    expect(result.assignments.every((entry) => entry.directorId === null)).toBe(true);
    expect(
      result.assignments.every((entry) => entry.reason === AIR_DEFENSE_DIRECTOR_UNAVAILABLE),
    ).toBe(true);
    expect(result.operationalDirectorCount).toBe(3);
    expect(result.directorFactorBp).toBe(25_000);
  });

  it("returns the cap marker alongside the factor when 5+ operational directors exist", () => {
    const system = aaSystem(Layer.LIGHT_AA, { systemId: "sys_light" });
    const result = assignAADirectors(
      makeInput({
        systems: [system],
        attacks: [atk("atk_001")],
        candidates: [{ systemId: "sys_light", attackId: "atk_001" }],
        directorChannels: directors("dir_a", "dir_b", "dir_c", "dir_d", "dir_e"),
      }),
    );
    expect(result.operationalDirectorCount).toBe(5);
    expect(result.directorFactorBp).toBe(31_000);
    expect(result.markers).toEqual([AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED]);
  });
});

describe("AC-8: fail-closed guards (INVALID_AIR_DEFENSE_STATE)", () => {
  const system = aaSystem(Layer.HEAVY_AA, { systemId: "sys_heavy" });
  const attack = atk("atk_001");

  function expectInvalidState(input: DirectorAssignmentInput) {
    let caught: unknown;
    try {
      assignAADirectors(input);
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);
  }

  it("rejects a candidate referencing an unknown system", () => {
    expectInvalidState(
      makeInput({
        systems: [system],
        attacks: [attack],
        candidates: [{ systemId: "sys_ghost", attackId: "atk_001" }],
        directorChannels: directors("dir_a"),
      }),
    );
  });

  it("rejects a candidate referencing an unknown attack", () => {
    expectInvalidState(
      makeInput({
        systems: [system],
        attacks: [attack],
        candidates: [{ systemId: "sys_heavy", attackId: "atk_ghost" }],
        directorChannels: directors("dir_a"),
      }),
    );
  });

  it("rejects a candidate whose system has an unknown defense layer", () => {
    const broken = { ...system, layer: "HELLCAT_LAYER" as LayerId };
    expectInvalidState(
      makeInput({
        systems: [broken],
        attacks: [attack],
        candidates: [{ systemId: "sys_heavy", attackId: "atk_001" }],
        directorChannels: directors("dir_a"),
      }),
    );
  });

  it("rejects duplicate (system, attack) candidates (one engagement = one channel, §1 line 22)", () => {
    expectInvalidState(
      makeInput({
        systems: [system],
        attacks: [attack],
        candidates: [
          { systemId: "sys_heavy", attackId: "atk_001" },
          { systemId: "sys_heavy", attackId: "atk_001" },
        ],
        directorChannels: directors("dir_a", "dir_b"),
      }),
    );
  });

  it("rejects duplicate director identifiers (corrupts §11 key 5 ordering)", () => {
    expectInvalidState(
      makeInput({
        systems: [system],
        attacks: [attack],
        candidates: [{ systemId: "sys_heavy", attackId: "atk_001" }],
        directorChannels: [
          { directorId: "dir_a", operational: true },
          { directorId: "dir_a", operational: false },
        ],
      }),
    );
  });

  it("rejects an empty defenderId", () => {
    expectInvalidState(
      makeInput({
        defenderId: "",
        systems: [system],
        attacks: [attack],
        candidates: [{ systemId: "sys_heavy", attackId: "atk_001" }],
        directorChannels: directors("dir_a"),
      }),
    );
  });

  it("rejects duplicate system and attack identifiers in the input lists", () => {
    expectInvalidState(
      makeInput({
        systems: [system, system],
        attacks: [attack],
        candidates: [],
        directorChannels: [],
      }),
    );
    expectInvalidState(
      makeInput({
        systems: [system],
        attacks: [attack, attack],
        candidates: [],
        directorChannels: [],
      }),
    );
  });
});

describe("AC-8: determinism (pure, no ambient state)", () => {
  const heavy = aaSystem(Layer.HEAVY_AA, { systemId: "sys_heavy" });
  const medium = aaSystem(Layer.MEDIUM_AA, { systemId: "sys_medium" });
  const ciws = aaSystem(Layer.CIWS_TERMINAL_DEFENSE, { systemId: "sys_ciws" });
  const attacks = [
    atk("atk_a", { timeToImpactMs: SafeInt(20_000) }),
    atk("atk_b", { timeToImpactMs: SafeInt(20_000), isReleased: true }),
    atk("atk_c", { targetId: "ship_002", formationSize: SafeInt(6) }),
    atk("atk_d", { timeToImpactMs: SafeInt(45_000) }),
  ];

  it("identical inputs produce identical assignments, count, factor, and markers", () => {
    const input = makeInput({
      systems: [heavy, medium, ciws],
      attacks,
      candidates: [
        { systemId: "sys_heavy", attackId: "atk_a" },
        { systemId: "sys_medium", attackId: "atk_b" },
        { systemId: "sys_ciws", attackId: "atk_c" },
        { systemId: "sys_medium", attackId: "atk_d" },
        { systemId: "sys_heavy", attackId: "atk_d" },
      ],
      directorChannels: [
        { directorId: "dir_b", operational: true },
        { directorId: "dir_a", operational: true },
        { directorId: "dir_c", operational: false },
      ],
    });
    const first = assignAADirectors(input);
    const second = assignAADirectors(input);
    expect(second).toEqual(first);
  });

  it("input array order cannot leak into the result (§27 line 453)", () => {
    const base = makeInput({
      systems: [heavy, medium, ciws],
      attacks,
      candidates: [
        { systemId: "sys_heavy", attackId: "atk_a" },
        { systemId: "sys_medium", attackId: "atk_b" },
        { systemId: "sys_ciws", attackId: "atk_c" },
        { systemId: "sys_medium", attackId: "atk_d" },
        { systemId: "sys_heavy", attackId: "atk_d" },
      ],
      directorChannels: [
        { directorId: "dir_b", operational: true },
        { directorId: "dir_a", operational: true },
        { directorId: "dir_c", operational: false },
      ],
    });
    const shuffled = {
      ...base,
      systems: [ciws, heavy, medium],
      attacks: [attacks[3]!, attacks[1]!, attacks[0]!, attacks[2]!],
      candidates: [
        { systemId: "sys_heavy", attackId: "atk_d" },
        { systemId: "sys_ciws", attackId: "atk_c" },
        { systemId: "sys_medium", attackId: "atk_b" },
        { systemId: "sys_medium", attackId: "atk_d" },
        { systemId: "sys_heavy", attackId: "atk_a" },
      ],
      directorChannels: [
        { directorId: "dir_a", operational: true },
        { directorId: "dir_c", operational: false },
        { directorId: "dir_b", operational: true },
      ],
    };
    expect(assignAADirectors(shuffled)).toEqual(assignAADirectors(base));
  });
});
