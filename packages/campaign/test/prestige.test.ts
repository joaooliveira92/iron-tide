import { SafeInt } from "@bluewave/contracts";
import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import * as prestigeModule from "../src/prestige.js";
import {
  applyPrestigeRule,
  buildCareerResult,
  CAREER_END_REASONS,
  decodePrestigeValueSet,
  isSackingEligible,
  PRESTIGE_REASON_CODES,
  REQUIRED_PRESTIGE_REASON_CODES,
  resolveSacking,
  type PrestigeRule,
  type PrestigeValueSet,
} from "../src/prestige.js";

const FIXTURE: Record<string, unknown> = {
  lowerBound: 0,
  upperBound: 100,
  sackingThreshold: 10,
  sackingProbabilityBp: 2_500,
  rules: {
    UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS", basisPoints: 500 },
    BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: 1_000 },
    BATTLE_WON: { kind: "FIXED_GAIN", amount: 2 },
  },
};

function fixtureSet(overrides: Record<string, unknown> = {}): PrestigeValueSet {
  const decoded = decodePrestigeValueSet({ ...FIXTURE, ...overrides });
  if (Result.isFailure(decoded))
    throw new Error(`fixture failed to decode: ${decoded.failure._tag}`);
  return decoded.success;
}

describe("the closed vocabularies", () => {
  it("exports exactly the three prestige reason codes and two career end reasons", () => {
    expect([...PRESTIGE_REASON_CODES]).toEqual([
      "UNPAID_FUNDS",
      "BATTLE_LOST",
      "BATTLE_WON",
      "DECLINED_BATTLE",
    ]);
    expect([...REQUIRED_PRESTIGE_REASON_CODES]).toEqual([
      "UNPAID_FUNDS",
      "BATTLE_LOST",
      "BATTLE_WON",
    ]);
    expect([...CAREER_END_REASONS]).toEqual(["SACKED", "CAMPAIGN_END"]);
  });
});

describe("prestige failures", () => {
  it("are tagged Error instances carrying a message", () => {
    const notInteger = applyPrestigeRule(40, "DECLINED_BATTLE", fixtureSet(), {
      kind: "FIXED_LOSS",
      amount: 1.5 as SafeInt,
    });
    expect(Result.isFailure(notInteger)).toBe(true);
    if (Result.isFailure(notInteger)) {
      expect(notInteger.failure._tag).toBe("PrestigeNotInteger");
      expect(notInteger.failure).toBeInstanceOf(Error);
      expect(typeof notInteger.failure.message).toBe("string");
    }

    const invalid = decodePrestigeValueSet({ ...FIXTURE, extra: 1 });
    expect(Result.isFailure(invalid)).toBe(true);
    if (Result.isFailure(invalid)) {
      expect(invalid.failure._tag).toBe("PrestigeValueSetInvalid");
      expect(invalid.failure).toBeInstanceOf(Error);
      expect(invalid.failure.field).toBe("extra");
      expect(invalid.failure.message.length).toBeGreaterThan(0);
    }
  });
});

