// P-1 ticket 06 — gunnery fidelity sweep: the engine NOW fires at the TRUE
// legal contact range each minute (range factor from `gunnery_range_v1`) and
// every salvo's hit draw uses the binomial-equivalent batch probability of its
// `salvoCount` rounds (`gunnery_salvo_batch_v1`), so CLOSER RANGE ⇒ more hits
// and MORE GUNS ⇒ more hits, deterministically.
//
// Deterministic proof, no statistical thresholds: 12 fixed campaign seeds x 120
// minutes each per arm; every battery fires every minute (reload 2_000 ms < one
// minute, FC solution 8_000 bp >= the 2_000 bp minimum, ammo 10_000 rounds per
// type). Expected per-arm hits at 5 km: ~126 (N=1) vs ~748 (N=8); at 15 km:
// ~39 (N=1) vs ~284 (N=8) — a 3x separation that a seeded run cannot invert.
import { describe, it, expect } from "vite-plus/test";
import { RandomEngine } from "@bluewave/random";
import {
  resolveGunnery,
  neutralAccuracyFactors,
  neutralRateFactors,
  withGunneryStateHash,
  salvoBatchAccuracyBp,
  perRoundHitProbabilityBp,
  rangeMultiplierBp,
  type GunneryBattery,
} from "../../src/gunnery/index.js";
import type { TacticalContact } from "../../src/contact/lifecycle.js";

const BATTLE_ID = "battle-fidelity";
const SEEDS = Array.from({ length: 12 }, (_, i) => `fidelity-seed-${i}`);
const MINUTES = 120;
const FIVE_KM = 5_000_000_000;
const FIFTEEN_KM = 15_000_000_000;

function contactAt(rangeUm: number): TacticalContact {
  return {
    contactId: `${BATTLE_ID}:d1`,
    battleId: BATTLE_ID,
    assetId: "d1",
    sideId: "DEFENDER",
    estimatedIdentity: "Battleship",
    position: [rangeUm, 0],
    course: 180,
    speed: 10_000,
    confidence: 10_000,
    observationTime: "1900-01-01T00:00:00.000Z",
    source: "visual",
    uncertainty: 0,
    lastUpdateMinute: 1,
    stale: false,
    sources: ["visual"],
  };
}

/** One battery fires `salvoCount` rounds at `rangeUm` every minute for MINUTES
 *  minutes, threading its own post-minute state (the auto-resolution loop's
 *  per-minute threading). Returns hit count + the first salvo record. */
function runArm(seed: string, salvoCount: number, rangeUm: number) {
  const engine = new RandomEngine(seed);
  let battery: GunneryBattery = {
    id: "BAT-1",
    ownerShipId: "shooter",
    sideId: "ATTACKER",
    mountOrdinal: 1,
    commandSource: "CENTRAL",
    baseReloadMs: 2_000,
    salvoCount,
    preferredType: "ARMOR_PIERCING",
    rateFactors: neutralRateFactors(),
    // The auto-resolver's authored per-minute base (GUNNERY_ACCURACY_BASE_BP).
    accuracyFactors: neutralAccuracyFactors(4_000),
    state: withGunneryStateHash({
      batteryId: "BAT-1",
      ownerShipId: "shooter",
      gunDefinitionId: "GUN-305-45",
      mountDefinitionId: "MNT-305-TWIN",
      targetContactId: `${BATTLE_ID}:d1`,
      acquisitionProgressBp: 8_000,
      rangeEstimateUm: 10_000_000_000,
      rangeUncertaintyUm: 150_000_000,
      fireControlSolutionQualityBp: 8_000,
      ammunition: { ARMOR_PIERCING: 10_000, COMMON: 10_000, HIGH_EXPLOSIVE: 10_000 },
      fireMode: "NORMAL",
      reloadProgressMs: 2_000,
      straddleState: null,
      damageState: null,
      aaEligibilityState: null,
      lastSalvoMinute: -1,
      lastSalvoSubstep: 0,
      rulesetVersion: "gunnery_ruleset_v1",
      formulaVersion: "gunnery_formula_v1",
    }),
  };
  const shipPositions: Record<string, [number, number]> = { shooter: [0, 0] };
  const contacts = [contactAt(rangeUm)];

  let hits = 0;
  let firstRecord: ReturnType<typeof resolveGunnery>["salvos"][number] | undefined;
  for (let minute = 1; minute <= MINUTES; minute++) {
    const out = resolveGunnery({
      battleId: BATTLE_ID,
      minute,
      batteries: [battery],
      contacts,
      engine,
      shipPositions,
    });
    expect(out.salvos).toHaveLength(1);
    const rec = out.salvos[0]!;
    if (rec.outcome === "HIT") hits++;
    if (!firstRecord) firstRecord = rec;
    // next minute fires from the post-minute state (true range written back).
    battery = { ...battery, state: out.nextStates["BAT-1"]! };
  }
  return { hits, firstRecord: firstRecord! };
}

describe("P-1 ticket 06 — range + gun-count sensitivity (deterministic sweep)", () => {
  it("closer range yields more hits at the same gun count", () => {
    let close = 0;
    let far = 0;
    for (const seed of SEEDS) {
      const a = runArm(seed, 4, FIVE_KM);
      const b = runArm(seed, 4, FIFTEEN_KM);
      close += a.hits;
      far += b.hits;
    }
    expect(close).toBeGreaterThan(far * 2); // ~3x separation (3066 vs 1040 bp)
  });

  it("more guns yield more hits at the same range", () => {
    let few = 0;
    let many = 0;
    for (const seed of SEEDS) {
      const a = runArm(seed, 1, FIVE_KM);
      const b = runArm(seed, 8, FIVE_KM);
      few += a.hits;
      many += b.hits;
    }
    expect(many).toBeGreaterThan(few * 5); // ~6x separation (5193 vs 875 bp)
  });

  it("the salvo record carries the true-range per-round accuracy and the batch draw", () => {
    const { firstRecord } = runArm(SEEDS[0]!, 4, FIVE_KM);
    // §3 per-round resolution at 5 km through the neutral 4_000 base: 875 bp.
    expect(firstRecord.accuracy.finalAccuracyBp).toBe(perRoundHitProbabilityBp(FIVE_KM));
    expect(firstRecord.accuracy.factors.range).toBe(rangeMultiplierBp(FIVE_KM));
    // The single keyed draw is the SALVO batch probability, not the per-round one.
    expect(firstRecord.randomDecisions[0]!.finalAccuracyBp).toBe(
      salvoBatchAccuracyBp(perRoundHitProbabilityBp(FIVE_KM), 4),
    );
    // ...and the far-range per-round resolution is strictly lower.
    const farRec = runArm(SEEDS[0]!, 4, FIFTEEN_KM).firstRecord;
    expect(farRec.accuracy.finalAccuracyBp).toBeLessThan(firstRecord.accuracy.finalAccuracyBp);
    expect(farRec.accuracy.finalAccuracyBp).toBe(perRoundHitProbabilityBp(FIFTEEN_KM));
  });
});
