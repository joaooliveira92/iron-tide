import { describe, expect, it } from "vite-plus/test";
import { RandomEngine, RandomLedger } from "@bluewave/random";

import {
  projectMissileContext,
  resolveMissiles,
  type MissileContext,
  type MissileRules,
  type MissileTargetShip,
} from "@bluewave/combat/missiles";

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

const TARGETS: MissileTargetShip[] = [
  { shipId: "a1", sideId: "ATTACKER", position: [0, 0], operational: true },
  { shipId: "d1", sideId: "DEFENDER", position: [10_000_000, 0], operational: true },
];

function launchContext(): MissileContext {
  const context = projectMissileContext(
    [
      {
        shipId: "a1",
        sideId: "ATTACKER",
        capabilities: [{ kind: "missile_launch", missileClass: "heavy_ssm" }],
      },
    ],
    RULES,
  );
  if (context === undefined) throw new Error("expected a launcher");
  return context;
}

function runTwoMinutes(seed: string): {
  records: readonly { recordHash: string; kind: string; streamId: string | null }[];
  ledger: RandomLedger;
} {
  const engine = new RandomEngine(seed);
  const ledger = new RandomLedger();
  const first = resolveMissiles({
    battleId: "battle-1",
    minute: 1,
    context: launchContext(),
    targets: TARGETS,
    engine,
    randomLedger: ledger,
  });
  const context: MissileContext = {
    ...launchContext(),
    launchers: launchContext().launchers.map((launcher) => {
      const next = first.launcherStates[launcher.launcherId];
      return next ?? launcher;
    }),
    inFlight: first.inFlight,
  };
  const second = resolveMissiles({
    battleId: "battle-1",
    minute: 2,
    context,
    targets: TARGETS,
    engine,
    randomLedger: ledger,
  });
  return { records: [...first.records, ...second.records], ledger };
}

describe("deterministic SSM resolution (#293)", () => {
  it("launches from a launcher, then records hits at the flight-time minute", () => {
    const { records } = runTwoMinutes("missile-seed");
    expect(records.map((record) => record.kind)).toEqual(["LAUNCH", "LAUNCH", "HIT", "HIT"]);
  });

  it("records every draw in the random ledger with stream, entity and reason", () => {
    const { ledger } = runTwoMinutes("missile-seed");
    expect(ledger.all).toHaveLength(3);
    for (const decision of ledger.all) {
      expect(decision.streamId).toMatch(/^missile\/(intercept|hit):battle-1:/);
      expect(decision.entityKey).toBe("a1:SSM:heavy_ssm");
      expect(decision.phase).toBe("resolve_battle_auto_resolution_missiles");
      expect(decision.rulesetVersion).toBe("missile_ruleset_v1");
      expect(decision.reasonCode).toBe("MISSILE_KEYED_DRAW");
      expect(decision.inputHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("same seed produces byte-identical records and ledgers", () => {
    const a = runTwoMinutes("missile-seed");
    const b = runTwoMinutes("missile-seed");
    expect(a.records.map((record) => record.recordHash)).toEqual(
      b.records.map((record) => record.recordHash),
    );
    expect(a.ledger.toJSON()).toBe(b.ledger.toJSON());
  });

  it("a different seed produces a different draw ledger", () => {
    const a = runTwoMinutes("seed-a");
    const b = runTwoMinutes("seed-b");
    expect(a.ledger.toJSON()).not.toBe(b.ledger.toJSON());
  });

  it("does nothing without a launcher", () => {
    const result = resolveMissiles({
      battleId: "battle-1",
      minute: 1,
      context: { launchers: [], inFlight: [], rules: RULES },
      targets: TARGETS,
      engine: new RandomEngine("missile-seed"),
      randomLedger: new RandomLedger(),
    });
    expect(result.changed).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.impactsByTarget).toEqual({});
  });
});
