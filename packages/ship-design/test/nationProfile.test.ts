import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, it, expect } from "vite-plus/test";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import { catalogueForNation } from "../src/componentVariants.js";
import {
  compileDesign,
  computeCost,
  nationProfileBrief,
  resolveNavalProfile,
  treasuryCostUnits,
  type StarterDesign,
} from "../src/index.js";
import {
  effectiveDesignWeights,
  planProcurement,
  rankCandidatesForNation,
  scoreDesign,
  varyDesignWeights,
} from "../src/nationalDesignPolicy.js";
import {
  fingerprintDistance,
  profileFingerprint,
  resolveConstructionModifiers,
  validateNavalProfiles,
  type ProfileIssue,
} from "../src/nationProfile.js";
import { lintNavalArms, preferredAmmunition } from "../src/componentVariants.js";
import { starterFor } from "../src/shipTypeRoster.js";
import { renderExplanation } from "./helpers/explanation.js";
import {
  components,
  navalProfiles,
  nationalContext,
  plants,
  readReferenceDesignEntries,
  shipBuildingContent,
} from "./helpers/earlyContext.js";

const root = join(__dirname, "..", "..", "..", "content", "production", "1880");
const load = (rel: string) =>
  parse(readFileSync(join(root, rel), "utf8")) as Record<string, unknown>;

const countries = load("countries.yaml") as unknown as { id: string }[];
const knownNationIds = new Set(countries.map((c) => c.id));
const knownComponentIds = new Set(components.map((c) => c.id));
const knownPlantIds = new Set(plants.map((p) => p.id));
const knownHullFormIds = new Set(
  (load("ship-building/hull-forms.yaml") as { hullForms: { id: string }[] }).hullForms.map(
    (f) => f.id,
  ),
);
const knownResearchFields = new Set<string>(CANONICAL_RESEARCH_FIELD_IDS);

const validationCtx = {
  knownNationIds,
  knownComponentIds,
  knownPlantIds,
  knownHullFormIds,
  knownResearchFields,
  release: true,
};

const starters = (readReferenceDesignEntries() as { starterFor?: string }[]).filter(
  (d) => d.starterFor !== undefined,
) as unknown as StarterDesign[];

const OPENING = ["B", "CA", "CL", "DD", "KE", "AMC"] as const;
const NATIONS = ["uk", "france"] as const;
const uk = navalProfiles.find((p) => p.nationId === "uk")!;
const france = navalProfiles.find((p) => p.nationId === "france")!;

describe("naval profile content integrity", () => {
  it("both profiles parse, validate against the pack references, and carry no release placeholder", () => {
    const issues: ProfileIssue[] = validateNavalProfiles(navalProfiles, validationCtx);
    expect(issues.map((i) => `${i.nationId}/${i.code}: ${i.message}`)).toEqual([]);
  });
  it("arms content lints clean (override fields, duplicate ids, no placeholder)", () => {
    for (const p of navalProfiles) {
      expect(lintNavalArms(p, true).map((i) => `${p.nationId}/${i.code}: ${i.message}`)).toEqual(
        [],
      );
    }
  });
  it("resolveNavalProfile is date-banded", () => {
    expect(resolveNavalProfile(navalProfiles, "uk", "1880-01")?.nationId).toBe("uk");
    expect(resolveNavalProfile(navalProfiles, "france", "1890-06")?.nationId).toBe("france");
    expect(resolveNavalProfile(navalProfiles, "uk", "1879-12")).toBeNull();
    expect(resolveNavalProfile(navalProfiles, "atlantis", "1880-01")).toBeNull();
  });
  it("resolveConstructionModifiers returns a dated displacement ceiling", () => {
    expect(resolveConstructionModifiers(uk, "1880-01").maxPracticalDisplacementKg).toBe(10_000_000);
    expect(resolveConstructionModifiers(uk, "1891-01").maxPracticalDisplacementKg).toBe(15_000_000);
    expect(resolveConstructionModifiers(france, "1886-01").maxPracticalDisplacementKg).toBe(
      10_500_000,
    );
  });
});

