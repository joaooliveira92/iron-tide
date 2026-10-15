// P-1 ticket 07 — a Whitehead hit, once damage control runs PER SHIP every
// minute, FOUNDERS an 1880-like ironclad over time: the §18 progressive
// flooding source drains flotation reserve to 0 -> terminal SINKING -> HP 0.
//
// Isolation: the fixture carries NO main battery (mainGunsCount 0 -> no gunnery
// batteries are projected; project.ts rejects zero-gun batteries) and the plain
// control run (unarmed) resolves to time_limit with ZERO sunk ships. Any ship
// sunk in the armed run is therefore torpedo-flooding-driven — no other damage
// source exists in the battle.
import { describe, it, expect } from "vite-plus/test";
import { compiledTorpedoOf } from "../fixtures/compiledTorpedoes.js";
import { SafeInt } from "@bluewave/contracts";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import { resolveBattleAuto } from "../../src/battleResolution/resolve.js";
import { makeAutoInput, makeNations, type FixtureNationSet } from "./fixtures.js";

const WHITEHEAD = "whitehead_14in_1886";
const SEEDS = ["s1", "s2", "s3", "s4", "s5", "s6"];

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

// 14 kn, 11 000 t, NO main battery, torpedo armament only.
function ironclads(armed: boolean): FixtureNationSet {
  const n = makeNations({ attackerGuns: [0, 0], defenderGuns: [0, 0] });
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
}

describe("P-1 ticket 07: torpedo flooding founders ironclads over time", () => {
  it("Whitehead hits founder the ironclads; the unarmed control founders nothing", () => {
    let founderingHashes: { minuteHashes: string[]; resultHash: string } | undefined;
    for (const seed of SEEDS) {
      const plain = resolveBattleAuto({
        ...makeAutoInput({ nations: ironclads(false) }),
        campaignSeed: seed,
      });
      const armed = resolveBattleAuto({
        ...makeAutoInput({ nations: ironclads(true) }),
        campaignSeed: seed,
      });

      expect(plain.attackerSunkIds.length + plain.defenderSunkIds.length).toBe(0);
      expect(plain.battleEndReason).toBe("time_limit");

      // Every armed seed fires torpedoes, lands hits, and founders at least
      // three ships before the 360-minute cap.
      expect(armed.torpedoSummary!.tubesFired).toBeGreaterThan(0);
      expect(armed.torpedoSummary!.hits).toBeGreaterThanOrEqual(3);
      const sunk = [...armed.attackerSunkIds, ...armed.defenderSunkIds];
      expect(sunk.length).toBeGreaterThanOrEqual(3);
      expect(armed.battleEndReason).toBe("no_viable_combatants");
      expect(armed.elapsedMinutes).toBeLessThan(360);
      // A sunk ship has lost all HP (terminal transition -> hp 0).
      for (const id of sunk) expect(armed.damageReport[id]!.valueOf()).toBe(100);

      if (!founderingHashes) {
        founderingHashes = { minuteHashes: armed.minuteHashes, resultHash: armed.resultHash };
        // Byte-replay determinism on the first foundering battle.
        const rerun = resolveBattleAuto({
          ...makeAutoInput({ nations: ironclads(true) }),
          campaignSeed: seed,
        });
        expect(rerun.resultHash).toBe(founderingHashes.resultHash);
        expect(rerun.minuteHashes).toEqual(founderingHashes.minuteHashes);
        expect(rerun.battleEndReason).toBe("no_viable_combatants");
      }
    }
    expect(founderingHashes).toBeDefined();
  });
});
