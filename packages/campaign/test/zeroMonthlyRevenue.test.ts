import type { ContentPack } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { buildNationStates, checkStartRevenue } from "../src/nationCompilation.js";
import { FIXTURE_PRESTIGE_RULES, readAuthoredFile } from "@bluewave/test-support";

const ZERO = "ZERO_MONTHLY_REVENUE";
const codes = (c: DiagnosticCollector): string[] => c.all.map((d) => d.code as string);

type NationRow = { id: string; name: string };
type EconomyRows = Parameters<typeof buildNationStates>[2];
type Economy = { nationId: string; treasury: number; income: number; expenses: number };

function compile(nations: NationRow[], economies: EconomyRows): DiagnosticCollector {
  const pack = {
    nations: nations.map(({ id, name }) => ({ id, name, tag: id, isPlayable: true, prestige: 20 })),
  } as ContentPack;
  const collector = new DiagnosticCollector();
  buildNationStates(
    pack,
    [],
    economies,
    [],
    [],
    [],
    "test",
    "1880-01",
    FIXTURE_PRESTIGE_RULES,
    collector,
  );
  return collector;
}

const one = (id: string, row: Omit<Economy, "nationId">): DiagnosticCollector =>
  compile([{ id, name: id }], [{ nationId: id, ...row }]);

describe("ZERO_MONTHLY_REVENUE seam", () => {
  it("is an error naming the nation when gross revenue at the start rate is exactly zero", () => {
    const collector = new DiagnosticCollector();
    checkStartRevenue("zz", SafeInt(59), SafeInt(2000), collector);
    expect(collector.all).toHaveLength(1);
    const d = collector.all[0]!;
    expect(d.code).toBe(ZERO);
    expect(d.severity).toBe("error");
    expect(d.stage).toBe("campaign-compile");
    expect(d.entityId).toBe("zz");
    expect(d.message).toContain("59");
    expect(d.message).toContain("2000");
    expect(d.remediation).toBeDefined();
  });

  it("fires for a zero base and for a rate that rounds a positive base to zero", () => {
    for (const [base, rate] of [
      [0, 2000],
      [60, 1999],
    ] as const) {
      const collector = new DiagnosticCollector();
      checkStartRevenue("a", SafeInt(base), SafeInt(rate), collector);
      expect(codes(collector)).toEqual([ZERO]);
    }
  });

  it("does not fire at exactly one treasury unit, or above", () => {
    for (const base of [60, 61, 6000]) {
      const collector = new DiagnosticCollector();
      checkStartRevenue("a", SafeInt(base), SafeInt(2000), collector);
      expect(codes(collector)).toEqual([]);
    }
  });

  it("gives identical results for different nation ids", () => {
    const run = (id: string, base: number): DiagnosticCollector => {
      const c = new DiagnosticCollector();
      checkStartRevenue(id, SafeInt(base), SafeInt(2000), c);
      return c;
    };
    for (const base of [10, 60]) {
      expect(codes(run("alpha", base))).toEqual(codes(run("omega", base)));
    }
  });

  it("is deterministic across repeated runs", () => {
    const run = (): unknown => {
      const c = new DiagnosticCollector();
      checkStartRevenue("zz", SafeInt(59), SafeInt(2000), c);
      return c.all;
    };
    expect(run()).toEqual(run());
  });
});

describe("ZERO_MONTHLY_REVENUE through the compiler", () => {
  it("does not fire at the smallest valid income (revenue exactly 1)", () => {
    expect(codes(one("a", { treasury: 5, income: 1, expenses: 0 }))).not.toContain(ZERO);
  });

  it("does not fire for positive gross revenue with a net of exactly zero", () => {
    const c = one("a", { treasury: 5, income: 10, expenses: 10 });
    expect(codes(c)).not.toContain(ZERO);
    expect(codes(c)).not.toContain("STRUCTURAL_DEFICIT");
  });

  it("does not fire for positive gross revenue with a structural deficit", () => {
    const c = one("a", { treasury: 50, income: 3, expenses: 4 });
    expect(codes(c)).toContain("STRUCTURAL_DEFICIT");
    expect(codes(c)).not.toContain(ZERO);
  });

  it("raises only the existing code for invalid, missing or overflowing rows", () => {
    for (const row of [
      { treasury: 5, income: 0, expenses: 0 },
      { treasury: 5, income: -3, expenses: 0 },
      { treasury: 5, income: 1.5, expenses: 0 },
      { treasury: -1, income: 5, expenses: 0 },
    ]) {
      expect(codes(one("a", row))).toEqual(["ECONOMY_VALUE_INVALID"]);
    }
    expect(codes(compile([{ id: "a", name: "a" }], []))).toEqual(["ECONOMY_ROW_MISSING"]);
    const overflow = one("a", {
      treasury: 1,
      income: Math.floor(Number.MAX_SAFE_INTEGER / 1000),
      expenses: 0,
    });
    expect(codes(overflow)).toContain("ECONOMY_BASE_OVERFLOW");
    expect(codes(overflow)).not.toContain(ZERO);
  });

  it("is unchanged by relabelling a nation's display name or its canonical id", () => {
    const rows = (id: string): EconomyRows => [
      { nationId: id, treasury: 50, income: 3, expenses: 4 },
    ];
    const baseline = codes(compile([{ id: "alpha", name: "Alpha" }], rows("alpha")));
    expect(codes(compile([{ id: "alpha", name: "Renamed" }], rows("alpha")))).toEqual(baseline);
    expect(codes(compile([{ id: "omega", name: "Alpha" }], rows("omega")))).toEqual(baseline);
  });
});

describe("shipped 1880 pack", () => {
  const read = <T>(file: string): T =>
    readAuthoredFile(
      new URL(`../../../content/production/1880/${file}`, import.meta.url).pathname,
    ) as T;

  it("compiles without ZERO_MONTHLY_REVENUE, identically on repeated runs", () => {
    const run = (): DiagnosticCollector => {
      const pack = { nations: read<ContentPack["nations"]>("countries.ts") } as ContentPack;
      const collector = new DiagnosticCollector();
      buildNationStates(
        pack,
        [],
        read<EconomyRows>("economies.ts"),
        [],
        [],
        [],
        "test",
        "1880-01",
        FIXTURE_PRESTIGE_RULES,
        collector,
      );
      return collector;
    };
    const first = run();
    expect(codes(first)).not.toContain(ZERO);
    expect(run().all).toEqual(first.all);
  });
});