describe("decodePrestigeValueSet", () => {
  it("decodes a complete value set", () => {
    const decoded = decodePrestigeValueSet(FIXTURE);
    expect(Result.isSuccess(decoded)).toBe(true);
    if (Result.isSuccess(decoded)) {
      expect(decoded.success.rules.BATTLE_LOST).toEqual({
        kind: "PROPORTIONAL_LOSS",
        basisPoints: 1_000,
      });
    }
  });

  it("has no defaults: every missing field is rejected by name", () => {
    for (const key of ["lowerBound", "upperBound", "sackingThreshold", "sackingProbabilityBp"]) {
      const { [key]: _removed, ...rest } = FIXTURE;
      const decoded = decodePrestigeValueSet(rest);
      expect(Result.isSuccess(decoded)).toBe(false);
      if (Result.isFailure(decoded)) {
        expect(decoded.failure._tag).toBe("PrestigeValueSetInvalid");
        expect(decoded.failure.field).toBe(key);
      }
    }
    for (const code of REQUIRED_PRESTIGE_REASON_CODES) {
      const rules = { ...(FIXTURE["rules"] as Record<string, unknown>) };
      delete rules[code];
      const decoded = decodePrestigeValueSet({ ...FIXTURE, rules });
      expect(Result.isSuccess(decoded)).toBe(false);
      if (Result.isFailure(decoded)) expect(decoded.failure.field).toBe(`rules.${code}`);
    }
    expect(Result.isSuccess(decodePrestigeValueSet({}))).toBe(false);
  });

  it("rejects excess keys at the top level, in rules and inside a rule", () => {
    const top = decodePrestigeValueSet({ ...FIXTURE, extra: 1 });
    expect(Result.isSuccess(top)).toBe(false);
    if (Result.isFailure(top)) expect(top.failure.field).toBe("extra");

    const rules = decodePrestigeValueSet({
      ...FIXTURE,
      rules: { ...(FIXTURE["rules"] as object), WAR_LOST: { kind: "FIXED_GAIN", amount: 1 } },
    });
    expect(Result.isSuccess(rules)).toBe(false);
    if (Result.isFailure(rules)) expect(rules.failure.field).toBe("rules.WAR_LOST");

    const inside = decodePrestigeValueSet({
      ...FIXTURE,
      rules: {
        ...(FIXTURE["rules"] as object),
        BATTLE_WON: { kind: "FIXED_GAIN", amount: 2, bonus: 1 },
      },
    });
    expect(Result.isSuccess(inside)).toBe(false);
    if (Result.isFailure(inside)) expect(inside.failure.field).toBe("rules.BATTLE_WON.bonus");
  });

  it("rejects non-integer, unsafe and out-of-range fields", () => {
    const bad: [string, unknown][] = [
      ["lowerBound", 1.5],
      ["upperBound", Number.MAX_SAFE_INTEGER + 2],
      ["upperBound", "100"],
      ["lowerBound", -1],
      ["sackingThreshold", 101],
      ["sackingThreshold", -1],
      ["sackingProbabilityBp", 10_001],
      ["sackingProbabilityBp", -1],
      ["sackingProbabilityBp", 0.5],
    ];
    for (const [field, value] of bad) {
      const decoded = decodePrestigeValueSet({ ...FIXTURE, [field]: value });
      expect(Result.isSuccess(decoded), `${field}=${String(value)}`).toBe(false);
    }
    expect(
      Result.isSuccess(decodePrestigeValueSet({ ...FIXTURE, lowerBound: 100, upperBound: 100 })),
    ).toBe(false);
    expect(
      Result.isSuccess(
        decodePrestigeValueSet({ ...FIXTURE, lowerBound: 20, sackingThreshold: 10 }),
      ),
    ).toBe(false);
  });

  it("rejects malformed rules: unknown kind, a bad rate, a bad amount, a mixed shape", () => {
    const withRule = (rule: unknown) =>
      decodePrestigeValueSet({
        ...FIXTURE,
        rules: { ...(FIXTURE["rules"] as object), BATTLE_LOST: rule },
      });
    expect(Result.isSuccess(withRule({ kind: "WAR_LOSS", basisPoints: 100 }))).toBe(false);
    expect(Result.isSuccess(withRule({ kind: "PROPORTIONAL_LOSS", basisPoints: 10_001 }))).toBe(
      false,
    );
    expect(Result.isSuccess(withRule({ kind: "PROPORTIONAL_LOSS", basisPoints: -1 }))).toBe(false);
    expect(Result.isSuccess(withRule({ kind: "PROPORTIONAL_LOSS", basisPoints: 1.5 }))).toBe(false);
    expect(Result.isSuccess(withRule({ kind: "FIXED_GAIN", amount: -1 }))).toBe(false);
    expect(Result.isSuccess(withRule({ kind: "FIXED_GAIN", amount: 101 }))).toBe(false);
    expect(Result.isSuccess(withRule({ kind: "FIXED_GAIN", basisPoints: 100 }))).toBe(false);
    expect(Result.isSuccess(withRule(null))).toBe(false);
    expect(Result.isSuccess(withRule("PROPORTIONAL_LOSS"))).toBe(false);
  });

  it("accepts the extreme probabilities and rates as supplied values", () => {
    expect(Result.isSuccess(decodePrestigeValueSet({ ...FIXTURE, sackingProbabilityBp: 0 }))).toBe(
      true,
    );
    expect(
      Result.isSuccess(decodePrestigeValueSet({ ...FIXTURE, sackingProbabilityBp: 10_000 })),
    ).toBe(true);
  });

  it("rejects input that is not a record", () => {
    for (const input of [null, undefined, 1, "x", [], true]) {
      expect(Result.isSuccess(decodePrestigeValueSet(input))).toBe(false);
    }
  });
});

