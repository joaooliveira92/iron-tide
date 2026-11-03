import { SafeInt } from "@bluewave/contracts";
import type { ContentPack } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MAX_ECONOMIC_BASE, monthlyRevenue } from "../src/economy.js";
import { buildNationStates } from "../src/nationCompilation.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { STUB_REGIME, STUB_TRAITS } from "./stub-regime.js";

type EconomyRows = Parameters<typeof buildNationStates>[2];
type ResearchRows = Parameters<typeof buildNationStates>[4];

function pack(ids: string[]): ContentPack {
  const nations = ids.map((id) => ({
    id,
    name: id,
    tag: id.toUpperCase(),
    isPlayable: true,
    prestige: 20,
    traits: STUB_TRAITS,
    regime: STUB_REGIME,
  }));
  return { nations } as ContentPack;
}

function compile(
  ids: string[],
  economies: EconomyRows,
  research: ResearchRows = [],
): { nations: ReturnType<typeof buildNationStates>; collector: DiagnosticCollector } {
  const collector = new DiagnosticCollector();
  const nations = buildNationStates(
    pack(ids),
    [],
    economies,
    [],
    research,
    [],
    "test",
    "1880-01",
    FIXTURE_PRESTIGE_RULES,
    collector,
  );
  return { nations, collector };
}

const codes = (c: DiagnosticCollector, severity: string): string[] =>
  c.all.filter((d) => d.severity === severity).map((d) => d.code as string);

describe("nation economy start state", () => {
  it("derives the base from authored income and seeds the monthly research budget", () => {
    const { nations, collector } = compile(
      ["gb"],
      [{ nationId: "gb", treasury: 500, income: 100, expenses: 38 }],
      [{ nationId: "gb", researchBudget: 65, technologies: [] }],
    );
    const gb = nations!.get("gb")!;
    expect(gb.baseResources).toBe(6000);
    expect(gb.navalAppropriationRateBp).toBe(2000);
    expect(gb.research.researchBudget).toBe(5);
    expect(gb.research.standingResearchBudget).toBe(5);
    expect(gb.research.annualResearchAllocation).toBe(65);
    expect(codes(collector, "error")).toEqual([]);
  });

  it("fails the pack for a missing economy row", () => {
    const { collector } = compile(["gb"], []);
    expect(codes(collector, "error")).toContain("ECONOMY_ROW_MISSING");
    expect(codes(collector, "warning")).toEqual([]);
  });

  it("fails the pack for non-positive income or negative values", () => {
    expect(
      codes(
        compile(["a"], [{ nationId: "a", treasury: 5, income: 0, expenses: 1 }]).collector,
        "error",
      ),
    ).toContain("ECONOMY_VALUE_INVALID");
    expect(
      codes(
        compile(["a"], [{ nationId: "a", treasury: -1, income: 5, expenses: 1 }]).collector,
        "error",
      ),
    ).toContain("ECONOMY_VALUE_INVALID");
    expect(
      codes(
        compile(["a"], [{ nationId: "a", treasury: 1, income: 5, expenses: -1 }]).collector,
        "error",
      ),
    ).toContain("ECONOMY_VALUE_INVALID");
  });

  describe("economic base overflow (ECONOMY_BASE_OVERFLOW)", () => {
    const lastFitting = Math.floor(MAX_ECONOMIC_BASE / 60);
    const overflowDiagnostics = (income: number) => {
      const { nations, collector } = compile(
        ["a"],
        [{ nationId: "a", treasury: 1, income, expenses: 0 }],
      );
      return { nations, found: collector.all.filter((d) => d.code === "ECONOMY_BASE_OVERFLOW") };
    };

    it("is silent at and below the ceiling and the base then yields a safe revenue at the top rate", () => {
      for (const income of [lastFitting - 1, lastFitting]) {
        const { nations, found } = overflowDiagnostics(income);
        expect(found).toEqual([]);
        const base = nations!.get("a")!.baseResources as number;
        expect(base).toBe(60 * income);
        expect(base <= MAX_ECONOMIC_BASE).toBe(true);
        expect(() => monthlyRevenue(nations!.get("a")!.baseResources, SafeInt(5000))).not.toThrow();
      }
    });

    it("is one error at the compiler's own path for the first income above the ceiling, never a throw", () => {
      expect(60 * (lastFitting + 1) > MAX_ECONOMIC_BASE).toBe(true);
      let result!: ReturnType<typeof overflowDiagnostics>;
      expect(() => {
        result = overflowDiagnostics(lastFitting + 1);
      }).not.toThrow();
      expect(result.found).toHaveLength(1);
      expect(result.found[0]).toMatchObject({
        code: "ECONOMY_BASE_OVERFLOW",
        severity: "error",
        stage: "campaign-compile",
        entityId: "a",
      });
      expect(result.nations!.get("a")!.baseResources).toBe(0);
    });

    it("is deterministic and identical for very large safe incomes", () => {
      for (const income of [Number.MAX_SAFE_INTEGER, Math.floor(Number.MAX_SAFE_INTEGER / 2)]) {
        const first = overflowDiagnostics(income).found;
        const second = overflowDiagnostics(income).found;
        expect(first).toHaveLength(1);
        expect(first).toEqual(second);
      }
    });

    it("rejects an unsafe or fractional income as an invalid value, before any overflow arithmetic", () => {
      for (const income of [
        Number.MAX_SAFE_INTEGER + 1,
        1.5,
        Number.POSITIVE_INFINITY,
        Number.NaN,
      ]) {
        const { collector } = compile(["a"], [{ nationId: "a", treasury: 1, income, expenses: 0 }]);
        expect(codes(collector, "error")).toEqual(["ECONOMY_VALUE_INVALID"]);
      }
    });
  });

  it("fails authored research above the 12% share of monthly revenue", () => {
    const { collector } = compile(
      ["a", "b"],
      [
        { nationId: "a", treasury: 1, income: 100, expenses: 0 },
        { nationId: "b", treasury: 1, income: 100, expenses: 0 },
      ],
      [{ nationId: "a", researchBudget: 200, technologies: [] }],
    );
    expect(codes(collector, "error")).toContain("RESEARCH_ABOVE_CAP");
  });

  it("reports a structural deficit as a warning and unresolvable research as info", () => {
    const { collector } = compile(
      ["a", "b"],
      [
        { nationId: "a", treasury: 40, income: 3, expenses: 4 },
        { nationId: "b", treasury: 100, income: 50, expenses: 1 },
      ],
      [{ nationId: "a", researchBudget: 4, technologies: [] }],
    );
    expect(codes(collector, "error")).toEqual([]);
    expect(codes(collector, "warning")).toContain("STRUCTURAL_DEFICIT");
    expect(codes(collector, "info")).toContain("RESEARCH_BELOW_RESOLUTION");
  });

  it("rejects a pack where every nation is in deficit", () => {
    const { collector } = compile(
      ["a", "b"],
      [
        { nationId: "a", treasury: 40, income: 3, expenses: 4 },
        { nationId: "b", treasury: 40, income: 3, expenses: 4 },
      ],
    );
    expect(codes(collector, "error")).toContain("ECONOMY_UNIFORM_DEFICIT");
  });
});

