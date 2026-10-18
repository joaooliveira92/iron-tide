import { SafeInt } from "@bluewave/contracts";
import type { ContentPack } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MAX_ECONOMIC_BASE, monthlyRevenue } from "../src/economy.js";
import { buildNationStates } from "../src/nationCompilation.js";

// Economy spec #138 slice 2: the compiler derives the economic base and seeds the standing research budget.
function pack(ids: string[]): ContentPack {
  const nations = ids.map((id) => ({ id, name: id, tag: id.toUpperCase(), isPlayable: true }));
  return { nations } as ContentPack;
}

function compile(
  ids: string[],
  economies: unknown[],
  research: unknown[] = [],
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
      [{ nationId: "gb", researchBudget: 65 }],
    );
    const gb = nations!.get("gb")!;
    expect(gb.baseResources).toBe(6000);
    expect(gb.navalAppropriationRateBp).toBe(2000);
    expect(gb.research.researchBudget).toBe(5);
    expect(gb.research.standingResearchBudget).toBe(5);
    expect(gb.research.annualResearchAllocation).toBe(65); // the authored annual figure is kept for display
    expect(codes(collector, "error")).toEqual([]);
  });

  it("fails the pack for a missing economy row", () => {
    const { collector } = compile(["gb"], []);
    expect(codes(collector, "error")).toContain("ECONOMY_ROW_MISSING");
    expect(codes(collector, "warning")).toEqual([]); // no cascade on top of the real error
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
    // The largest income whose derived base (60 x income at the 2000 bp start rate) stays inside MAX_ECONOMIC_BASE.
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
        expect(base).toBe(60 * income); // independent of deriveEconomicBase
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
      // The overflowing nation compiles to a zero base instead of an unsafe one, so nothing downstream sees a huge value.
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
    // income 100 -> cap 12; annual 200 -> monthly 16
    const { collector } = compile(
      ["a", "b"],
      [
        { nationId: "a", treasury: 1, income: 100, expenses: 0 },
        { nationId: "b", treasury: 1, income: 100, expenses: 0 },
      ],
      [{ nationId: "a", researchBudget: 200 }],
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
      [{ nationId: "a", researchBudget: 4 }],
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
