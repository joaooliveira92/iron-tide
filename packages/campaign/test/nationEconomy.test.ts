import type { ContentPack } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
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

  it("fails when the derived base would overflow", () => {
    const { collector } = compile(
      ["a"],
      [
        {
          nationId: "a",
          treasury: 1,
          income: Math.floor(Number.MAX_SAFE_INTEGER / 1000),
          expenses: 0,
        },
      ],
    );
    expect(codes(collector, "error")).toContain("ECONOMY_BASE_OVERFLOW");
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
