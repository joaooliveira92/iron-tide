import { describe, expect, it } from "vite-plus/test";
import * as prestigeModule from "../src/prestige.js";
import {
  applyPrestigeRule,
  buildCareerResult,
  CAREER_END_REASONS,
  decodePrestigeValueSet,
  isSackingEligible,
  PRESTIGE_REASON_CODES,
  resolveSacking,
  type PrestigeValueSet,
} from "../src/prestige.js";

// Test-only fixture ruleset. These numbers exist to exercise the rule layer; they are not
// prestige values and must never appear in production content (asserted below).
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
  if (!decoded.ok) throw new Error(`fixture failed to decode: ${decoded.error._tag}`);
  return decoded.value;
}

describe("the closed vocabularies", () => {
  it("exports exactly the three prestige reason codes and two career end reasons", () => {
    expect([...PRESTIGE_REASON_CODES]).toEqual(["UNPAID_FUNDS", "BATTLE_LOST", "BATTLE_WON"]);
    expect([...CAREER_END_REASONS]).toEqual(["SACKED", "CAMPAIGN_END"]);
  });
});

describe("decodePrestigeValueSet", () => {
  it("decodes a complete value set", () => {
    const decoded = decodePrestigeValueSet(FIXTURE);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.rules.BATTLE_LOST).toEqual({
        kind: "PROPORTIONAL_LOSS",
        basisPoints: 1_000,
      });
    }
  });

  it("has no defaults: every missing field is rejected by name", () => {
    for (const key of ["lowerBound", "upperBound", "sackingThreshold", "sackingProbabilityBp"]) {
      const { [key]: _removed, ...rest } = FIXTURE;
      const decoded = decodePrestigeValueSet(rest);
      expect(decoded.ok).toBe(false);
      if (!decoded.ok) {
        expect(decoded.error._tag).toBe("PrestigeValueSetInvalid");
        expect(decoded.error.field).toBe(key);
      }
    }
    for (const code of PRESTIGE_REASON_CODES) {
      const rules = { ...(FIXTURE["rules"] as Record<string, unknown>) };
      delete rules[code];
      const decoded = decodePrestigeValueSet({ ...FIXTURE, rules });
      expect(decoded.ok).toBe(false);
      if (!decoded.ok) expect(decoded.error.field).toBe(`rules.${code}`);
    }
    expect(decodePrestigeValueSet({}).ok).toBe(false);
  });

  it("rejects excess keys at the top level, in rules and inside a rule", () => {
    const top = decodePrestigeValueSet({ ...FIXTURE, extra: 1 });
    expect(top.ok).toBe(false);
    if (!top.ok) expect(top.error.field).toBe("extra");

    const rules = decodePrestigeValueSet({
      ...FIXTURE,
      rules: { ...(FIXTURE["rules"] as object), WAR_LOST: { kind: "FIXED_GAIN", amount: 1 } },
    });
    expect(rules.ok).toBe(false);
    if (!rules.ok) expect(rules.error.field).toBe("rules.WAR_LOST");

    const inside = decodePrestigeValueSet({
      ...FIXTURE,
      rules: {
        ...(FIXTURE["rules"] as object),
        BATTLE_WON: { kind: "FIXED_GAIN", amount: 2, bonus: 1 },
      },
    });
    expect(inside.ok).toBe(false);
    if (!inside.ok) expect(inside.error.field).toBe("rules.BATTLE_WON.bonus");
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
      expect(decoded.ok, `${field}=${String(value)}`).toBe(false);
    }
    // The bounds must be ordered, and the threshold must sit between them.
    expect(decodePrestigeValueSet({ ...FIXTURE, lowerBound: 100, upperBound: 100 }).ok).toBe(false);
    expect(decodePrestigeValueSet({ ...FIXTURE, lowerBound: 20, sackingThreshold: 10 }).ok).toBe(
      false,
    );
  });

  it("rejects malformed rules: unknown kind, a bad rate, a bad amount, a mixed shape", () => {
    const withRule = (rule: unknown) =>
      decodePrestigeValueSet({
        ...FIXTURE,
        rules: { ...(FIXTURE["rules"] as object), BATTLE_LOST: rule },
      });
    expect(withRule({ kind: "WAR_LOSS", basisPoints: 100 }).ok).toBe(false);
    expect(withRule({ kind: "PROPORTIONAL_LOSS", basisPoints: 10_001 }).ok).toBe(false);
    expect(withRule({ kind: "PROPORTIONAL_LOSS", basisPoints: -1 }).ok).toBe(false);
    expect(withRule({ kind: "PROPORTIONAL_LOSS", basisPoints: 1.5 }).ok).toBe(false);
    expect(withRule({ kind: "FIXED_GAIN", amount: -1 }).ok).toBe(false);
    expect(withRule({ kind: "FIXED_GAIN", amount: 101 }).ok).toBe(false);
    expect(withRule({ kind: "FIXED_GAIN", basisPoints: 100 }).ok).toBe(false);
    expect(withRule(null).ok).toBe(false);
    expect(withRule("PROPORTIONAL_LOSS").ok).toBe(false);
  });

  it("accepts the extreme probabilities and rates as supplied values", () => {
    expect(decodePrestigeValueSet({ ...FIXTURE, sackingProbabilityBp: 0 }).ok).toBe(true);
    expect(decodePrestigeValueSet({ ...FIXTURE, sackingProbabilityBp: 10_000 }).ok).toBe(true);
  });

  it("rejects input that is not a record", () => {
    for (const input of [null, undefined, 1, "x", [], true]) {
      expect(decodePrestigeValueSet(input).ok).toBe(false);
    }
  });
});