describe("applyPrestigeRule: proportional loss", () => {
  const set = fixtureSet();

  it("costs more in absolute terms at higher prestige than at lower prestige", () => {
    const high = applyPrestigeRule(80, "BATTLE_LOST", set);
    const low = applyPrestigeRule(20, "BATTLE_LOST", set);
    expect(Result.isSuccess(high) && Result.isSuccess(low)).toBe(true);
    if (Result.isSuccess(high) && Result.isSuccess(low)) {
      expect(high.success.delta).toBe(-8);
      expect(low.success.delta).toBe(-2);
      expect(Math.abs(high.success.delta)).toBeGreaterThan(Math.abs(low.success.delta));
    }
  });

  it("rounds a fractional loss up, so a loss is never rounded away", () => {
    const result = applyPrestigeRule(25, "UNPAID_FUNDS", set);
    expect(Result.isSuccess(result) && result.success).toMatchObject({
      before: 25,
      after: 23,
      delta: -2,
    });
    const tiny = applyPrestigeRule(1, "UNPAID_FUNDS", set);
    expect(Result.isSuccess(tiny) && tiny.success).toMatchObject({
      before: 1,
      after: 0,
      delta: -1,
    });
  });

  it("is exact at the .5 and whole-number boundaries", () => {
    const cases: [number, number][] = [
      [15, 2],
      [10, 1],
      [11, 2],
      [5, 1],
      [100, 10],
    ];
    for (const [current, loss] of cases) {
      const result = applyPrestigeRule(current, "BATTLE_LOST", set);
      expect(Result.isSuccess(result) && result.success.delta, `10% of ${current}`).toBe(-loss);
    }
  });

  it("clamps to the lower bound and reports the delta actually applied", () => {
    const floorSet = fixtureSet({ lowerBound: 4, sackingThreshold: 10 });
    const result = applyPrestigeRule(5, "BATTLE_LOST", floorSet);
    expect(Result.isSuccess(result) && result.success).toMatchObject({ after: 4, delta: -1 });
    const heavy = fixtureSet({
      lowerBound: 4,
      rules: {
        ...(FIXTURE["rules"] as object),
        BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: 10_000 },
      },
    });
    const clamped = applyPrestigeRule(9, "BATTLE_LOST", heavy);
    expect(Result.isSuccess(clamped) && clamped.success).toMatchObject({
      before: 9,
      after: 4,
      delta: -5,
    });
  });

  it("changes nothing at the lower bound and reports a zero delta", () => {
    const result = applyPrestigeRule(0, "BATTLE_LOST", set);
    expect(Result.isSuccess(result) && result.success).toMatchObject({
      before: 0,
      after: 0,
      delta: 0,
    });
  });

  it("never leaves the bounds for any prestige, rule or rate", () => {
    for (const bp of [0, 1, 99, 500, 1_000, 3_333, 9_999, 10_000]) {
      const rated = fixtureSet({
        rules: {
          ...(FIXTURE["rules"] as object),
          BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: bp },
        },
      });
      for (let current = 0; current <= 100; current += 1) {
        const result = applyPrestigeRule(current, "BATTLE_LOST", rated);
        expect(Result.isSuccess(result)).toBe(true);
        if (Result.isSuccess(result)) {
          expect(result.success.after).toBeGreaterThanOrEqual(0);
          expect(result.success.after).toBeLessThanOrEqual(current);
          expect(result.success.delta).toBe(result.success.after - current);
        }
      }
    }
  });

  it("loses at least as much in absolute terms as prestige rises (monotone in prestige)", () => {
    let previous = 0;
    for (let current = 0; current <= 100; current += 1) {
      const result = applyPrestigeRule(current, "BATTLE_LOST", set);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const loss = Math.abs(result.success.delta);
        expect(loss).toBeGreaterThanOrEqual(previous);
        previous = loss;
      }
    }
  });

  it("is deterministic: the same inputs give the same result", () => {
    expect(applyPrestigeRule(37, "UNPAID_FUNDS", set)).toEqual(
      applyPrestigeRule(37, "UNPAID_FUNDS", set),
    );
  });
});

