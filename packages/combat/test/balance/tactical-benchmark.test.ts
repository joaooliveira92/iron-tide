// P-1 tactical balance benchmark (ADR-0098, post-ADR-0094 caliber correction).
//
// A deterministic, fixed-seed scenario matrix over `resolveBattleAuto` that
// records the full engagement metric set (duration, salvos, rounds, hits, hit
// rate, penetration distribution, fires/flooding/magazine events, withdrawals
// with structured reasons, sinkings, end reason, winner, per-ship loss) and
// asserts the ADR-0053/ADR-0098 duration and lethality target bands.
//
// The scenario parameters are the production national gun calibers and belt
// armors (343 mm UK, 305 mm France, 263 mm Germany, 234 mm armoured cruiser,
// 152 mm protected cruiser). The designs are fixture designs (no first-class
// `armament` snapshot) except the MIXED matchup, which proves a legacy and a
// first-class-armed fleet fight in the same battle.
//
// Set BALANCE_BENCH_WRITE=1 to (re)write docs/research/p1-tactical-benchmark.md.
// Statistical assertions are over fixed deterministic seed sets and bounded
// ranges only; no broad snapshots.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomLedger } from "@bluewave/random";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import type { CompiledArmamentMount } from "@bluewave/armament";
import {
  resolveBattleAuto,
  type BattleResolutionResult,
} from "../../src/battleResolution/resolve.js";
import { effectiveResistanceUm, shellPenetrationUm } from "../../src/battleResolution/damage.js";
import {
  autoZonesForBelt,
  SHELL_MUZZLE_VELOCITY_MS,
  ZONE_HIT_WEIGHT_BP,
  type AutoResolutionZoneId,
} from "../../src/battleResolution/constants.js";
import {
  determinePenetrationOutcome,
  type PenetrationOutcome,
} from "../../src/damage/armorModel.js";
import {
  makeAutoInput,
  makeNations,
  type FixtureNationSet,
} from "../battle-resolution/fixtures.js";

const SEEDS = 30;
const UMS_PER_KNOT = 514_444;
const ATTACKER = "n-uk";
const DEFENDER = "n-fr";

type Side = "attacker" | "defender";

// Scenario design parameters (production national guns/armor).

interface HullSpec {
  hullType: string;
  guns: number;
  caliberUm: number;
  armorUm: number;
  speedKnots: number;
  displacementKg: number;
  /** Optional first-class armament snapshot (proves the mixed-identity path). */
  armament?: readonly CompiledArmamentMount[];
}

const UK_BB: HullSpec = {
  hullType: "battleship",
  guns: 10,
  caliberUm: 343_000,
  armorUm: 305_000,
  speedKnots: 18,
  displacementKg: 15_000_000,
};
const FR_BB: HullSpec = {
  hullType: "battleship",
  guns: 10,
  caliberUm: 305_000,
  armorUm: 300_000,
  speedKnots: 18,
  displacementKg: 14_000_000,
};
const DE_BB: HullSpec = {
  hullType: "battleship",
  guns: 8,
  caliberUm: 263_000,
  armorUm: 300_000,
  speedKnots: 18,
  displacementKg: 13_000_000,
};
const UK_AC: HullSpec = {
  hullType: "armoured_cruiser",
  guns: 8,
  caliberUm: 234_000,
  armorUm: 152_000,
  speedKnots: 21,
  displacementKg: 10_000_000,
};
const UK_PC: HullSpec = {
  hullType: "protected_cruiser",
  guns: 8,
  caliberUm: 152_000,
  armorUm: 76_000,
  speedKnots: 24,
  displacementKg: 4_000_000,
};

/** A minimal first-class snapshot for the UK 13.5 in gun (identity only). */
const UK_BB_ARMAMENT: readonly CompiledArmamentMount[] = [
  {
    instanceId: "a1:MAIN:1",
    gunFamilyId: "gf_bl_135in",
    gunModelId: "uk_bl_135in_30_mk1",
    mountId: "gm_bl_135in_turret",
    ammunitionId: "am_uk_cpc",
    mountType: "TURRET",
    gunCount: 10,
    accessStatus: "DOMESTIC",
    caliberUm: 343_000,
    appliedModifiers: [],
  },
];

