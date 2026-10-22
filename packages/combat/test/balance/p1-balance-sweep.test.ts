import { mkdirSync, writeFileSync } from "node:fs";
import { compiledTorpedoOf } from "../fixtures/compiledTorpedoes.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import type { LossCause } from "../../src/battleResolution/causeOfLoss.js";
import {
  resolveBattleAuto,
  type BattleResolutionResult,
} from "../../src/battleResolution/resolve.js";
import {
  ATTACKER_NATION,
  DEFENDER_NATION,
  makeAutoInput,
  makeNations,
  type FixtureNationSet,
} from "../battle-resolution/fixtures.js";

const SEEDS = 30;
const UMS_PER_KNOT = 514_444;
const WHITEHEAD = "whitehead_14in_1886";

type DesignMap = Map<string, CompiledDesignVersion>;
const mapDesigns = (
  n: FixtureNationSet,
  side: "attacker" | "defender",
  f: (d: CompiledDesignVersion) => CompiledDesignVersion,
): FixtureNationSet => ({
  ...n,
  [side]: {
    ...n[side],
    designs: new Map([...n[side].designs].map(([id, d]) => [id, f(d)])) as DesignMap,
  },
});

const withSpeed = (n: FixtureNationSet, side: "attacker" | "defender", knots: number) =>
  mapDesigns(n, side, (d) => ({ ...d, normalizedSpeedUms: SafeInt(knots * UMS_PER_KNOT) }));

const withTorps = (n: FixtureNationSet, side: "attacker" | "defender") =>
  mapDesigns(n, side, (d) => ({
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
  }));

interface Matchup {
  name: string;
  aLabel: string;
  bLabel: string;
  build: () => FixtureNationSet;
}

const MATCHUPS: Matchup[] = [
  {
    name: "equal fleets (2x10-gun 30kn each)",
    aLabel: "att",
    bLabel: "def",
    build: () => makeNations(),
  },
  {
    name: "10-gun vs 4-gun",
    aLabel: "10-gun",
    bLabel: "4-gun",
    build: () => makeNations({ attackerGuns: [10, 10], defenderGuns: [4, 4] }),
  },
  {
    name: "30kn vs 14kn",
    aLabel: "30kn",
    bLabel: "14kn",
    build: () => withSpeed(withSpeed(makeNations(), "attacker", 30), "defender", 14),
  },
  {
    name: "torpedoes vs unarmed (14kn/4-gun ironclads)",
    aLabel: "torp",
    bLabel: "no-torp",
    build: () => {
      const n = makeNations({ attackerGuns: [4, 4], defenderGuns: [4, 4] });
      const era = (side: "attacker" | "defender", x: FixtureNationSet) =>
        mapDesigns(x, side, (d) => ({
          ...d,
          normalizedSpeedUms: SafeInt(14 * UMS_PER_KNOT),
          normalizedDisplacementKg: SafeInt(11_000_000),
        }));
      return withTorps(era("defender", era("attacker", n)), "attacker");
    },
  },
];

interface Stats {
  n: number;
  lenMean: number;
  lenMin: number;
  lenMax: number;
  aWin: number;
  bWin: number;
  noWinner: number;
  sinkMean: number;
  aSinkMean: number;
  bSinkMean: number;
  noViableShare: number;
  disengageShare: number;
  timeLimitShare: number;
  otherShare: number;
  reasons: Record<string, number>;
  meanHpLossPerShip: number;
  tubesFiredMean: number;
  torpHitsMean: number;
  causes: Record<LossCause, number>;
  causeMean: Record<LossCause, number>;
}

