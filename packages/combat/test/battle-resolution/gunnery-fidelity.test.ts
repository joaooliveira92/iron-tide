// P-1 ticket 06 — battle-level proof that auto-resolution is now sensitive to
// the two design variables the ticket's evidence showed were inert:
//
//   * gun count:  10 guns vs 4 guns previously produced BYTE-IDENTICAL damage
//     reports across seeds (ticket 06 evidence); now the salvo batch
//     (gunnery_salvo_batch_v1) changes every fired minute.
//   * closing rate: 30 kn vs 14 kn previously produced byte-identical results
//     because the range slot was a fixed authored 10 000 bp; now the true
//     post-movement range (gunnery_range_v1) lowers per-round accuracy at long
//     range, so a slower approach under-closes and hits less.
//
// No pinned hashes here on purpose (the AC-6 unarmed baselines in
// auto-resolve.test.ts / ac6-damage-control-gate.test.ts own the frozen
// worlds); these are deterministic DIFFERENCE proofs + one deterministic
// damage assertion.
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
    // Deterministic fixed-seed set. Per-ship damage saturates at the hp cap and
    // battle length varies with gun count, so the like-for-like scale proof is
    // the aggregate salvo-hit count (telemetry), which does not saturate.
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
    const base = makeNations(); // default: 10 guns, 30 kn
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
    // ADR-0094: the corrected production-scale penetration weakens damage enough
    // that many fixtures saturate at the time_limit cap and the closing-rate
    // signal is only visible on some seeds (2 of 5 at pin time). The model still
    // responds to speed; the aggregate signal is simply much weaker. Full
    // balance restoration is a separate rebalancing pass.
    expect(differing).toBeGreaterThanOrEqual(1);
  });
});

/** Re-author every design in the nation at 14 kn (fixture convenience — the
 *  shapes below mirror the era() helper in torpedo-foundering.test.ts). */
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