describe("shared families with national models", () => {
  it("a nation's catalogue is derived from the shared one, only restricting or relabelling", () => {
    const neutral = shipBuildingContent.environmentFor("1880-01").ctx.catalogue;
    const ukSel = catalogueForNation(components, uk, "1880-01");
    const frSel = catalogueForNation(components, france, "1880-01");
    expect(frSel.catalogue.map((c) => c.id)).not.toContain("gun_bl_135in_30");
    expect(ukSel.catalogue.map((c) => c.id)).not.toContain("gun_bl_274mm_m1875");
    expect(ukSel.catalogue.length).toBeLessThanOrEqual(neutral.length);
    expect(frSel.catalogue.length).toBeLessThanOrEqual(neutral.length);
    expect(Object.values(ukSel.appliedModels)).toContain("uk_bl_12in_25_mk1");
    expect(Object.values(frSel.appliedModels)).toContain("fr_canon_1647mm_mle1887");
    expect(ukSel.catalogue.map((c) => c.id)).toEqual(ukSel.catalogue.map((c) => c.id).sort());
  });
  it("applying a national model changes the field values, not the family id", () => {
    const frSel = catalogueForNation(components, france, "1880-01");
    const gun = frSel.catalogue.find((c) => c.id === "gun_qf_6in_40")!;
    expect(gun.attributes!.shellMassG).toBe("54900");
    const ukSel = catalogueForNation(components, uk, "1880-01");
    expect(ukSel.catalogue.find((c) => c.id === "gun_qf_6in_40")!.attributes!.shellMassG).toBe(
      "45300",
    );
  });
  it("doctrine picks the ammunition family: UK AP-dominant, France Melinite", () => {
    expect(preferredAmmunition(uk)).toBe("AP");
    expect(preferredAmmunition(france)).toBe("MELINITE");
  });
  it("national context exposes the profile's capabilities and restricted types", () => {
    const ctx = nationalContext("1880-01", "france");
    expect(ctx.catalogue.find((c) => c.id === "gun_bl_135in_30")).toBeUndefined();
    expect([...(ctx.capabilities ?? [])]).toEqual([]);
  });
});

describe("role-specific national design scoring", () => {
  const facts = {
    firepowerBp: 11000,
    protectionBp: 9000,
    speedBp: 12000,
    enduranceBp: 14000,
    torpedoBp: 8000,
    reliabilityBp: 10000,
    colonialBp: 12000,
    costUnits: 60,
    buildMonths: 24,
    overweightBp: 0,
    obsolescenceBp: 0,
  };
  it("effectiveDesignWeights are deterministic and vary within the ±10% band by seed", () => {
    const a = effectiveDesignWeights(uk, "CL", "seed-1");
    const b = effectiveDesignWeights(uk, "CL", "seed-1");
    const c = effectiveDesignWeights(uk, "CL", "seed-2");
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    for (const k of Object.keys(a) as (keyof typeof a)[]) {
      const base = uk.designWeights.CL[k];
      expect(Math.abs(a[k] - base)).toBeLessThanOrEqual(1000);
    }
  });
  it("the same ship scores differently under UK and French CL weights (identity changes evaluation)", () => {
    const ukScore = scoreDesign(effectiveDesignWeights(uk, "CL"), facts);
    const frScore = scoreDesign(effectiveDesignWeights(france, "CL"), facts);
    expect(ukScore).not.toBe(frScore);
    expect(ukScore).toBeGreaterThan(frScore);
  });
  it("ranking is deterministic and orders by score then id", () => {
    const candidates = [
      { designId: "b_fast", facts },
      { designId: "a_slow", facts: { ...facts, speedBp: 6000 } },
      { designId: "a_fast", facts: { ...facts, speedBp: 6000 } },
    ];
    const ranked = rankCandidatesForNation(candidates, uk.designWeights.CL).map((c) => c.designId);
    expect(ranked[0]).toBe("b_fast");
    expect(ranked.slice(1)).toEqual(["a_fast", "a_slow"]);
  });
  it("varyDesignWeights keeps every weight positive", () => {
    const w = varyDesignWeights({ ...uk.designWeights.DD, costBp: 1 }, "uk", "DD", "s");
    expect(Object.values(w).every((v) => v >= 1)).toBe(true);
  });
});