function mapDesigns(
  n: FixtureNationSet,
  side: Side,
  f: (d: CompiledDesignVersion) => CompiledDesignVersion,
): FixtureNationSet {
  return {
    ...n,
    [side]: {
      ...n[side],
      designs: new Map([...n[side].designs].map(([id, d]) => [id, f(d)])) as Map<
        string,
        CompiledDesignVersion
      >,
    },
  };
}

function applyHull(n: FixtureNationSet, side: Side, h: HullSpec): FixtureNationSet {
  return mapDesigns(n, side, (d) => ({
    ...d,
    hullType: h.hullType,
    mainGunsCount: SafeInt(h.guns),
    mainGunsCaliber: SafeInt(h.caliberUm),
    normalizedArmorUm: SafeInt(h.armorUm),
    normalizedSpeedUms: SafeInt(h.speedKnots * UMS_PER_KNOT),
    normalizedDisplacementKg: SafeInt(h.displacementKg),
    ...(h.armament ? { armament: h.armament } : {}),
  }));
}

interface Scenario {
  name: string;
  category: "capital" | "cruiser" | "asymmetric" | "mixed";
  build: () => FixtureNationSet;
}

function scenario(
  name: string,
  category: Scenario["category"],
  a: HullSpec,
  b: HullSpec,
): Scenario {
  return {
    name,
    category,
    build: () => {
      const base = makeNations({ attackerGuns: [a.guns, a.guns], defenderGuns: [b.guns, b.guns] });
      return applyHull(applyHull(base, "attacker", a), "defender", b);
    },
  };
}

const SCENARIOS: Scenario[] = [
  scenario("UK BB vs France BB", "capital", UK_BB, FR_BB),
  scenario("UK BB vs Germany BB", "capital", UK_BB, DE_BB),
  scenario("France BB vs Germany BB", "capital", FR_BB, DE_BB),
  scenario("capital vs capital (equal)", "capital", UK_BB, UK_BB),
  scenario("armoured cruiser vs armoured cruiser", "cruiser", UK_AC, UK_AC),
  scenario("protected cruiser vs protected cruiser", "cruiser", UK_PC, UK_PC),
  scenario("capital vs armoured cruiser", "asymmetric", UK_BB, UK_AC),
  scenario("capital vs protected cruiser", "asymmetric", UK_BB, UK_PC),
  {
    name: "mixed legacy + first-class fleet",
    category: "mixed",
    build: () => {
      // The attacker carries a first-class `armament` snapshot; the defender is
      // a legacy design with none. Both must fight in the same battle.
      const withSnap = applyHull(makeNations({ attackerGuns: [10, 10] }), "attacker", {
        ...UK_BB,
        armament: UK_BB_ARMAMENT,
      });
      return applyHull(withSnap, "defender", FR_BB);
    },
  },
];

// Analytic penetration-outcome distribution (range-invariant model; a pure
// function of the design caliber and belt, weighted by the hit-zone weights).

function penetrationDistribution(
  caliberUm: number,
  beltUm: number,
): Record<PenetrationOutcome, number> {
  const capability = shellPenetrationUm(caliberUm, SHELL_MUZZLE_VELOCITY_MS);
  const dist = {
    NO_EFFECT: 0,
    SPLINTER_EFFECT: 0,
    PARTIAL_PENETRATION: 0,
    FULL_PENETRATION: 0,
    PASS_THROUGH: 0,
    DUD: 0,
    CRITICAL_PENETRATION: 0,
  } as Record<PenetrationOutcome, number>;
  for (const zone of autoZonesForBelt(beltUm)) {
    const resistance = effectiveResistanceUm(zone);
    const outcome = determinePenetrationOutcome(capability, resistance, 0, zone.critical);
    dist[outcome] += ZONE_HIT_WEIGHT_BP[zone.id as AutoResolutionZoneId];
  }
  return dist;
}

