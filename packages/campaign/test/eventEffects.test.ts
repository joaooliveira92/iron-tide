import type { EventAnswer, EventAnswerEffectRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  activeBudgetModifiers,
  applyTensionJump,
  applyUnrestDelta,
  budgetModifierBp,
  budgetModifierTotalBp,
  effectiveAppropriationRateBp,
  planAnswerEffects,
  UNREST_MAX,
} from "../src/eventEffects.js";
import type { BudgetModifier } from "../src/state.js";

const RULES: EventAnswerEffectRules = {
  budgetDecayMonths: 12,
  budgetStackCapBp: 600,
  tensionJumpCap: 3,
  traitEffects: [
    {
      trait: "cautious",
      stance: "hawk",
      reasonCode: "CAUTIOUS_ADVENTURE",
      prestige: -2,
      tension: -1,
    },
    {
      trait: "aggressive",
      stance: "hawk",
      reasonCode: "AGGRESSIVE_ZEAL",
      budgetBp: 100,
      unrest: 1,
    },
  ],
};

function modifier(overrides: Partial<BudgetModifier> = {}): BudgetModifier {
  return {
    eventId: "border_incident",
    answerId: "mobilise",
    firstMonth: "1880-03",
    initialBp: 1_200,
    decayMonths: 12,
    capBp: 600,
    ...overrides,
  };
}

function answer(
  overrides: Partial<EventAnswer["effects"]> = {},
  stance: EventAnswer["stance"] = "hawk",
): EventAnswer {
  return {
    id: "mobilise",
    stance,
    labelKey: "a",
    effects: { budgetBp: 0, unrest: 0, ...overrides },
  };
}

describe("budget modifier decay", () => {
  it("is full strength in the first month and decays linearly", () => {
    const m = modifier();
    expect(budgetModifierBp(m, "1880-02")).toBe(1_200);
    expect(budgetModifierBp(m, "1880-03")).toBe(1_200);
    expect(budgetModifierBp(m, "1880-04")).toBe(1_100);
    expect(budgetModifierBp(m, "1880-09")).toBe(600);
  });

  it("is zero at month 12 and after", () => {
    const m = modifier();
    expect(budgetModifierBp(m, "1881-02")).toBe(100);
    expect(budgetModifierBp(m, "1881-03")).toBe(0);
    expect(budgetModifierBp(m, "1881-04")).toBe(0);
  });

  it("truncates toward zero for negative modifiers", () => {
    const m = modifier({ initialBp: -100 });
    expect(budgetModifierBp(m, "1880-04")).toBe(-91);
    expect(budgetModifierBp(m, "1880-05")).toBe(-83);
  });

  it("drops expired modifiers from the active list", () => {
    const live = modifier({ firstMonth: "1880-06" });
    const expired = modifier({ eventId: "old" });
    expect(activeBudgetModifiers([expired, live], "1881-03")).toEqual([live]);
  });
});

describe("budget modifier stacking and the effective rate", () => {
  it("stacks up to the cap in either direction", () => {
    const a = modifier({ initialBp: 400 });
    const b = modifier({ eventId: "second", initialBp: 400 });
    expect(budgetModifierTotalBp([a, b], "1880-03")).toBe(600);
    const c = modifier({ initialBp: -400 });
    const d = modifier({ eventId: "second", initialBp: -400 });
    expect(budgetModifierTotalBp([c, d], "1880-03")).toBe(-600);
  });

  it("adds the modifier to the stored rate and leaves the stored rate untouched", () => {
    const nation = {
      navalAppropriationRateBp: SafeInt(2_000),
      budgetModifiers: [modifier({ initialBp: 500 })],
    };
    expect(effectiveAppropriationRateBp(nation, "1880-03")).toBe(2_500);
    expect(nation.navalAppropriationRateBp).toBe(2_000);
    expect(effectiveAppropriationRateBp(nation, "1881-03")).toBe(2_000);
  });

  it("returns the stored rate when there are no modifiers", () => {
    expect(
      effectiveAppropriationRateBp({ navalAppropriationRateBp: SafeInt(1_234) }, "1880-03"),
    ).toBe(1_234);
  });

  it("keeps the effective rate inside the legal appropriation range", () => {
    const high = {
      navalAppropriationRateBp: SafeInt(4_900),
      budgetModifiers: [modifier({ initialBp: 600 })],
    };
    expect(effectiveAppropriationRateBp(high, "1880-03")).toBe(5_000);
    const low = {
      navalAppropriationRateBp: SafeInt(600),
      budgetModifiers: [modifier({ initialBp: -600 })],
    };
    expect(effectiveAppropriationRateBp(low, "1880-03")).toBe(500);
  });
});

