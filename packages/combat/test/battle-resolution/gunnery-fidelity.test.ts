import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import { resolveBattleAuto } from "../../src/battleResolution/resolve.js";
import { makeAutoInput, makeNations, type FixtureNationSet } from "./fixtures.js";

const SEEDS = ["fid-a", "fid-b", "fid-c", "fid-d", "fid-e"];

describe("P-1 ticket 06 — auto-resolution responds to gun count and speed", () => {
  it("10-gun vs 4-gun battles now differ (same seed, same everything else)", () => {
    const heavy = makeAutoInput({
      nations: makeNations({ attackerGuns: [10, 10], defenderGuns: [10, 10] }),
    });
    const light = makeAutoInput({
      nations: makeNations({ attackerGuns: [4, 4], defenderGuns: [4, 4] }),
    });
    let differing = 0;
    for (const seed of SEEDS) {
      const a = resolveBattleAuto({ ...heavy, campaignSeed: seed });
      const b = resolveBattleAuto({ ...light, campaignSeed: seed });
      expect(JSON.stringify(a.damageReport)).not.toBe(JSON.stringify(b.damageReport));
      expect(a.resultHash).not.toBe(b.resultHash);
      differing++;
    }
    expect(differing).toBe(SEEDS.length);
  });

  it("the 10-gun side lands more hits than the 4-gun side in the SAME battle shape", () => {
    let heavyHits = 0;
    let lightHits = 0;
    for (const seed of SEEDS) {
      const heavy = resolveBattleAuto({
        ...makeAutoInput({
          nations: makeNations({ attackerGuns: [10, 10], defenderGuns: [10, 10] }),
        }),
        campaignSeed: seed,
      });
      const light = resolveBattleAuto({
        ...makeAutoInput({ nations: makeNations({ attackerGuns: [4, 4], defenderGuns: [4, 4] }) }),
        campaignSeed: seed,
      });
      expect(["withdrawal_complete", "mutual_disengagement", "time_limit"]).toContain(
        heavy.battleEndReason,
      );
      expect(["withdrawal_complete", "mutual_disengagement", "time_limit"]).toContain(
        light.battleEndReason,
      );
      heavyHits += heavy.telemetry?.hits ?? 0;
      lightHits += light.telemetry?.hits ?? 0;
    }
    expect(heavyHits).toBeGreaterThan(lightHits);
  });

  it("30-kn vs 14-kn battles now differ (same seed, same guns)", () => {
    const base = makeNations();
    const slowNations: FixtureNationSet = {
      ...base,
      attacker: { ...base.attacker, designs: slow(base.attacker.designs) },
      defender: { ...base.defender, designs: slow(base.defender.designs) },
      attackerDesigns: slow(base.attackerDesigns),
      defenderDesigns: slow(base.defenderDesigns),
    };
    let differing = 0;
    for (const seed of SEEDS) {
      const a = resolveBattleAuto({ ...makeAutoInput({ nations: base }), campaignSeed: seed });
      const b = resolveBattleAuto({
        ...makeAutoInput({ nations: slowNations }),
        campaignSeed: seed,
      });
      if (JSON.stringify(a.damageReport) !== JSON.stringify(b.damageReport)) differing++;
    }
    expect(differing).toBeGreaterThanOrEqual(1);
  });
});

function slow(designs: Map<string, CompiledDesignVersion>): Map<string, CompiledDesignVersion> {
  return new Map(
    [...designs].map(([id, d]) => [
      id,
      {
        ...d,
        normalizedSpeedUms: SafeInt(14 * 514_444),
      },
    ]),
  );
}