describe("economy diagnostic fixtures", () => {
  const fixtures: {
    code: string;
    severity: "error" | "warning";
    economies: EconomyRows;
    ids?: string[];
    with?: string[];
  }[] = [
    { code: "ECONOMY_ROW_MISSING", severity: "error", economies: [] },
    {
      code: "ECONOMY_VALUE_INVALID",
      severity: "error",
      economies: [{ nationId: "a", treasury: 5, income: 0, expenses: 1 }],
    },
    {
      code: "ECONOMY_BASE_OVERFLOW",
      severity: "error",
      economies: [
        { nationId: "a", treasury: 1, income: Math.floor(MAX_ECONOMIC_BASE / 60) + 1, expenses: 0 },
      ],
    },
    {
      code: "ECONOMY_UNIFORM_DEFICIT",
      severity: "error",
      with: ["STRUCTURAL_DEFICIT"],
      ids: ["a", "b"],
      economies: [
        { nationId: "a", treasury: 40, income: 3, expenses: 4 },
        { nationId: "b", treasury: 40, income: 3, expenses: 4 },
      ],
    },
    {
      code: "STRUCTURAL_DEFICIT",
      severity: "warning",
      ids: ["a", "b"],
      economies: [
        { nationId: "a", treasury: 40, income: 3, expenses: 4 },
        { nationId: "b", treasury: 100, income: 50, expenses: 1 },
      ],
    },
  ];

  for (const f of fixtures)
    it(`${f.code} is a ${f.severity} and ${f.severity === "error" ? "fails" : "does not fail"} the pack`, () => {
      const { collector } = compile(f.ids ?? ["a"], f.economies);
      const emitted = collector.all.filter((d) => d.code === f.code);
      expect(emitted.length).toBeGreaterThan(0);
      expect(emitted.every((d) => d.severity === f.severity)).toBe(true);
      expect(collector.hasErrors).toBe(f.severity === "error");
      const family = collector.all
        .map((d) => d.code as string)
        .filter((c) => /^(ECONOMY_|STRUCTURAL_|RESEARCH_)/.test(c));
      expect(new Set(family)).toEqual(new Set([f.code, ...(f.with ?? [])]));
    });

  it("derives the same economy from data whatever the nations are called", () => {
    const economies = [
      { nationId: "a", treasury: 40, income: 3, expenses: 4 },
      { nationId: "b", treasury: 100, income: 50, expenses: 1 },
    ];
    const research = [{ nationId: "a", researchBudget: 4, technologies: [] }];
    const outcome = (relabel: (id: string) => string) => {
      const ids = ["a", "b"].map(relabel);
      const rename = <T extends { readonly nationId: string }>(rows: readonly T[]): T[] =>
        rows.map((r) => ({ ...r, nationId: relabel(r.nationId) }));
      const { nations, collector } = compile(ids, rename(economies), rename(research));
      const byRole = (role: string) => nations!.get(relabel(role))!;
      return {
        a: [byRole("a").baseResources, byRole("a").research.standingResearchBudget],
        b: [byRole("b").baseResources, byRole("b").research.standingResearchBudget],
        codes: collector.all.map((d) => `${d.code}:${d.severity}`).sort(),
      };
    };
    expect(outcome((id) => (id === "a" ? "zz-first" : "aa-last"))).toEqual(outcome((id) => id));
  });
});