function runMatchup(m: Matchup): Stats {
  const results: BattleResolutionResult[] = [];
  for (let s = 0; s < SEEDS; s++) {
    const input = makeAutoInput({ nations: m.build() });
    results.push(resolveBattleAuto({ ...input, campaignSeed: `sweep-seed-${s}` }));
  }
  const n = results.length;
  const sum = (f: (r: BattleResolutionResult) => number) => results.reduce((a, r) => a + f(r), 0);
  const lens = results.map((r) => r.elapsedMinutes);
  const reasons: Record<string, number> = {};
  for (const r of results) reasons[r.battleEndReason] = (reasons[r.battleEndReason] ?? 0) + 1;
  const hpLoss = sum((r) => Object.values(r.damageReport).reduce((a, v) => a + v, 0));
  const ships = sum((r) => Object.keys(r.damageReport).length);
  const causes: Record<LossCause, number> = { gunfire: 0, fire: 0, flooding: 0, torpedo: 0 };
  for (const r of results) for (const c of Object.values(r.causeOfLoss ?? {})) causes[c] += 1;
  return {
    n,
    causes,
    causeMean: {
      gunfire: causes.gunfire / n,
      fire: causes.fire / n,
      flooding: causes.flooding / n,
      torpedo: causes.torpedo / n,
    },
    lenMean: sum((r) => r.elapsedMinutes) / n,
    lenMin: Math.min(...lens),
    lenMax: Math.max(...lens),
    aWin: results.filter((r) => r.winnerId === ATTACKER_NATION).length / n,
    bWin: results.filter((r) => r.winnerId === DEFENDER_NATION).length / n,
    noWinner: results.filter((r) => r.winnerId === null).length / n,
    sinkMean: sum((r) => r.attackerSunkIds.length + r.defenderSunkIds.length) / n,
    aSinkMean: sum((r) => r.attackerSunkIds.length) / n,
    bSinkMean: sum((r) => r.defenderSunkIds.length) / n,
    noViableShare: (reasons["no_viable_combatants"] ?? 0) / n,
    disengageShare:
      ((reasons["withdrawal_complete"] ?? 0) + (reasons["mutual_disengagement"] ?? 0)) / n,
    timeLimitShare: (reasons["time_limit"] ?? 0) / n,
    otherShare:
      1 -
      ((reasons["no_viable_combatants"] ?? 0) +
        (reasons["time_limit"] ?? 0) +
        ((reasons["withdrawal_complete"] ?? 0) + (reasons["mutual_disengagement"] ?? 0))) /
        n,
    reasons,
    meanHpLossPerShip: ships === 0 ? 0 : hpLoss / ships,
    tubesFiredMean: sum((r) => r.torpedoSummary?.tubesFired ?? 0) / n,
    torpHitsMean: sum((r) => r.torpedoSummary?.hits ?? 0) / n,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function renderMarkdown(rows: Array<{ m: Matchup; s: Stats }>): string {
  const lines = [
    "# P-1 balance sweep (auto-resolution)",
    "",
    `Generated by \`packages/combat/test/balance/p1-balance-sweep.test.ts\` (BALANCE_SWEEP_WRITE=1). ${SEEDS} seeds per matchup, fixture fleets (2 BB per side, 1880 June, sea state 3), \`resolveBattleAuto\`. Post tickets 06/09/10 and lethality tuning (ADR-0048/0049/0050/0053) + ticket 11 speed advantage (ADR-0072) + ticket 12 disengagement (ADR-0073) + ADR-0094 caliber unit correction + ADR-0098 post-correction lethality rebalance. Non-normative; BALANCE observation only.`,
    "",
    "| Matchup (attacker vs defender) | Len mean / min / max (min) | Attacker win | Defender win | No winner | Mean sunk (att / def) | no_viable_combatants | disengagement (withdrawal / mutual) | time_limit | other | Mean hp loss/ship | Torp tubes fired / hits (mean) | Lost to gunfire / fire / flooding / torpedo (mean per battle) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const { m, s } of rows) {
    lines.push(
      `| ${m.name} (${m.aLabel} vs ${m.bLabel}) | ${s.lenMean.toFixed(1)} / ${s.lenMin} / ${s.lenMax} | ${pct(s.aWin)} | ${pct(s.bWin)} | ${pct(s.noWinner)} | ${s.sinkMean.toFixed(2)} (${s.aSinkMean.toFixed(2)} / ${s.bSinkMean.toFixed(2)}) | ${pct(s.noViableShare)} | ${pct(s.disengageShare)} | ${pct(s.timeLimitShare)} | ${pct(s.otherShare)} | ${s.meanHpLossPerShip.toFixed(1)} | ${s.tubesFiredMean.toFixed(1)} / ${s.torpHitsMean.toFixed(2)} | ${s.causeMean.gunfire.toFixed(2)} / ${s.causeMean.fire.toFixed(2)} / ${s.causeMean.flooding.toFixed(2)} / ${s.causeMean.torpedo.toFixed(2)} (totals ${s.causes.gunfire}/${s.causes.fire}/${s.causes.flooding}/${s.causes.torpedo}) |`,
    );
  }
  lines.push(
    "",
    "End reasons: " +
      rows.map(({ m, s }) => `${m.aLabel}/${m.bLabel}: ${JSON.stringify(s.reasons)}`).join("; "),
    "",
    "Cause of loss comes from `BattleResolutionResult.causeOfLoss` (ADR-0052; observational, not hashed): the dominant accumulated source of flotation/structural loss up to the terminal transition. `gunfire` = direct structural/flotation damage from shells; `flooding` = progressive flooding drain (including shell-opened breaches); `torpedo` = torpedo hit damage or torpedo-sourced flooding; `fire` = terminal loss with no reserve loss while a fire burns.",
    "",
  );
  return lines.join("\n");
}

describe("P-1 balance sweep (loose tripwire)", () => {
  it("sweeps matchups with sane aggregate bounds", () => {
    const rows = MATCHUPS.map((m) => ({ m, s: runMatchup(m) }));
    for (const { s } of rows) {
      expect(s.n).toBe(SEEDS);
      expect(s.lenMin).toBeGreaterThanOrEqual(1);
      expect(s.lenMax).toBeLessThanOrEqual(360);
      expect(s.sinkMean).toBeGreaterThanOrEqual(0);
      expect(s.sinkMean).toBeLessThanOrEqual(4);
      expect(s.aWin + s.bWin + s.noWinner).toBeCloseTo(1, 9);
      const lost = Object.values(s.causes).reduce((a, v) => a + v, 0);
      expect(lost).toBeCloseTo(s.sinkMean * s.n, 6);
    }
    const bySpec = (name: string) => rows.find((r) => r.m.name.startsWith(name))!.s;
    const guns = bySpec("10-gun");
    expect(guns.aWin).toBeGreaterThanOrEqual(guns.bWin);
    const equal = bySpec("equal");
    expect(Math.abs(equal.aWin - equal.bWin)).toBeLessThanOrEqual(0.7);
    expect(equal.lenMean).toBeGreaterThanOrEqual(30);
    expect(equal.lenMean).toBeLessThanOrEqual(90);
    expect(equal.disengageShare + equal.timeLimitShare).toBeGreaterThanOrEqual(0.2);
    expect(equal.sinkMean).toBeLessThan(2.0);
    const speed = bySpec("30kn");
    expect(speed.aWin).toBeGreaterThanOrEqual(0.5);
    const torp = bySpec("torpedoes");
    expect(torp.aWin).toBeGreaterThanOrEqual(torp.bWin);

    expect(runMatchup(MATCHUPS[1]!)).toEqual(guns);

    if (process.env["BALANCE_SWEEP_WRITE"] === "1") {
      const here = dirname(fileURLToPath(import.meta.url));
      const out = resolve(here, "../../../../docs/research/p1-balance-sweep.md");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, renderMarkdown(rows));
    }
  }, 300_000);
});
