import { describe, expect, it } from "vite-plus/test";

import {
  SHIPPED_MISSILE_CONTRACT,
  validateMissileContract,
  type MissileRules,
} from "@bluewave/combat/missiles";
import {
  countLauncherCapabilities,
  projectMissileContext,
  projectMissileLaunchers,
} from "@bluewave/combat/missiles";

const classRules = {
  rangeM: 30_000,
  flightTimeSeconds: 90,
  salvoSize: 2,
  baseHitBp: 3_500,
  structuralDamage: 1_800,
  flotationDamage: 900,
  defenceInterceptBp: 2_500,
  maxSalvosPerBattle: 4,
};

export const TEST_MISSILE_RULES: MissileRules = {
  classes: {
    light_ssm: classRules,
    medium_ssm: classRules,
    heavy_ssm: classRules,
  },
};

describe("missile contract and launcher projection (#293)", () => {
  it("accepts the shipped contract and rejects tampering", () => {
    expect(() => validateMissileContract(SHIPPED_MISSILE_CONTRACT)).not.toThrow();
    expect(() =>
      validateMissileContract({ ...SHIPPED_MISSILE_CONTRACT, policyId: "other" }),
    ).toThrow();
  });

  it("counts only SSM launch capabilities", () => {
    const counts = countLauncherCapabilities([
      { kind: "missile_launch", missileClass: "heavy_ssm" },
      { kind: "missile_launch", missileClass: "heavy_ssm" },
      { kind: "missile_launch", missileClass: "sam" },
      { kind: "missile_launch", missileClass: "asm" },
      { kind: "damage_control", effectBp: 1_000 },
    ]);
    expect(counts).toEqual({ light_ssm: 0, medium_ssm: 0, heavy_ssm: 2 });
  });

  it("projects one launcher per carried SSM class and multiplies the salvo budget", () => {
    const launchers = projectMissileLaunchers(
      [
        {
          shipId: "a1",
          sideId: "ATTACKER",
          capabilities: [
            { kind: "missile_launch", missileClass: "heavy_ssm" },
            { kind: "missile_launch", missileClass: "heavy_ssm" },
          ],
        },
        {
          shipId: "d1",
          sideId: "DEFENDER",
          capabilities: [{ kind: "missile_launch", missileClass: "light_ssm" }],
        },
      ],
      TEST_MISSILE_RULES,
    );
    expect(launchers.map((launcher) => launcher.launcherId)).toEqual([
      "a1:SSM:heavy_ssm",
      "d1:SSM:light_ssm",
    ]);
    expect(launchers[0]!.maxSalvos).toBe(8);
    expect(launchers[1]!.maxSalvos).toBe(4);
  });

  it("projects nothing for a ship without a launcher capability", () => {
    expect(
      projectMissileContext(
        [
          { shipId: "a1", sideId: "ATTACKER", capabilities: [] },
          { shipId: "d1", sideId: "DEFENDER" },
        ],
        TEST_MISSILE_RULES,
      ),
    ).toBeUndefined();
  });
});