describe("applyPrestigeRule: fixed gain", () => {
  const set = fixtureSet();

  it("adds the supplied amount regardless of current prestige", () => {
    for (const current of [0, 20, 90]) {
      const result = applyPrestigeRule(current, "BATTLE_WON", set);
      expect(Result.isSuccess(result) && result.success.delta).toBe(2);
    }
  });

  it("clamps to the upper bound and reports the delta actually applied", () => {
    const result = applyPrestigeRule(99, "BATTLE_WON", set);
    expect(Result.isSuccess(result) && result.success).toMatchObject({
      before: 99,
      after: 100,
      delta: 1,
    });
    const full = applyPrestigeRule(100, "BATTLE_WON", set);
    expect(Result.isSuccess(full) && full.success).toMatchObject({
      before: 100,
      after: 100,
      delta: 0,
    });
  });
});

describe("applyPrestigeRule: fixed loss (ADR-0261)", () => {
  const set = fixtureSet();
  const fixedLoss: PrestigeRule = { kind: "FIXED_LOSS", amount: SafeInt(3) };

  it("subtracts the supplied amount regardless of current prestige and clamps at the lower bound", () => {
    for (const current of [50, 90]) {
      const result = applyPrestigeRule(current, "DECLINED_BATTLE", set, fixedLoss);
      expect(Result.isSuccess(result) && result.success).toMatchObject({
        before: current,
        delta: -3,
      });
    }
    const near = applyPrestigeRule(2, "DECLINED_BATTLE", set, fixedLoss);
    expect(Result.isSuccess(near) && near.success).toMatchObject({
      before: 2,
      after: 0,
      delta: -2,
    });
    const floor = applyPrestigeRule(0, "DECLINED_BATTLE", set, fixedLoss);
    expect(Result.isSuccess(floor) && floor.success).toMatchObject({
      before: 0,
      after: 0,
      delta: 0,
    });
  });

  it("takes an explicitly supplied rule of any kind, and rejects a non-integer amount", () => {
    const loss = applyPrestigeRule(40, "DECLINED_BATTLE", set, {
      kind: "PROPORTIONAL_LOSS",
      basisPoints: SafeInt(500),
    });
    expect(Result.isSuccess(loss) && loss.success.delta).toBe(-2);
    const bad = applyPrestigeRule(40, "DECLINED_BATTLE", set, {
      kind: "FIXED_LOSS",
      amount: 1.5 as SafeInt,
    });
    expect(Result.isSuccess(bad)).toBe(false);
    if (Result.isFailure(bad)) expect(bad.failure._tag).toBe("PrestigeNotInteger");
  });

  it("fails with a typed error, never a default, when DECLINED_BATTLE has no rule", () => {
    const result = applyPrestigeRule(40, "DECLINED_BATTLE", set);
    expect(Result.isSuccess(result)).toBe(false);
    if (Result.isFailure(result)) expect(result.failure._tag).toBe("PrestigeRuleMissing");
  });

  it("leaves every existing source's result unchanged when a rule is not supplied", () => {
    const result = applyPrestigeRule(50, "UNPAID_FUNDS", set);
    expect(Result.isSuccess(result) && result.success).toMatchObject({
      before: 50,
      after: 47,
      delta: -3,
    });
  });
});

