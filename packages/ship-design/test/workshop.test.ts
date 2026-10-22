import { describe, it, expect } from "vite-plus/test";
import { buildWorkshopView, applyEdit, type WorkshopEnvironment } from "../src/index.js";
import { LEDGER_CATEGORIES } from "../src/ledger.js";
import { CVE_LABEL } from "../src/cve.js";
import {
  constructionBalance,
  costBalance,
  cveBalance,
  earlyContext,
  shipBuildingContent,
} from "./helpers/earlyContext.js";
import { havock, majestic } from "./helpers/references.js";
import { renderExplanation } from "./helpers/explanation.js";

const env = (month: string): WorkshopEnvironment => ({
  ctx: earlyContext(month),
  costBalance,
  costCtx: { maturityBpByTech: {}, firstOfClass: true },
  constructionBalance,
  cveBalance,
  yards: shipBuildingContent.environmentFor(month).yards,
});

describe("buildWorkshopView", () => {
  const v = buildWorkshopView(havock, env("1895-06"));
  it("exposes every ledger line, with shares that add up to the displacement", () => {
    expect(v.ledger.map((r) => r.category)).toEqual([...LEDGER_CATEGORIES]);
    expect(v.ledger.reduce((a, r) => a + r.kg, 0)).toBe(v.totalKg);
    expect(v.ledger.reduce((a, r) => a + r.shareBp, 0)).toBeLessThanOrEqual(10_000);
    expect(v.ledger.reduce((a, r) => a + r.shareBp, 0)).toBeGreaterThan(9_990);
  });
  it("reports headline metrics with tones and the brief's targets", () => {
    const by = Object.fromEntries(v.metrics.map((m) => [m.id, m]));
    expect(renderExplanation(by.speed!.value)).toMatch(/kn \(need 25\.5\)/);
    expect(by.speed!.tone).toBe("ok");
    expect(renderExplanation(by.range!.value)).toContain("need 1,200");
    expect(renderExplanation(by.crew!.value)).toMatch(/^\d+ \/ \d+$/);
    expect(v.valid).toBe(true);
    expect(v.naturalClass).toBe("DD");
  });
  it("forecasts cost and build time for a valid design, and labels the dev metric", () => {
    expect(v.forecast.costMicro).toBeGreaterThan(0);
    expect(v.forecast.months).toBeGreaterThan(0);
    expect(v.forecast.note).toBeNull();
    expect(v.cve.label).toBe(CVE_LABEL);
  });
  it("groups findings by severity and counts them", () => {
    const total = Object.values(v.counts).reduce((a, n) => a + n, 0);
    expect(total).toBe(v.compiled.findings.length);
    for (const [sev, list] of Object.entries(v.findingsBySeverity))
      expect(list.every((f) => f.severity === sev)).toBe(true);
  });
  it("an invalid design explains why there is no schedule, and turns the displacement metric red", () => {
    const bad = buildWorkshopView(
      applyEdit(havock, { kind: "set_machinery", patch: { fuelCapacityKg: 400_000 } }),
      env("1895-06"),
    );
    expect(bad.valid).toBe(false);
    expect(bad.forecast.months).toBeNull();
    expect(bad.forecast.note).toContain("blocking");
    expect(bad.counts.BLOCKING).toBeGreaterThan(0);
    expect(bad.metrics.find((m) => m.id === "displacement")!.tone).toBe("bad");
  });
  it("is deterministic and works for the battleship", () => {
    const a = buildWorkshopView(majestic, env("1896-01"));
    expect(JSON.stringify(a)).toBe(JSON.stringify(buildWorkshopView(majestic, env("1896-01"))));
    expect(a.valid).toBe(true);
    expect(a.naturalClass).toBe("B");
  });
  it("forecast build time follows displacement, industry and acceleration (ticket 20)", () => {
    const small = buildWorkshopView(havock, env("1895-06"));
    const big = buildWorkshopView(majestic, env("1896-01"));
    expect(big.forecast.note).toBeNull();
    expect(small.forecast.historicalMonths).toBeGreaterThan(0);
    expect(big.forecast.historicalMonths!).toBeGreaterThan(small.forecast.historicalMonths!);
    expect(big.forecast.months!).toBeGreaterThanOrEqual(big.forecast.historicalMonths!);
    const fast = buildWorkshopView(majestic, {
      ...env("1896-01"),
      industryBp: constructionBalance.efficientIndustryBp,
    });
    expect(fast.forecast.historicalMonths!).toBeLessThan(big.forecast.historicalMonths!);
    const rushed = buildWorkshopView(majestic, {
      ...env("1896-01"),
      costCtx: { maturityBpByTech: {}, firstOfClass: true, accelerated: true },
    });
    expect(rushed.forecast.historicalMonths!).toBeLessThan(big.forecast.historicalMonths!);
    expect(rushed.forecast.costMicro).toBeGreaterThan(big.forecast.costMicro);
    expect(buildWorkshopView(majestic, { ...env("1896-01"), industryBp: 10_000 }).forecast).toEqual(
      big.forecast,
    );
  });
  it("the forecast is provisional only while a bracketing build-time point is not VERIFIED (ticket 22)", () => {
    const e = env("1896-01");
    expect(buildWorkshopView(majestic, e).forecast.historicalProvisional).toBe(false);
    const withStatus = (status: "VERIFIED" | "SECONDARY" | "ESTIMATE") => ({
      ...e,
      constructionBalance: {
        ...constructionBalance,
        buildMonthsProvenance: constructionBalance.buildMonthsProvenance.map((p) => ({
          ...p,
          status,
        })),
      },
    });
    expect(buildWorkshopView(majestic, withStatus("ESTIMATE")).forecast.historicalProvisional).toBe(
      true,
    );
    expect(
      buildWorkshopView(majestic, withStatus("SECONDARY")).forecast.historicalProvisional,
    ).toBe(true);
    expect(buildWorkshopView(majestic, withStatus("VERIFIED")).forecast.historicalProvisional).toBe(
      false,
    );
  });
  it("a Majestic-size hull is forecast in the large yard; a destroyer in the smallest yard that fits (ADR-0067 section 6)", () => {
    const big = buildWorkshopView(majestic, env("1896-01"));
    expect(big.forecast.yardId).toBe("yard_large");
    expect(big.forecast.months).not.toBeNull();
    const small = buildWorkshopView(havock, env("1895-06"));
    expect(small.forecast.yardId).toBe("yard_small");
  });
  it("lists every yard with its fit, reasons and months; exactly the forecast yard is chosen", () => {
    const big = buildWorkshopView(majestic, env("1896-01")).forecast;
    expect(big.yards.map((y) => y.yardId)).toEqual(["yard_small", "yard_medium", "yard_large"]);
    expect(big.yards.filter((y) => y.chosen).map((y) => y.yardId)).toEqual(["yard_large"]);
    const small = big.yards.find((y) => y.yardId === "yard_small")!;
    expect(small.exceeds.length).toBeGreaterThan(0);
    expect(small.months).toBeNull();
    const large = big.yards.find((y) => y.yardId === "yard_large")!;
    expect(large.exceeds).toEqual([]);
    expect(large.months).toBe(big.months);
    const dd = buildWorkshopView(havock, env("1895-06")).forecast;
    expect(dd.yards.every((y) => y.exceeds.length === 0 && y.months !== null)).toBe(true);
    expect(dd.yards.filter((y) => y.chosen).map((y) => y.yardId)).toEqual(["yard_small"]);
  });
  it("lists no yards until the design is valid, and none chosen when no yard fits", () => {
    const none = buildWorkshopView(majestic, { ...env("1896-01"), yards: [] });
    expect(none.forecast.yards).toEqual([]);
    const e = env("1896-01");
    const noFit = buildWorkshopView(majestic, {
      ...e,
      yards: e.yards.map((y) => ({ ...y, facility: { ...y.facility, maxLengthMm: 1 } })),
    });
    expect(noFit.forecast.yards.every((y) => !y.chosen && y.exceeds.includes("LENGTH"))).toBe(true);
  });
  it("forecast = max(historical, schedule); a weaker large yard lengthens it and names the bottleneck", () => {
    const e = env("1896-01");
    const base = buildWorkshopView(majestic, e);
    const slow = buildWorkshopView(majestic, {
      ...e,
      yards: e.yards.map((y) => ({
        ...y,
        capacity: Object.fromEntries(
          Object.entries(y.capacity).map(([l, n]) => [l, Math.floor(n / 2)]),
        ) as typeof y.capacity,
      })),
    });
    expect(slow.forecast.months!).toBeGreaterThan(base.forecast.months!);
    expect(slow.forecast.months!).toBeGreaterThan(slow.forecast.historicalMonths!);
    expect(slow.forecast.bottleneck).not.toBeNull();
  });
  it("gives a clear note when no fitting yard finishes the hull, and when no yard fits", () => {
    const e = env("1896-01");
    const crawl = buildWorkshopView(majestic, {
      ...e,
      yards: e.yards.map((y) => ({
        ...y,
        capacity: Object.fromEntries(
          Object.keys(y.capacity).map((l) => [l, 1]),
        ) as typeof y.capacity,
      })),
    });
    expect(crawl.forecast.months).toBeNull();
    expect(crawl.forecast.yardId).toBeNull();
    expect(crawl.forecast.note).toMatch(
      /No shipyard that can hold this hull finishes it within 120 months \(largest: yard_large\)/,
    );
    const none = buildWorkshopView(majestic, { ...e, yards: [] });
    expect(none.forecast.note).toBe("No shipyard can build this hull.");
    expect(none.forecast.months).toBeNull();
  });
});