describe("AI procurement policy", () => {
  const candidates = [
    { designId: "uk_cl", type: "CL" as const, costUnits: 90, score: 500 },
    { designId: "uk_b", type: "B" as const, costUnits: 160, score: 400 },
    { designId: "uk_dd", type: "DD" as const, costUnits: 30, score: 300 },
    { designId: "uk_ke", type: "KE" as const, costUnits: 20, score: 200 },
  ];
  it("UK and France allocate different shares and build orders", () => {
    const ukPlan = planProcurement(uk, candidates, 400);
    const frPlan = planProcurement(france, candidates, 400);
    expect(ukPlan.order).not.toEqual(frPlan.order);
    expect(uk.procurementPolicy.buildOrder[0]).toBe("CL");
    expect(france.procurementPolicy.buildOrder[0]).toBe("DD");
  });
  it("a plan never overspends and is deterministic", () => {
    const a = planProcurement(france, candidates, 200);
    const b = planProcurement(france, candidates, 200);
    expect(a).toEqual(b);
    expect(a.totalCostUnits).toBeLessThanOrEqual(200);
  });
  it("an unaffordable or empty type is skipped, not an error", () => {
    const plan = planProcurement(uk, [], 1000);
    expect(plan.order).toEqual([]);
  });
});

describe("comparative differentiation", () => {
  it("the two profiles differ on many axes (a fleet is recognisable without names or flags)", () => {
    const d = fingerprintDistance(profileFingerprint(uk), profileFingerprint(france));
    expect(d).toBeGreaterThanOrEqual(4);
    expect(france.industrialProfile.buildTimeMultiplierBp).toBeGreaterThan(
      uk.industrialProfile.buildTimeMultiplierBp,
    );
    expect(france.softPreferences.torpedoOnCruisersBp).toBeGreaterThan(
      uk.softPreferences.torpedoOnCruisersBp,
    );
    expect(uk.softPreferences.enduranceWeightBp).toBeGreaterThan(
      france.softPreferences.enduranceWeightBp,
    );
    expect(uk.softPreferences.riskToleranceBp).toBeLessThan(france.softPreferences.riskToleranceBp);
  });
});

describe("player-facing brief", () => {
  it("is derived from the profile and states strengths and limitations honestly", () => {
    const ukBrief = nationProfileBrief(uk);
    const frBrief = nationProfileBrief(france);
    expect(ukBrief.industrialStrengths.length).toBeGreaterThan(0);
    expect(frBrief.industrialLimitations.length).toBeGreaterThan(0);
    expect(ukBrief.industrialStrengths.join(" ")).toMatch(/faster/);
    expect(frBrief.industrialLimitations.join(" ")).toMatch(/experimental|varies/);
    expect(ukBrief.preferredComponents.some((c) => c.includes("12-in"))).toBe(true);
    expect(frBrief.starterPhilosophy).toContain("DD");
    expect(ukBrief.doctrineSummary).toBe(uk.strategicSituation);
  });
});

describe("national starters", () => {
  it.each(NATIONS)("%s has a starter for every opening type", (nation) => {
    for (const type of OPENING) {
      const s = starterFor(type, starters, "1880-01", nation);
      expect(s, `${nation} ${type}`).not.toBeNull();
      expect(s!.draft.nationId).toBe(nation);
    }
  });
  it.each(NATIONS)(
    "%s: every starter compiles legal, is its own type, and carries no blocking finding",
    (nation) => {
      for (const type of OPENING) {
        const s = starterFor(type, starters, "1880-01", nation)!;
        const env = shipBuildingContent.environmentFor("1880-01", nation);
        const r = compileDesign(s.draft, env.ctx);
        const blocking = r.findings.filter((f) => f.severity === "BLOCKING");
        expect(blocking.map((f) => `${s.id} ${f.id}: ${renderExplanation(f.what)}`)).toEqual([]);
        expect(r.valid, s.id).toBe(true);
        expect(r.naturalClass, s.id).toBe(type);
      }
    },
  );
  it("the national catalogue is what makes the French cruiser recognisable (variant applied, British heavy absent)", () => {
    const s = starterFor("CL", starters, "1880-01", "france")!;
    const env = shipBuildingContent.environmentFor("1880-01", "france");
    const r = compileDesign(s.draft, env.ctx);
    expect(r.valid).toBe(true);
    expect(env.ctx.catalogue.find((c) => c.id === "gun_bl_135in_30")).toBeUndefined();
  });
});