describe("applyPrestigeRule: proportional loss", () => {
  const set = fixtureSet();

  it("costs more in absolute terms at higher prestige than at lower prestige", () => {
    const high = applyPrestigeRule(80, "BATTLE_LOST", set);
    const low = applyPrestigeRule(20, "BATTLE_LOST", set);
    expect(high.ok && low.ok).toBe(true);
    if (high.ok && low.ok) {
      expect(high.value.delta).toBe(-8);
      expect(low.value.delta).toBe(-2);
      expect(Math.abs(high.value.delta)).toBeGreaterThan(Math.abs(low.value.delta));
    }
  });

  it("rounds a fractional loss up, so a loss is never rounded away", () => {
    // 5% of 25 is 1.25, which rounds up to 2.
    const result = applyPrestigeRule(25, "UNPAID_FUNDS", set);
    expect(result.ok && result.value).toMatchObject({ before: 25, after: 23, delta: -2 });
    // 5% of 1 is 0.05, which still costs 1.
    const tiny = applyPrestigeRule(1, "UNPAID_FUNDS", set);
    expect(tiny.ok && tiny.value).toMatchObject({ before: 1, after: 0, delta: -1 });
  });

  it("is exact at the .5 and whole-number boundaries", () => {
    // 10% of 15 is exactly 1.5 -> 2; 10% of 10 is exactly 1 -> 1; 10% of 11 is 1.1 -> 2.
    const cases: [number, number][] = [
      [15, 2],
      [10, 1],
      [11, 2],
      [5, 1],
      [100, 10],
    ];
    for (const [current, loss] of cases) {
      const result = applyPrestigeRule(current, "BATTLE_LOST", set);
      expect(result.ok && result.value.delta, `10% of ${current}`).toBe(-loss);
    }
  });

  it("clamps to the lower bound and reports the delta actually applied", () => {
    const floorSet = fixtureSet({ lowerBound: 4, sackingThreshold: 10 });
    const result = applyPrestigeRule(5, "BATTLE_LOST", floorSet);
    // 10% of 5 rounds up to 1, so 5 -> 4 is exactly at the floor.
    expect(result.ok && result.value).toMatchObject({ after: 4, delta: -1 });
    const heavy = fixtureSet({
      lowerBound: 4,
      rules: {
        ...(FIXTURE["rules"] as object),
        BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: 10_000 },
      },
    });
    const clamped = applyPrestigeRule(9, "BATTLE_LOST", heavy);
    expect(clamped.ok && clamped.value).toMatchObject({ before: 9, after: 4, delta: -5 });
  });

  it("changes nothing at the lower bound and reports a zero delta", () => {
    const result = applyPrestigeRule(0, "BATTLE_LOST", set);
    expect(result.ok && result.value).toMatchObject({ before: 0, after: 0, delta: 0 });
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
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.after).toBeGreaterThanOrEqual(0);
          expect(result.value.after).toBeLessThanOrEqual(current);
          expect(result.value.delta).toBe(result.value.after - current);
        }
      }
    }
  });

  it("loses at least as much in absolute terms as prestige rises (monotone in prestige)", () => {
    let previous = 0;
    for (let current = 0; current <= 100; current += 1) {
      const result = applyPrestigeRule(current, "BATTLE_LOST", set);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const loss = Math.abs(result.value.delta);
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
      expect(result.ok && result.value.delta).toBe(2);
    }
  });

  it("clamps to the upper bound and reports the delta actually applied", () => {
    const result = applyPrestigeRule(99, "BATTLE_WON", set);
    expect(result.ok && result.value).toMatchObject({ before: 99, after: 100, delta: 1 });
    const full = applyPrestigeRule(100, "BATTLE_WON", set);
    expect(full.ok && full.value).toMatchObject({ before: 100, after: 100, delta: 0 });
  });
});

