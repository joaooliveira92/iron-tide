import { describe, expect, it } from "vite-plus/test";
import { compiledTorpedoOf } from "../fixtures/compiledTorpedoes.js";
import { SafeInt } from "@bluewave/contracts";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import { resolveBattleAuto } from "../../src/battleResolution/resolve.js";
import { CauseOfLossTracker } from "../../src/battleResolution/causeOfLoss.js";
import { initialDamageState } from "../../src/battleResolution/damage.js";
import { makeAutoInput, makeNations, type FixtureNationSet } from "./fixtures.js";

const WHITEHEAD = "whitehead_14in_1886";
const base = initialDamageState("s1");
const st = (p: Partial<typeof base>) => ({ ...base, ...p });

describe("CauseOfLossTracker (unit)", () => {
  const pre = st({ flotationReserve: 1000, structuralIntegrity: 500 });

  it("gunfire: direct structural/flotation loss with no flooding growth", () => {
    const t = new CauseOfLossTracker();
    t.observe(
      "s1",
      pre,
      st({ flotationReserve: 0, structuralIntegrity: 100, terminalStatus: "SINKING" }),
      false,
    );
    expect(t.causeOf("s1")).toBe("gunfire");
  });

  it("flooding: reserve drained by progressive flooding growth", () => {
    const t = new CauseOfLossTracker();
    t.observe(
      "s1",
      pre,
      st({ flotationReserve: 0, progressiveFloodingTotal: 1000, terminalStatus: "SINKING" }),
      false,
    );
    expect(t.causeOf("s1")).toBe("flooding");
  });

  it("torpedo: torpedo hit this minute, or flooding from a torpedo-caused source", () => {
    const a = new CauseOfLossTracker();
    a.observe("s1", pre, st({ flotationReserve: 0, terminalStatus: "SINKING" }), true);
    expect(a.causeOf("s1")).toBe("torpedo");
    const b = new CauseOfLossTracker();
    const src = [
      { compartmentId: "c", rateKgMin: 5, cause: "TORPEDO_PROGRESSIVE_FLOODING_CREATED" },
    ];
    b.observe(
      "s1",
      st({ flotationReserve: 1000, floodingRecords: src }),
      st({
        flotationReserve: 0,
        progressiveFloodingTotal: 1000,
        floodingRecords: src,
        terminalStatus: "SINKING",
      }),
      false,
    );
    expect(b.causeOf("s1")).toBe("torpedo");
  });

  it("fire: breakup with no reserve loss while a fire burns; otherwise gunfire", () => {
    const fire = [{ locationId: "m", intensityBp: 5000, cause: "FIRE_SOURCE_CREATED" }];
    const t = new CauseOfLossTracker();
    t.observe(
      "s1",
      st({ fireRecords: fire }),
      st({ fireRecords: fire, terminalStatus: "FOUNDERED" }),
      false,
    );
    expect(t.causeOf("s1")).toBe("fire");
    const u = new CauseOfLossTracker();
    u.observe("s1", base, st({ terminalStatus: "FOUNDERED" }), false);
    expect(u.causeOf("s1")).toBe("gunfire");
  });

  it("accumulates across minutes and ignores ships that did not sink", () => {
    const t = new CauseOfLossTracker();
    const mid = st({ flotationReserve: 400, structuralIntegrity: 500 });
    t.observe("s1", pre, mid, false);
    expect(t.causeOf("s1")).toBeUndefined();
    t.observe(
      "s1",
      mid,
      st({ flotationReserve: 0, progressiveFloodingTotal: 400, terminalStatus: "SINKING" }),
      false,
    );
    expect(t.causeOf("s1")).toBe("gunfire");
  });
});

function ironclads(armed: boolean, guns: number): FixtureNationSet {
  const n = makeNations({ attackerGuns: [guns, guns], defenderGuns: [guns, guns] });
  const map = (m: Map<string, CompiledDesignVersion>) =>
    new Map(
      [...m].map(([id, d]) => [
        id,
        {
          ...d,
          normalizedSpeedUms: SafeInt(14 * 514_444),
          normalizedDisplacementKg: SafeInt(11_000_000),
          ...(armed
            ? {
                torpedoArmament: [
                  {
                    mountType: "UNDERWATER_FIXED" as const,
                    tubeCount: SafeInt(2),
                    torpedoModelId: WHITEHEAD,
                    compiledTorpedo: compiledTorpedoOf(WHITEHEAD),
                  },
                  {
                    mountType: "ABOVE_WATER_TRAINABLE" as const,
                    tubeCount: SafeInt(2),
                    torpedoModelId: WHITEHEAD,
                    compiledTorpedo: compiledTorpedoOf(WHITEHEAD),
                  },
                ],
              }
            : {}),
        },
      ]),
    );
  return {
    ...n,
    attacker: { ...n.attacker, designs: map(n.attacker.designs) },
    defender: { ...n.defender, designs: map(n.defender.designs) },
  };
}

function thinArmor(n: FixtureNationSet): FixtureNationSet {
  const map = (m: Map<string, CompiledDesignVersion>) =>
    new Map([...m].map(([id, d]) => [id, { ...d, normalizedArmorUm: SafeInt(152_400) }]));
  return {
    ...n,
    attacker: { ...n.attacker, designs: map(n.attacker.designs) },
    defender: { ...n.defender, designs: map(n.defender.designs) },
  };
}

describe("cause-of-loss in resolveBattleAuto", () => {
  it("torpedo-only battle: every sunk ship reports torpedo; deterministic; sunk ids match", () => {
    const input = { ...makeAutoInput({ nations: ironclads(true, 0) }), campaignSeed: "s1" };
    const r = resolveBattleAuto(input);
    const sunk = [...r.attackerSunkIds, ...r.defenderSunkIds].sort();
    expect(sunk.length).toBeGreaterThan(0);
    expect(Object.keys(r.causeOfLoss!).sort()).toEqual(sunk);
    for (const id of sunk) expect(r.causeOfLoss![id]).toBe("torpedo");
    const again = resolveBattleAuto(input);
    expect(again.causeOfLoss).toEqual(r.causeOfLoss);
    expect(again.resultHash).toBe(r.resultHash);
  });

  it("gun battle: causes are valid, cover exactly the sunk ships, and are not hashed", () => {
    const r = resolveBattleAuto({
      ...makeAutoInput({ nations: thinArmor(makeNations()) }),
      campaignSeed: "cause-8",
    });
    const sunk = [...r.attackerSunkIds, ...r.defenderSunkIds].sort();
    expect(sunk.length).toBeGreaterThan(0);
    expect(Object.keys(r.causeOfLoss!).sort()).toEqual(sunk);
    for (const id of sunk) expect(["gunfire", "flooding", "fire"]).toContain(r.causeOfLoss![id]);
    const { causeOfLoss: _c, ...rest } = r;
    expect(JSON.parse(JSON.stringify(rest))).not.toHaveProperty("causeOfLoss");
  });

  it("no ship lost -> field omitted (optional-safe)", () => {
    const r = resolveBattleAuto({
      ...makeAutoInput({ nations: ironclads(false, 0) }),
      campaignSeed: "s1",
    });
    expect(r.attackerSunkIds.length + r.defenderSunkIds.length).toBe(0);
    expect(r.causeOfLoss).toBeUndefined();
  });
});