describe("decodePrestigeValueSet: the optional DECLINED_BATTLE rule (ADR-0261)", () => {
  const withRules = (extra: Record<string, unknown>) =>
    decodePrestigeValueSet({ ...FIXTURE, rules: { ...(FIXTURE["rules"] as object), ...extra } });

  it("decodes a value set without it and carries no DECLINED_BATTLE key", () => {
    const decoded = decodePrestigeValueSet(FIXTURE);
    expect(Result.isSuccess(decoded) && "DECLINED_BATTLE" in decoded.success.rules).toBe(false);
  });

  it("accepts a fixed-loss rule for it when authored, bounded by the span, and rejects excess keys", () => {
    const ok = withRules({ DECLINED_BATTLE: { kind: "FIXED_LOSS", amount: 2 } });
    expect(Result.isSuccess(ok) && ok.success.rules.DECLINED_BATTLE).toEqual({
      kind: "FIXED_LOSS",
      amount: 2,
    });
    expect(
      Result.isSuccess(withRules({ DECLINED_BATTLE: { kind: "FIXED_LOSS", amount: 101 } })),
    ).toBe(false);
    expect(
      Result.isSuccess(withRules({ DECLINED_BATTLE: { kind: "FIXED_LOSS", amount: -1 } })),
    ).toBe(false);
    expect(
      Result.isSuccess(
        withRules({ DECLINED_BATTLE: { kind: "FIXED_LOSS", amount: 1, basisPoints: 1 } }),
      ),
    ).toBe(false);
  });
});

describe("applyPrestigeRule: input validation", () => {
  const set = fixtureSet();

  it("rejects a non-integer prestige with a tagged error", () => {
    const result = applyPrestigeRule(20.5, "BATTLE_LOST", set);
    expect(Result.isSuccess(result)).toBe(false);
    if (Result.isFailure(result)) expect(result.failure._tag).toBe("PrestigeNotInteger");
  });

  it("rejects NaN, infinities and unsafe integers", () => {
    for (const value of [Number.NaN, Infinity, -Infinity]) {
      const result = applyPrestigeRule(value, "BATTLE_LOST", set);
      expect(Result.isSuccess(result)).toBe(false);
      if (Result.isFailure(result)) expect(result.failure._tag).toBe("PrestigeNotInteger");
    }
    const unsafe = applyPrestigeRule(Number.MAX_SAFE_INTEGER + 2, "BATTLE_LOST", set);
    expect(Result.isSuccess(unsafe)).toBe(false);
    if (Result.isFailure(unsafe)) expect(unsafe.failure._tag).toBe("PrestigeUnsafeInteger");
  });

  it("rejects prestige outside the ruleset bounds", () => {
    for (const value of [-1, 101]) {
      const result = applyPrestigeRule(value, "BATTLE_WON", set);
      expect(Result.isSuccess(result)).toBe(false);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("PrestigeOutOfRange");
      }
    }
  });

  it("rejects a reason code outside the closed vocabulary", () => {
    const result = applyPrestigeRule(20, "WAR_LOST" as never, set);
    expect(Result.isSuccess(result)).toBe(false);
    if (Result.isFailure(result)) expect(result.failure._tag).toBe("PrestigeUnknownReason");
  });
});