describe("standing research share and cap (compiler)", () => {
  const seeded = (income: number, annual: number) => {
    const { nations, collector } = compile(
      ["a"],
      [{ nationId: "a", treasury: 1, income, expenses: 0 }],
      [{ nationId: "a", researchBudget: annual, technologies: [] }],
    );
    return { nation: nations!.get("a")!, collector };
  };

  it("seeds at most the authored monthly share and the cap, and flags exactly the allocations above the cap", () => {
    const failures: string[] = [];
    for (let income = 1; income <= 120; income += 1) {
      const cap = Math.floor((income * 12) / 100);
      for (let annual = 0; annual <= 1500; annual += 1) {
        const { nation, collector } = seeded(income, annual);
        const standing = nation.research.standingResearchBudget as number;
        const flagged = collector.all.some((d) => d.code === "RESEARCH_ABOVE_CAP");
        const problems: string[] = [];
        if (standing * 12 > annual || annual - standing * 12 >= 12)
          problems.push("not floor(annual/12)");
        if (nation.research.researchBudget !== standing)
          problems.push("monthly budget differs from standing");
        if (nation.research.annualResearchAllocation !== annual)
          problems.push("annual allocation not kept");
        if (flagged !== standing > cap)
          problems.push(`flagged=${flagged} but standing ${standing} vs cap ${cap}`);
        if (!flagged && standing > cap) problems.push("seeded above the cap without a diagnostic");
        if (problems.length > 0 && failures.length < 5)
          failures.push(`income=${income} annual=${annual} cap=${cap}: ${problems.join("; ")}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("is exact at the cap: equal passes, one allocation step above fails; zero income share and zero cap behave", () => {
    expect(seeded(100, 144).nation.research.standingResearchBudget).toBe(12);
    expect(seeded(100, 155).nation.research.standingResearchBudget).toBe(12);
    expect(seeded(100, 155).collector.hasErrors).toBe(false);
    expect(seeded(100, 156).collector.all.map((d) => d.code)).toContain("RESEARCH_ABOVE_CAP");
    expect(seeded(8, 0).collector.hasErrors).toBe(false);
    expect(seeded(8, 0).nation.research.standingResearchBudget).toBe(0);
    const tiny = seeded(8, 11);
    expect(tiny.nation.research.standingResearchBudget).toBe(0);
    expect(tiny.collector.hasErrors).toBe(false);
    expect(tiny.collector.all.map((d) => `${d.code}:${d.severity}`)).toContain(
      "RESEARCH_BELOW_RESOLUTION:info",
    );
  });
});