describe("applyPrestigeRule: input validation", () => {
  const set = fixtureSet();

  it("rejects a non-integer prestige with a tagged error", () => {
    const result = applyPrestigeRule(20.5, "BATTLE_LOST", set);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error._tag).toBe("PrestigeNotInteger");
  });

  it("rejects NaN, infinities and unsafe integers", () => {
    for (const value of [Number.NaN, Infinity, -Infinity]) {
      const result = applyPrestigeRule(value, "BATTLE_LOST", set);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error._tag).toBe("PrestigeNotInteger");
    }
    const unsafe = applyPrestigeRule(Number.MAX_SAFE_INTEGER + 2, "BATTLE_LOST", set);
    expect(unsafe.ok).toBe(false);
    if (!unsafe.ok) expect(unsafe.error._tag).toBe("PrestigeUnsafeInteger");
  });

  it("rejects prestige outside the ruleset bounds", () => {
    for (const value of [-1, 101]) {
      const result = applyPrestigeRule(value, "BATTLE_WON", set);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe("PrestigeOutOfRange");
      }
    }
  });

  it("rejects a reason code outside the closed vocabulary", () => {
    const result = applyPrestigeRule(20, "WAR_LOST" as never, set);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error._tag).toBe("PrestigeUnknownReason");
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
    expect(outcome).toEqual({ ok: true, value: { eligible: false } });
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
    expect(sacked.ok && sacked.value).toEqual({ eligible: true, draw: 2_499, sacked: true });
    const kept = resolveSacking(8, set, () => 2_500);
    expect(kept.ok && kept.value).toEqual({ eligible: true, draw: 2_500, sacked: false });
  });

  it("uses only the supplied probability at 0 and at certain, never substituting a value", () => {
    const never = fixtureSet({ sackingProbabilityBp: 0 });
    const always = fixtureSet({ sackingProbabilityBp: 10_000 });
    for (const draw of [0, 1, 5_000, 9_999]) {
      const a = resolveSacking(5, never, () => draw);
      const b = resolveSacking(5, always, () => draw);
      expect(a.ok && a.value).toMatchObject({ eligible: true, sacked: false });
      expect(b.ok && b.value).toMatchObject({ eligible: true, sacked: true });
    }
  });

  it("is deterministic for a given draw and probability", () => {
    const run = () => resolveSacking(3, set, () => 1_234);
    expect(run()).toEqual(run());
  });

  it("rejects a draw outside 0..9999 or not an integer, with a tagged error", () => {
    for (const draw of [-1, 10_000, 1.5, Number.NaN]) {
      const result = resolveSacking(5, set, () => draw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error._tag).toBe("PrestigeDrawInvalid");
    }
  });

  it("rejects an invalid prestige before drawing", () => {
    let draws = 0;
    const result = resolveSacking(Number.NaN, set, () => {
      draws += 1;
      return 0;
    });
    expect(result.ok).toBe(false);
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
    expect(result).toEqual({
      ok: true,
      value: { nationId: "uk", score: 42, reason: "SACKED", month: { year: 1884, month: 3 } },
    });
  });

  it("accepts both end reasons and rejects any other", () => {
    for (const reason of CAREER_END_REASONS) {
      expect(
        buildCareerResult({ nationId: "uk", score: 1, reason, month: { year: 1880, month: 1 } }).ok,
      ).toBe(true);
    }
    const bad = buildCareerResult({
      nationId: "uk",
      score: 1,
      reason: "RETIRED" as never,
      month: { year: 1880, month: 1 },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error._tag).toBe("CareerResultInvalid");
  });

  it("rejects a non-integer score, an empty nation and an impossible month", () => {
    const base = {
      nationId: "uk",
      score: 1,
      reason: "SACKED" as const,
      month: { year: 1880, month: 1 },
    };
    expect(buildCareerResult({ ...base, score: 1.5 }).ok).toBe(false);
    expect(buildCareerResult({ ...base, score: -1 }).ok).toBe(false);
    expect(buildCareerResult({ ...base, nationId: "" }).ok).toBe(false);
    expect(buildCareerResult({ ...base, month: { year: 1880, month: 0 } }).ok).toBe(false);
    expect(buildCareerResult({ ...base, month: { year: 1880, month: 13 } }).ok).toBe(false);
    expect(buildCareerResult({ ...base, month: { year: 1880.5, month: 1 } }).ok).toBe(false);
  });
});

describe("no prestige value ships from this layer", () => {
  it("exports no default or fixture value set: nothing the module exports decodes as one", () => {
    for (const [name, value] of Object.entries(prestigeModule)) {
      if (typeof value !== "object" || value === null) continue;
      expect(decodePrestigeValueSet(value).ok, `export '${name}' must not be a value set`).toBe(
        false,
      );
    }
  });
});
