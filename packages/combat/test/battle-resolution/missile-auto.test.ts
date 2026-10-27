import { describe, expect, it } from "vite-plus/test";
import type { CompiledDesignVersion } from "@bluewave/campaign";

import { resolveBattleAuto } from "@bluewave/combat/battleResolution";
import type { MissileRules } from "@bluewave/combat/missiles";

import { DESIGN_ATT_A, makeAutoInput, makeNations, type FixtureNationSet } from "./fixtures.js";

const RULES: MissileRules = {
  classes: {
    light_ssm: {
      rangeM: 30_000,
      flightTimeSeconds: 60,
      salvoSize: 2,
      baseHitBp: 10_000,
      structuralDamage: 1_800,
      flotationDamage: 900,
      defenceInterceptBp: 0,
      maxSalvosPerBattle: 4,
    },
    medium_ssm: {
      rangeM: 55_000,
      flightTimeSeconds: 60,
      salvoSize: 2,
      baseHitBp: 10_000,
      structuralDamage: 2_600,
      flotationDamage: 1_400,
      defenceInterceptBp: 0,
      maxSalvosPerBattle: 4,
    },
    heavy_ssm: {
      rangeM: 90_000,
      flightTimeSeconds: 60,
      salvoSize: 2,
      baseHitBp: 10_000,
      structuralDamage: 3_800,
      flotationDamage: 2_200,
      defenceInterceptBp: 0,
      maxSalvosPerBattle: 3,
    },
  },
};

function armAttackerWithHeavySsm(nations: FixtureNationSet): FixtureNationSet {
  const arm = (designs: Map<string, CompiledDesignVersion>) =>
    new Map(
      [...designs].map(([id, design]) => [
        id,
        id === DESIGN_ATT_A
          ? {
              ...design,
              capabilities: [{ kind: "missile_launch", missileClass: "heavy_ssm" } as const],
            }
          : design,
      ]),
    );
  return {
    ...nations,
    attacker: { ...nations.attacker, designs: arm(nations.attacker.designs) },
  };
}

describe("campaign-shaped SSM auto-resolution (#293)", () => {
  it("observes a launch and hit in a campaign battle when the design carries a launcher", () => {
    const nations = armAttackerWithHeavySsm(makeNations());
    const result = resolveBattleAuto({ ...makeAutoInput({ nations }), missilesRules: RULES });

    expect(result.missileActivity).toBeDefined();
    expect(result.missileActivity!.launches).toBeGreaterThan(0);
    expect(result.missileActivity!.hits).toBeGreaterThan(0);
    expect(result.elapsedMinutes).toBeGreaterThan(0);
    expect(result.resultHash).toMatch(/^[0-9a-f]{64}$/);

    const withoutRules = resolveBattleAuto(makeAutoInput({ nations }));
    expect(result.damageReport).not.toEqual(withoutRules.damageReport);
  });

  it("same seed and same launcher design produce byte-identical results", () => {
    const makeInput = () => {
      const nations = armAttackerWithHeavySsm(makeNations());
      return { ...makeAutoInput({ nations }), missilesRules: RULES };
    };
    const a = resolveBattleAuto(makeInput());
    const b = resolveBattleAuto(makeInput());
    expect(a.resultHash).toBe(b.resultHash);
    expect(a.minuteHashes).toEqual(b.minuteHashes);
    expect(a.missileActivity).toEqual(b.missileActivity);
  });

  it("a caller without the rules, or a design without a launcher, keeps today's result", () => {
    const baseline = resolveBattleAuto(makeAutoInput());
    const withRules = resolveBattleAuto({ ...makeAutoInput(), missilesRules: RULES });

    expect(withRules.resultHash).toBe(baseline.resultHash);
    expect(withRules.minuteHashes).toEqual(baseline.minuteHashes);
    expect(withRules.missileActivity).toBeUndefined();
  });
});