describe("sacking eligibility", () => {
  const set = fixtureSet();

  it("is eligible at or below the threshold and not above it", () => {
    expect(isSackingEligible(10, set)).toBe(true);
    expect(isSackingEligible(0, set)).toBe(true);
    expect(isSackingEligible(11, set)).toBe(false);
    expect(isSackingEligible(100, set)).toBe(false);
  });

  it("makes no draw above the threshold", () => {
    let draws = 0;
    const outcome = resolveSacking(11, set, () => {
      draws += 1;
      return 0;
    });
    expect(draws).toBe(0);
    expect(outcome).toEqual(Result.succeed({ eligible: false }));
  });

  it("makes exactly one draw at or below the threshold", () => {
    let draws = 0;
    resolveSacking(10, set, () => {
      draws += 1;
      return 9_999;
    });
    expect(draws).toBe(1);
  });

  it("sacks when the draw falls below the supplied probability and not otherwise", () => {
    const sacked = resolveSacking(8, set, () => 2_499);
    expect(Result.isSuccess(sacked) && sacked.success).toEqual({
      eligible: true,
      draw: 2_499,
      sacked: true,
    });
    const kept = resolveSacking(8, set, () => 2_500);
    expect(Result.isSuccess(kept) && kept.success).toEqual({
      eligible: true,
      draw: 2_500,
      sacked: false,
    });
  });

  it("uses only the supplied probability at 0 and at certain, never substituting a value", () => {
    const never = fixtureSet({ sackingProbabilityBp: 0 });
    const always = fixtureSet({ sackingProbabilityBp: 10_000 });
    for (const draw of [0, 1, 5_000, 9_999]) {
      const a = resolveSacking(5, never, () => draw);
      const b = resolveSacking(5, always, () => draw);
      expect(Result.isSuccess(a) && a.success).toMatchObject({ eligible: true, sacked: false });
      expect(Result.isSuccess(b) && b.success).toMatchObject({ eligible: true, sacked: true });
    }
  });

  it("is deterministic for a given draw and probability", () => {
    const run = () => resolveSacking(3, set, () => 1_234);
    expect(run()).toEqual(run());
  });

  it("rejects a draw outside 0..9999 or not an integer, with a tagged error", () => {
    for (const draw of [-1, 10_000, 1.5, Number.NaN]) {
      const result = resolveSacking(5, set, () => draw);
      expect(Result.isSuccess(result)).toBe(false);
      if (Result.isFailure(result)) expect(result.failure._tag).toBe("PrestigeDrawInvalid");
    }
  });

  it("rejects an invalid prestige before drawing", () => {
    let draws = 0;
    const result = resolveSacking(Number.NaN, set, () => {
      draws += 1;
      return 0;
    });
    expect(Result.isSuccess(result)).toBe(false);
    expect(draws).toBe(0);
  });
});

describe("buildCareerResult", () => {
  it("holds the nation, the prestige as the score, the reason and the month", () => {
    const result = buildCareerResult({
      nationId: "uk",
      score: 42,
      reason: "SACKED",
      month: { year: 1884, month: 3 },
    });
    expect(result).toEqual(
      Result.succeed({
        nationId: "uk",
        score: 42,
        reason: "SACKED",
        month: { year: 1884, month: 3 },
      }),
    );
  });

  it("accepts both end reasons and rejects any other", () => {
    for (const reason of CAREER_END_REASONS) {
      expect(
        Result.isSuccess(
          buildCareerResult({ nationId: "uk", score: 1, reason, month: { year: 1880, month: 1 } }),
        ),
      ).toBe(true);
    }
    const bad = buildCareerResult({
      nationId: "uk",
      score: 1,
      reason: "RETIRED" as never,
      month: { year: 1880, month: 1 },
    });
    expect(Result.isSuccess(bad)).toBe(false);
    if (Result.isFailure(bad)) expect(bad.failure._tag).toBe("CareerResultInvalid");
  });

  it("rejects a non-integer score, an empty nation and an impossible month", () => {
    const base = {
      nationId: "uk",
      score: 1,
      reason: "SACKED" as const,
      month: { year: 1880, month: 1 },
    };
    expect(Result.isSuccess(buildCareerResult({ ...base, score: 1.5 }))).toBe(false);
    expect(Result.isSuccess(buildCareerResult({ ...base, score: -1 }))).toBe(false);
    expect(Result.isSuccess(buildCareerResult({ ...base, nationId: "" }))).toBe(false);
    expect(Result.isSuccess(buildCareerResult({ ...base, month: { year: 1880, month: 0 } }))).toBe(
      false,
    );
    expect(Result.isSuccess(buildCareerResult({ ...base, month: { year: 1880, month: 13 } }))).toBe(
      false,
    );
    expect(
      Result.isSuccess(buildCareerResult({ ...base, month: { year: 1880.5, month: 1 } })),
    ).toBe(false);
  });
});

describe("no prestige value ships from this layer", () => {
  it("exports no default or fixture value set: nothing the module exports decodes as one", () => {
    for (const [name, value] of Object.entries(prestigeModule)) {
      if (typeof value !== "object" || value === null) continue;
      expect(
        Result.isSuccess(decodePrestigeValueSet(value)),
        `export '${name}' must not be a value set`,
      ).toBe(false);
    }
  });
});