describe("unrest and tension helpers", () => {
  it("clamps unrest to 0 through 10 and treats absent as 0", () => {
    expect(applyUnrestDelta(undefined, 3)).toBe(3);
    expect(applyUnrestDelta(8, 5)).toBe(UNREST_MAX);
    expect(applyUnrestDelta(2, -9)).toBe(0);
  });

  it("caps the tension jump and clamps to the war threshold without crossing it", () => {
    expect(applyTensionJump(4, 9, 3)).toBe(7);
    expect(applyTensionJump(9, 3, 3)).toBe(10);
    expect(applyTensionJump(5, -9, 3)).toBe(2);
    expect(applyTensionJump(1, -3, 3)).toBe(0);
  });
});

describe("planAnswerEffects", () => {
  it("emits the declared line first and trait lines after it", () => {
    const plan = planAnswerEffects(
      answer({
        budgetBp: 300,
        unrest: 1,
        prestige: { kind: "FIXED_GAIN", amount: 2, reasonCode: "BORDER_STAND" },
        tension: { counterpart: "highest_tension_rival", delta: 2 },
      }),
      ["cautious", "aggressive"],
      RULES,
    );
    expect(plan.lines.map((line) => [line.source, line.trait])).toEqual([
      ["DECLARED", undefined],
      ["TRAIT", "aggressive"],
      ["TRAIT", "cautious"],
    ]);
    expect(plan.lines[0]).toMatchObject({ budgetBp: 300, unrestDelta: 1, tensionDelta: 2 });
    expect(plan.lines[0]!.prestige).toEqual({
      reasonCode: "BORDER_STAND",
      rule: { kind: "FIXED_GAIN", amount: 2 },
    });
    expect(plan.lines[1]).toMatchObject({
      reasonCode: "AGGRESSIVE_ZEAL",
      budgetBp: 100,
      unrestDelta: 1,
    });
    expect(plan.lines[2]!.prestige).toEqual({
      reasonCode: "CAUTIOUS_ADVENTURE",
      rule: { kind: "FIXED_LOSS", amount: 2 },
    });
    expect(plan.unrest).toBe(2);
    expect(plan.counterpart).toBe("highest_tension_rival");
    expect(plan.tension).toBe(1);
  });

  it("caps the combined tension jump", () => {
    const plan = planAnswerEffects(
      answer({ tension: { counterpart: "war_enemy", delta: 10 } }),
      [],
      RULES,
    );
    expect(plan.tension).toBe(3);
  });

  it("ignores trait lines of another stance and trait tension without a counterpart", () => {
    const plan = planAnswerEffects(answer({}, "dove"), ["cautious"], RULES);
    expect(plan.lines).toHaveLength(1);
    const hawk = planAnswerEffects(answer(), ["cautious"], RULES);
    expect(hawk.counterpart).toBeUndefined();
    expect(hawk.tension).toBe(0);
  });

  it("builds one budget modifier per non-zero budget line", () => {
    const plan = planAnswerEffects(answer({ budgetBp: 300 }), ["aggressive"], RULES);
    expect(plan.lines.filter((line) => line.budgetBp !== 0).map((line) => line.budgetBp)).toEqual([
      300, 100,
    ]);
  });

  it("applies the declared hawk and dove sign convention at runtime", () => {
    const hawk = planAnswerEffects(
      answer({
        budgetBp: 300,
        unrest: 1,
        prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "HAWK" },
        tension: { counterpart: "war_enemy", delta: 1 },
      }),
      [],
      RULES,
    );
    expect(hawk.lines[0]!.budgetBp).toBeGreaterThanOrEqual(0);
    expect(hawk.unrest).toBeGreaterThanOrEqual(0);
    expect(hawk.tension).toBeGreaterThanOrEqual(0);
    expect(hawk.lines[0]!.prestige!.rule.kind).toBe("FIXED_GAIN");

    const dove = planAnswerEffects(
      answer(
        {
          budgetBp: -300,
          unrest: -1,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "DOVE" },
          tension: { counterpart: "war_enemy", delta: -1 },
        },
        "dove",
      ),
      [],
      RULES,
    );
    expect(dove.lines[0]!.budgetBp).toBeLessThanOrEqual(0);
    expect(dove.unrest).toBeLessThanOrEqual(0);
    expect(dove.tension).toBeLessThanOrEqual(0);
    expect(dove.lines[0]!.prestige!.rule.kind).toBe("FIXED_LOSS");
  });
});
