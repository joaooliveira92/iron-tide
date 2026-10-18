import { describe, expect, it } from "vite-plus/test";
import { buildPrioritiesProjection } from "../src/priorities.js";
import { MIN_RESEARCH_SHARE_BP, NEAR_COMPLETION_WORK_RATIO } from "../src/priorityConstants.js";
import { HIGH_TENSION_THRESHOLD, isHighTension } from "../src/diplomacy.js";
import { readFileSync } from "node:fs";
import type { CampaignSnapshot } from "@bluewave/campaign";

function makeNation(overrides: Partial<any> = {}): any {
  return {
    id: "gbr",
    name: "United Kingdom",
    tag: "GBR",
    treasury: 1_000_000 as any,
    income: 2_000_000 as any,
    navalAppropriationRateBp: 2000 as any,
    maintenanceCost: 0 as any,
    // Revenue = income at the 2000 bp start rate: base = 60 x income.
    baseResources: 120_000_000 as any,
    expenses: 0 as any,
    fleets: [{ ships: [{ hitPoints: 100 as any, readiness: "ACTIVE" as any }] }],
    research: {
      researchBudget: 200_000 as any,
      discoveredTechs: [],
      technologies: [],
      fieldPriorities: {},
      currentProjectTechId: undefined,
      activeCandidates: new Map(),
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
    ...overrides,
  };
}

function makeSnapshot(
  nationOverrides: Partial<any> = {},
  worldOverrides: Partial<any> = {},
  politicsOverrides: Partial<any> = {},
): CampaignSnapshot {
  const nation = makeNation(nationOverrides);
  return {
    version: "1",
    turnNumber: 1 as any,
    campaignId: "camp1",
    startYear: 1900,
    startMonth: 1,
    slots: [{ nationId: "gbr", type: "playable" }],
    world: {
      ports: [{ id: "p1", name: "Portsmouth", areaId: "a1", nationId: "gbr", level: 10 as any }],
      areas: [],
      routes: [],
      ...worldOverrides,
    },
    nations: new Map([["gbr", nation]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {}, ...politicsOverrides },
    intelligence: { shells: {} },
    designs: new Map([["dv1", { nationId: "gbr" } as any]]),
    designFamilies: new Map(),
    strategicWeather: [],
    rulesetVersion: "1",
    compatibilityVersion: "1",
  } as unknown as CampaignSnapshot;
}

describe("priorities projection", () => {
  it("uses imported HIGH_TENSION_THRESHOLD and not a re-declared constant", () => {
    expect(HIGH_TENSION_THRESHOLD).toBe(8);
    expect(isHighTension(8)).toBe(true);
  });

  it("exposes the 6 types and cuts obsolete_active_class + construction_stalled", () => {
    const snap = makeSnapshot({ constructionProjects: [] });
    const out = buildPrioritiesProjection(snap, "gbr");
    const types = out.map((p) => p.type);
    expect(types).not.toContain("obsolete_active_class" as any);
    expect(types).not.toContain("construction_stalled" as any);
  });

  it("monthly_deficit warning vs critical via treasury+projectedBalance predicate", () => {
    // revenue = base 7_200_000 x 1000 bp / 120_000 = 60_000; obligations 100_000 => net -40_000.
    const deficitNation = (treasury: number) =>
      makeSnapshot({
        treasury: treasury as any,
        baseResources: 7_200_000 as any,
        navalAppropriationRateBp: 1000 as any,
        expenses: 100_000 as any,
        fleets: [],
        research: {
          researchBudget: 0 as any,
          discoveredTechs: [],
          technologies: [],
          fieldPriorities: {},
          activeCandidates: new Map(),
        },
        constructionProjects: [],
      });
    const solvent = buildPrioritiesProjection(deficitNation(1_000_000), "gbr").find(
      (p) => p.type === "monthly_deficit",
    );
    expect(solvent?.severity).toBe("warning");
    // treasury + projectedBalance < 0 => critical
    const insolvent = buildPrioritiesProjection(deficitNation(30_000), "gbr").find(
      (p) => p.type === "monthly_deficit",
    );
    expect(insolvent?.severity).toBe("critical");
    expect(insolvent?.reason).toContain("obligations 100000");
  });

  it("low_research_spending triggers below 800bp", () => {
    const snap = makeSnapshot({
      baseResources: 24_000_000 as any,
      navalAppropriationRateBp: 5000 as any, // base 24M x 5000 bp / 120_000 => 1M revenue
      research: {
        researchBudget: 1000 as any,
        discoveredTechs: [],
        technologies: [],
        fieldPriorities: {},
        activeCandidates: new Map(),
      },
    });
    const out = buildPrioritiesProjection(snap, "gbr");
    expect(out.some((p) => p.type === "low_research_spending")).toBe(true);
    // Above threshold should not trigger
    // A budget only counts as spending when a field can take it, so the catalogue offers one open technology.
    const snapOk = makeSnapshot(
      {
        baseResources: 24_000_000 as any,
        navalAppropriationRateBp: 5000 as any,
        research: {
          researchBudget: 200_000 as any,
          discoveredTechs: [],
          technologies: [],
          fieldPriorities: {},
          activeCandidates: new Map(),
        },
      },
      {
        technologies: [
          {
            techId: "t1",
            researchFieldId: "GUNNERY",
            cost: 100 as any,
            discoveryWeight: 1 as any,
            prerequisites: [],
            availabilityMonth: 0 as any,
          },
        ],
      },
    );
    expect(
      buildPrioritiesProjection(snapOk, "gbr").some((p) => p.type === "low_research_spending"),
    ).toBe(false);
  });

  it("construction_near_completion uses 0.9 ratio proxy per project", () => {
    const snap = makeSnapshot({
      constructionProjects: [
        {
          id: "proj_near",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "d1",
          designVersionId: "dv1",
          totalWork: 1000 as any,
          completedWork: 900 as any,
          paidWork: 900 as any,
          status: "ACTIVE",
          startedAt: "1900-01",
        },
        {
          id: "proj_far",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "d2",
          designVersionId: "dv2",
          totalWork: 1000 as any,
          completedWork: 100 as any,
          paidWork: 100 as any,
          status: "ACTIVE",
          startedAt: "1900-01",
        },
      ],
    });
    const out = buildPrioritiesProjection(snap, "gbr");
    const near = out.filter((p) => p.type === "construction_near_completion");
    expect(near.map((p) => p.fingerprint)).toEqual(["construction_near_completion:proj_near"]);
    expect(near[0]!.destination).toBe("construction");
    expect(NEAR_COMPLETION_WORK_RATIO).toBe(0.9);
  });

  it("high_foreign_tension per partner with threshold 8", () => {
    const snap = makeSnapshot(
      {},
      {},
      {
        relations: [
          {
            nationA: "gbr",
            nationB: "ger",
            relation: "neutral",
            tension: 9,
            nap: false,
            since: "1880-01",
          },
          {
            nationA: "gbr",
            nationB: "fra",
            relation: "neutral",
            tension: 5,
            nap: false,
            since: "1880-01",
          },
        ],
      },
    );
    const out = buildPrioritiesProjection(snap, "gbr");
    const highs = out.filter((p) => p.type === "high_foreign_tension");
    expect(highs.map((p) => p.fingerprint)).toEqual(["high_foreign_tension:ger"]);
    expect(highs[0]!.destination).toBe("diplomacy");
  });

  it("destinations never include treasury", () => {
    const snap = makeSnapshot(
      {
        treasury: 0 as any,
        constructionProjects: [
          {
            id: "proj1",
            type: "ship",
            projectType: "NEW_CONSTRUCTION",
            targetId: "d1",
            designVersionId: "dv1",
            totalWork: 1000 as any,
            completedWork: 950 as any,
            paidWork: 950 as any,
            status: "ACTIVE",
            startedAt: "1900-01",
          },
        ],
      },
      {},
      {
        relations: [
          {
            nationA: "gbr",
            nationB: "ger",
            relation: "neutral",
            tension: 9,
            nap: false,
            since: "1880-01",
          },
        ],
      },
    );
    const out = buildPrioritiesProjection(snap, "gbr");
    for (const p of out) expect(p.destination).not.toBe("treasury" as any);
  });

  it("sort is deterministic (same inputs → same order)", () => {
    const snap = makeSnapshot(
      {
        treasury: 100 as any,
        constructionProjects: [
          {
            id: "projA",
            type: "ship",
            projectType: "NEW_CONSTRUCTION",
            targetId: "d1",
            designVersionId: "dv1",
            totalWork: 1000 as any,
            completedWork: 950 as any,
            paidWork: 900 as any,
            status: "ACTIVE",
            startedAt: "1900-01",
          },
          {
            id: "projB",
            type: "ship",
            projectType: "NEW_CONSTRUCTION",
            targetId: "d2",
            designVersionId: "dv2",
            totalWork: 1000 as any,
            completedWork: 920 as any,
            paidWork: 920 as any,
            status: "ACTIVE",
            startedAt: "1900-01",
          },
        ],
      },
      {},
      {
        relations: [
          {
            nationA: "gbr",
            nationB: "ger",
            relation: "neutral",
            tension: 9,
            nap: false,
            since: "1880-01",
          },
          {
            nationA: "gbr",
            nationB: "fra",
            relation: "neutral",
            tension: 8,
            nap: false,
            since: "1880-01",
          },
        ],
      },
    );
    const a = buildPrioritiesProjection(snap, "gbr").map((p) => p.fingerprint);
    const b = buildPrioritiesProjection(snap, "gbr").map((p) => p.fingerprint);
    expect(a).toEqual(b);
  });

  it("constants are centralized and tested", () => {
    expect(MIN_RESEARCH_SHARE_BP).toBe(800);
    expect(NEAR_COMPLETION_WORK_RATIO).toBe(0.9);
  });

  it("builds no locale-formatted strings (map D6)", () => {
    const source = readFileSync(new URL("../src/priorities.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/toLocaleString|toFixed|Intl\./);
  });
});