// Battle run + aggregation.

interface BattleSample {
  result: BattleResolutionResult;
  hits: number;
  firesStarted: number;
  floodingSources: number;
  magazineEvents: number;
  fireSpreadChecks: number;
}

function runBattle(nations: FixtureNationSet, seed: string): BattleSample {
  const ledger = new RandomLedger();
  const result = resolveBattleAuto({
    ...makeAutoInput({ nations }),
    campaignSeed: seed,
    randomLedger: ledger,
  });
  const count = (prefix: string) => ledger.all.filter((d) => d.streamId.startsWith(prefix)).length;
  return {
    result,
    hits: count("battle/damage/hit_zone:"),
    firesStarted: count("battle/ship/damage/fire_creation:"),
    floodingSources: count("battle/ship/damage/flooding_creation:"),
    magazineEvents: count("battle/ship/damage/magazine:"),
    fireSpreadChecks: count("battle/ship/damage/fire_spread/"),
  };
}

interface ScenarioReport {
  scenario: Scenario;
  samples: BattleSample[];
  lens: number[];
  median: number;
  mean: number;
  p90: number;
  timeLimitShare: number;
  withdrawalShare: number;
  mutualShare: number;
  noViableShare: number;
  sinkMean: number;
  sinkingBattles: number;
  attackerWin: number;
  defenderWin: number;
  noWinner: number;
  hitRateBp: number;
  salvosMean: number;
  roundsMean: number;
  hitsMean: number;
  firesMean: number;
  floodingMean: number;
  magazineMean: number;
  spreadChecksMean: number;
  causes: Record<string, number>;
  withdrawalReasons: Record<string, number>;
  penetration: Record<PenetrationOutcome, number>;
}