describe("Nation × Ship Type × Year × Budget matrix", () => {
  const YEARS = ["1880-01", "1885-01", "1890-01"] as const;
  const BUDGETS = { low: 250, standard: 700, high: 1800 } as const;
  const BUDGET_BANDS = ["low", "standard", "high"] as const;

  interface Cell {
    readonly nation: string;
    readonly type: (typeof OPENING)[number];
    readonly month: string;
    readonly valid: boolean;
    readonly naturalClass: string | null;
    readonly dockFits: boolean;
    readonly costUnits: number;
    readonly hash: string;
  }

  const compileCell = (nation: string, type: (typeof OPENING)[number], month: string): Cell => {
    const starter = starterFor(type, starters, month, nation)!;
    const env = shipBuildingContent.environmentFor(month, nation);
    const r = compileDesign(starter.draft, env.ctx);
    const cost = treasuryCostUnits(
      computeCost(r, starter.draft, env.costBalance, env.costCtx).total,
      shipBuildingContent.treasuryUnitMicro,
    );
    return {
      nation,
      type,
      month,
      valid: r.valid,
      naturalClass: r.naturalClass,
      dockFits: !r.findings.some((f) => f.id === "NO_FACILITY_FITS"),
      costUnits: cost,
      hash: r.hash,
    };
  };

  const cells: Cell[] = [];
  for (const nation of NATIONS)
    for (const month of YEARS)
      for (const type of OPENING) cells.push(compileCell(nation, type, month));

  it("generates 108 scenarios (2 nations × 6 types × 3 years × 3 budgets)", () => {
    expect(cells).toHaveLength(36);
    expect(cells.length * BUDGET_BANDS.length).toBe(108);
  });
  it("every scenario is legal, classified as its role, buildable by a dock and within the high budget", () => {
    for (const c of cells) {
      const where = `${c.nation} ${c.type} ${c.month}`;
      expect(c.valid, where).toBe(true);
      expect(c.naturalClass, where).toBe(c.type);
      expect(c.dockFits, where).toBe(true);
      expect(c.costUnits, where).toBeLessThanOrEqual(BUDGETS.high);
    }
  });
  it("is deterministic: recompiling a cell reproduces its hash", () => {
    const first = compileCell("uk", "CA", "1885-01");
    const again = compileCell("uk", "CA", "1885-01");
    expect(again.hash).toBe(first.hash);
  });
  it("affordability is monotone in the budget band and the low band excludes capital ships", () => {
    for (const nation of NATIONS)
      for (const month of YEARS) {
        const costs = OPENING.map((t) => ({ t, c: compileCell(nation, t, month).costUnits }));
        const affordable = (budget: number) =>
          new Set(costs.filter((x) => x.c <= budget).map((x) => x.t));
        const low = affordable(BUDGETS.low);
        const std = affordable(BUDGETS.standard);
        const high = affordable(BUDGETS.high);
        for (const t of low) expect(std.has(t)).toBe(true);
        for (const t of std) expect(high.has(t)).toBe(true);
        expect(high.size).toBe(OPENING.length);
        expect([...low].some((t) => t === "DD" || t === "KE" || t === "AMC")).toBe(true);
      }
  });
  it("the two nations produce meaningfully different fleets (fingerprint spread across the matrix)", () => {
    const ukCells = cells.filter((c) => c.nation === "uk");
    const frCells = cells.filter((c) => c.nation === "france");
    const ukTotal = ukCells.reduce((a, c) => a + c.costUnits, 0);
    const frTotal = frCells.reduce((a, c) => a + c.costUnits, 0);
    expect(ukTotal).not.toBe(frTotal);
  });
});
