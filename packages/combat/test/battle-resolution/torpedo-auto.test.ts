import { describe, it, expect } from "vite-plus/test";
import { compiledTorpedoOf } from "../fixtures/compiledTorpedoes.js";
import { SafeInt } from "@bluewave/contracts";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import { resolveBattleAuto } from "@bluewave/combat/battleResolution";
import { projectBattle } from "@bluewave/combat/battleResolution";
import { makeAutoInput, makeNations, type FixtureNationSet } from "./fixtures.js";

const WHITEHEAD = "whitehead_14in_1886";

function armAll(nations: FixtureNationSet): FixtureNationSet {
  const arm = (designs: Map<string, CompiledDesignVersion>) =>
    new Map(
      [...designs].map(([id, d]) => [
        id,
        {
          ...d,
          torpedoArmament: [
            {
              mountType: "UNDERWATER_FIXED",
              tubeCount: SafeInt(2),
              torpedoModelId: WHITEHEAD,
              compiledTorpedo: compiledTorpedoOf(WHITEHEAD),
            },
            {
              mountType: "ABOVE_WATER_TRAINABLE",
              tubeCount: SafeInt(2),
              torpedoModelId: WHITEHEAD,
              compiledTorpedo: compiledTorpedoOf(WHITEHEAD),
            },
          ],
        },
      ]),
    );
  return {
    ...nations,
    attacker: { ...nations.attacker, designs: arm(nations.attacker.designs) },
    defender: { ...nations.defender, designs: arm(nations.defender.designs) },
  };
}

describe("P-1 AC-4 projection", () => {
  it("projects one launcher per mount and a target per unit; none when unarmed", () => {
    const base = makeAutoInput();
    const unarmed = projectBattle({ ...base, rulesetVersion: base.rulesetVersion });
    expect(unarmed.torpedoes).toBeUndefined();

    const armed = makeAutoInput({ nations: armAll(makeNations()) });
    const p = projectBattle({ ...armed, rulesetVersion: armed.rulesetVersion });
    expect(p.torpedoes!.launchers.map((l) => l.launcher.launcherId)).toEqual([
      "a1:TT1",
      "a1:TT2",
      "a2:TT1",
      "a2:TT2",
      "d1:TT1",
      "d1:TT2",
      "d2:TT1",
      "d2:TT2",
    ]);
    expect(p.torpedoes!.launchers[0]!.launcher.launcherFamilyId).toBe("14in_underwater_fixed");
    expect(Object.keys(p.torpedoes!.targets).sort()).toEqual(["a1", "a2", "d1", "d2"]);
  });

  it("fails closed on a model/mount incompatibility", () => {
    const nations = makeNations();
    const bad = new Map(
      [...nations.attacker.designs].map(([id, d]) => [
        id,
        {
          ...d,
          torpedoArmament: [
            {
              mountType: "SUBMARINE_INTERNAL",
              tubeCount: SafeInt(1),
              torpedoModelId: WHITEHEAD,
              compiledTorpedo: compiledTorpedoOf(WHITEHEAD),
            },
          ],
        },
      ]),
    );
    const input = makeAutoInput({
      nations: { ...nations, attacker: { ...nations.attacker, designs: bad } },
    });
    expect(() => projectBattle({ ...input, rulesetVersion: input.rulesetVersion })).toThrow();
  });
});

describe("P-1 AC-5/AC-6 auto-resolution with torpedoes", () => {
  it("unarmed battles carry no torpedoSummary and are unchanged", () => {
    const r = resolveBattleAuto(makeAutoInput());
    expect(r.torpedoSummary).toBeUndefined();
    expect(resolveBattleAuto(makeAutoInput()).resultHash).toBe(r.resultHash);
  });

  it("1880-like ironclads fire and hit torpedoes in close actions, changing outcomes", () => {
    const ironclads = (armed: boolean): FixtureNationSet => {
      const n = makeNations({ attackerGuns: [4, 4], defenderGuns: [4, 4] });
      const era = (m: Map<string, CompiledDesignVersion>) =>
        new Map(
          [...m].map(([id, d]) => [
            id,
            {
              ...d,
              normalizedSpeedUms: SafeInt(14 * 514_444),
              normalizedDisplacementKg: SafeInt(11_000_000),
            },
          ]),
        );
      const base: FixtureNationSet = {
        ...n,
        attacker: { ...n.attacker, designs: era(n.attacker.designs) },
        defender: { ...n.defender, designs: era(n.defender.designs) },
      };
      return armed ? armAll(base) : base;
    };
    let fired = 0;
    let hits = 0;
    let changed = 0;
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const plain = resolveBattleAuto({
        ...makeAutoInput({ nations: ironclads(false) }),
        campaignSeed: seed,
      });
      const armed = resolveBattleAuto({
        ...makeAutoInput({ nations: ironclads(true) }),
        campaignSeed: seed,
      });
      fired += armed.torpedoSummary!.tubesFired;
      hits += armed.torpedoSummary!.hits;
      if (armed.resultHash !== plain.resultHash) changed++;
    }
    expect(fired).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
    expect(changed).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const a = resolveBattleAuto(makeAutoInput({ nations: armAll(makeNations()) }));
    const b = resolveBattleAuto(makeAutoInput({ nations: armAll(makeNations()) }));
    expect(b.resultHash).toBe(a.resultHash);
    expect(b.minuteHashes).toEqual(a.minuteHashes);
  });
});