function aggregate(scenario: Scenario): ScenarioReport {
  const samples = Array.from({ length: SEEDS }, (_, s) =>
    runBattle(scenario.build(), `bench-${s}`),
  );
  const n = samples.length;
  const results = samples.map((s) => s.result);
  const lens = results.map((r) => r.elapsedMinutes).sort((a, b) => a - b);
  const sum = (f: (r: BattleResolutionResult) => number) => results.reduce((a, r) => a + f(r), 0);
  const reasons: Record<string, number> = {};
  for (const r of results) reasons[r.battleEndReason] = (reasons[r.battleEndReason] ?? 0) + 1;
  const causes: Record<string, number> = {};
  for (const r of results)
    for (const c of Object.values(r.causeOfLoss ?? {})) causes[c] = (causes[c] ?? 0) + 1;
  const withdrawalReasons: Record<string, number> = {};
  for (const r of results)
    if (r.withdrawalReason)
      withdrawalReasons[r.withdrawalReason] = (withdrawalReasons[r.withdrawalReason] ?? 0) + 1;
  const totalSalvos = samples.reduce((a, s) => a + (s.result.telemetry?.salvosFired ?? 0), 0);
  const totalHits = samples.reduce((a, s) => a + (s.result.telemetry?.hits ?? 0), 0);
  const hull = scenario.build();
  const atkDesign = [...hull.attacker.designs.values()][0]!;
  return {
    scenario,
    samples,
    lens,
    median: lens[Math.floor(n / 2)]!,
    mean: lens.reduce((a, b) => a + b, 0) / n,
    p90: lens[Math.min(n - 1, Math.floor(n * 0.9))]!,
    timeLimitShare: (reasons["time_limit"] ?? 0) / n,
    withdrawalShare: (reasons["withdrawal_complete"] ?? 0) / n,
    mutualShare: (reasons["mutual_disengagement"] ?? 0) / n,
    noViableShare: (reasons["no_viable_combatants"] ?? 0) / n,
    sinkMean: sum((r) => r.attackerSunkIds.length + r.defenderSunkIds.length) / n,
    sinkingBattles: results.filter((r) => r.attackerSunkIds.length + r.defenderSunkIds.length > 0)
      .length,
    attackerWin: results.filter((r) => r.winnerId === ATTACKER).length / n,
    defenderWin: results.filter((r) => r.winnerId === DEFENDER).length / n,
    noWinner: results.filter((r) => r.winnerId === null).length / n,
    hitRateBp: totalSalvos === 0 ? 0 : Math.floor((totalHits * 10_000) / totalSalvos),
    salvosMean: totalSalvos / n,
    roundsMean: samples.reduce((a, s) => a + (s.result.telemetry?.roundsExpended ?? 0), 0) / n,
    hitsMean: totalHits / n,
    firesMean: samples.reduce((a, s) => a + s.firesStarted, 0) / n,
    floodingMean: samples.reduce((a, s) => a + s.floodingSources, 0) / n,
    magazineMean: samples.reduce((a, s) => a + s.magazineEvents, 0) / n,
    spreadChecksMean: samples.reduce((a, s) => a + s.fireSpreadChecks, 0) / n,
    causes,
    withdrawalReasons,
    penetration: penetrationDistribution(
      atkDesign.mainGunsCaliber as number,
      atkDesign.normalizedArmorUm as number,
    ),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function renderMarkdown(reports: ScenarioReport[]): string {
  const lines = [
    "# P-1 tactical balance benchmark (auto-resolution, ADR-0098)",
    "",
    `Generated by \`packages/combat/test/balance/tactical-benchmark.test.ts\` (BALANCE_BENCH_WRITE=1). ${SEEDS} fixed seeds per scenario. Production national calibers/belt armors; \`resolveBattleAuto\`. Post ADR-0094 caliber-unit correction + ADR-0098 lethality rebalance. Non-normative; balance observation only.`,
    "",
    "| Scenario | Category | Duration mean/median/p90 (min) | time_limit | withdrawal | mutual | no_viable | sinkMean (sinking battles) | Attacker win | Hit rate | Salvos/rounds/hits (mean) | Fires/flooding/mag checks (mean) | Withdrawal reasons | Cause of loss |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of reports) {
    lines.push(
      `| ${r.scenario.name} | ${r.scenario.category} | ${r.mean.toFixed(1)} / ${r.median} / ${r.p90} | ${pct(r.timeLimitShare)} | ${pct(r.withdrawalShare)} | ${pct(r.mutualShare)} | ${pct(r.noViableShare)} | ${r.sinkMean.toFixed(2)} (${r.sinkingBattles}/${SEEDS}) | ${pct(r.attackerWin)} | ${(r.hitRateBp / 100).toFixed(0)}% | ${r.salvosMean.toFixed(0)} / ${r.roundsMean.toFixed(0)} / ${r.hitsMean.toFixed(0)} | ${r.firesMean.toFixed(1)} / ${r.floodingMean.toFixed(1)} / ${r.magazineMean.toFixed(1)} | ${JSON.stringify(r.withdrawalReasons)} | ${JSON.stringify(r.causes)} |`,
    );
  }
  lines.push(
    "",
    "Penetration-outcome distribution (attacker main battery vs defender belt, hit-zone-weighted, analytic range-invariant model):",
    "",
    "| Scenario | penetrating | partial | non-penetrating |",
    "| --- | --- | --- | --- |",
  );
  for (const r of reports) {
    const pen =
      (r.penetration.FULL_PENETRATION ?? 0) +
      (r.penetration.CRITICAL_PENETRATION ?? 0) +
      (r.penetration.PASS_THROUGH ?? 0);
    const partial = r.penetration.PARTIAL_PENETRATION ?? 0;
    lines.push(
      `| ${r.scenario.name} | ${pct(pen / 10_000)} | ${pct(partial / 10_000)} | ${pct((10_000 - pen - partial) / 10_000)} |`,
    );
  }
  lines.push(
    "",
    "Withdrawal reasons are the ADR-0098 structured classification of the ADR-0073 fleet-strength threshold (`FLEET_STRENGTH_FLOODING` / `_FIRE` / `_GUNFIRE` / `_STRUCTURAL` / `MUTUAL_DISENGAGEMENT`).",
    "",
  );
  return lines.join("\n");
}

describe("ADR-0098 tactical balance benchmark", () => {
  it("meets the duration and lethality target bands across the scenario matrix", () => {
    const reports = SCENARIOS.map(aggregate);
    const byName = (s: string) => reports.find((r) => r.scenario.name === s)!;

    if (process.env["BALANCE_BENCH_WRITE"] === "1") {
      const here = dirname(fileURLToPath(import.meta.url));
      const out = resolve(here, "../../../../docs/research/p1-tactical-benchmark.md");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, renderMarkdown(reports));
    }

    for (const r of reports) {
      // Every scenario terminates within the cap, never instantaneously.
      expect(r.lens[0]).toBeGreaterThanOrEqual(1);
      expect(r.lens[r.lens.length - 1]).toBeLessThanOrEqual(360);
      // win shares partition the seed set.
      expect(r.attackerWin + r.defenderWin + r.noWinner).toBeCloseTo(1, 9);
      // time-limit endings bounded (ADR-0053/ADR-0098 target: below 10-15%).
      expect(r.timeLimitShare).toBeLessThanOrEqual(0.2);
      // every sinking has exactly one attributed cause.
      const sunk = Object.values(r.causes).reduce((a, v) => a + v, 0);
      expect(sunk).toBeCloseTo(r.sinkMean * SEEDS, 6);
    }

    // Decisive fleet engagements (capital) land in the ADR-0053 30-90 min band,
    // with a bounded 90th percentile.
    for (const r of reports.filter((x) => x.scenario.category === "capital")) {
      expect(r.median).toBeGreaterThanOrEqual(30);
      expect(r.median).toBeLessThanOrEqual(90);
      expect(r.p90).toBeLessThanOrEqual(180);
    }

    // Cruiser and asymmetric engagements also resolve inside the band.
    for (const r of reports.filter((x) => x.scenario.category !== "capital")) {
      expect(r.median).toBeGreaterThanOrEqual(20);
      expect(r.median).toBeLessThanOrEqual(90);
      expect(r.p90).toBeLessThanOrEqual(180);
    }

    // Heavy-gun engagements must be lethal: a repeatable non-zero sinking
    // incidence across the fixed seed set.
    const heavy = reports.filter((r) =>
      [
        "UK BB vs France BB",
        "UK BB vs Germany BB",
        "France BB vs Germany BB",
        "capital vs capital (equal)",
        "capital vs armoured cruiser",
        "capital vs protected cruiser",
      ].includes(r.scenario.name),
    );
    const heavySinkings = heavy.reduce((a, r) => a + r.sinkingBattles, 0);
    expect(heavySinkings).toBeGreaterThan(0);
    // At least one capital-vs-capital scenario sinks a ship across the matrix.
    const capitalSinkings = reports
      .filter((r) => r.scenario.category === "capital")
      .reduce((a, r) => a + r.sinkingBattles, 0);
    expect(capitalSinkings).toBeGreaterThan(0);

    // The larger fleet must not lose to the smaller one in the asymmetric case.
    const bbVsPc = byName("capital vs protected cruiser");
    expect(bbVsPc.attackerWin).toBeGreaterThanOrEqual(bbVsPc.defenderWin);

    // The mixed legacy/first-class fleet resolves normally.
    const mixed = byName("mixed legacy + first-class fleet");
    expect(mixed.lens[0]).toBeGreaterThanOrEqual(1);

    // Determinism: the same scenario+seed replays byte-identically.
    const a = runBattle(SCENARIOS[0]!.build(), "bench-0").result;
    const b = runBattle(SCENARIOS[0]!.build(), "bench-0").result;
    expect(a.resultHash).toBe(b.resultHash);
    expect(a.minuteHashes).toEqual(b.minuteHashes);
  }, 300_000);
});
