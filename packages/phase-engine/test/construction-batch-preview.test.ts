import type { CampaignSnapshot, ConstructionProject, DesignStudy } from "@bluewave/campaign";
import { SafeInt, bp, money } from "@bluewave/contracts";
import { HULL_TYPE_FOR_SHIP_TYPE } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import {
  CONSTRUCTION_BATCH_LIMIT_EXCEEDED,
  placeConstructionBatch,
  previewConstructionBatch,
} from "../src/index.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const MONTH = "1880-01";
const content = productionShipBuildingContent({ navalProfiles: true });

type Design = CampaignSnapshot["designs"] extends Map<string, infer D> ? D : never;

function design(id: string, displacementKg = 1_000_000, over: Partial<Design> = {}): Design {
  return {
    ...makeDesign(id, "uk"),
    hullType: HULL_TYPE_FOR_SHIP_TYPE.B,
    normalizedDisplacementKg: SafeInt(displacementKg),
    constructionPlan: { yardId: "yard-uk-1", packages: [], capacityUnits: {} },
    ...over,
  };
}

function snapshot(
  designs: readonly Design[],
  projects: ConstructionProject[] = [],
): CampaignSnapshot {
  const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
  const uk = {
    ...makeNation("uk", []),
    isPlayable: true,
    isAI: false,
    constructionProjects: projects,
  };
  return {
    ...base,
    nations: new Map([["uk", uk]]),
    designs: new Map(designs.map((d) => [d.designVersionId, d])),
  } as CampaignSnapshot;
}

const preview = (snap: CampaignSnapshot, designVersionId: string, quantity: number) =>
  previewConstructionBatch(snap, "uk", designVersionId, quantity, content, MONTH);

describe("previewConstructionBatch shows names and dock fit without reserving (SB3-R30/R33)", () => {
  it("returns the names the command path would assign, the dock ceiling and the fit", () => {
    const r = preview(snapshot([design("dv-b")]), "dv-b", 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview).toMatchObject({
      designVersionId: "dv-b",
      quantity: 1,
      names: [{ name: "Devastation", pool: "name_pool:uk:B", ordinal: 1 }],
      namePoolExhausted: false,
      dockCeilingKg: 13_000_000,
      designDisplacementKg: 1_000_000,
      fitsDock: true,
      yardId: "yard-uk-1",
    });
  });

  it("previews the full twelve and flags the name pool exhausted", () => {
    const r = preview(snapshot([design("dv-b")]), "dv-b", 12);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.names).toHaveLength(12);
    expect(r.preview.namePoolExhausted).toBe(true);
    expect(r.preview.names[0]).toMatchObject({ name: "Devastation" });
    expect(r.preview.names[10]).toMatchObject({ name: "Devastation 2" });
  });

  it("refuses a design that exceeds the dock ceiling, as the order would", () => {
    const r = preview(snapshot([design("dv-b", 13_000_001)]), "dv-b", 1);
    expect(r).toMatchObject({ ok: false, reason: "SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT" });
  });

  it("reports fitsDock false with an honest null ceiling when the dock cannot be resolved", () => {
    const noProfiles = productionShipBuildingContent();
    const r = previewConstructionBatch(
      snapshot([design("dv-b")]),
      "uk",
      "dv-b",
      1,
      noProfiles,
      MONTH,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.dockCeilingKg).toBeNull();
    expect(r.preview.fitsDock).toBe(false);
  });

  it("refuses 0 and 13 with CONSTRUCTION_BATCH_LIMIT_EXCEEDED", () => {
    for (const quantity of [0, 13, -1, 2.5]) {
      const r = preview(snapshot([design("dv-b")]), "dv-b", quantity);
      expect(r).toMatchObject({ ok: false, reason: CONSTRUCTION_BATCH_LIMIT_EXCEEDED });
      if (r.ok) return;
      expect(r).not.toHaveProperty("preview");
    }
  });

  it("fails on a missing nation, unknown design and a foreign design", () => {
    const snap = snapshot([design("dv-b")]);
    expect(previewConstructionBatch(snap, "nowhere", "dv-b", 1, content, MONTH)).toMatchObject({
      ok: false,
      reason: "NATION_NOT_FOUND",
    });
    expect(preview(snap, "dv-missing", 1)).toMatchObject({ ok: false, reason: "UNKNOWN_DESIGN" });
    const foreign = { ...design("dv-fr"), nationId: "france" };
    expect(preview(snapshot([foreign, design("dv-b")]), "dv-fr", 1)).toMatchObject({
      ok: false,
      reason: "DESIGN_NOT_FOR_PLAYER",
    });
  });

  it("does not mutate the snapshot or reserve capacity", () => {
    const projects: ConstructionProject[] = [];
    const snap = snapshot([design("dv-b")], projects);
    const before = structuredClone(snap) as CampaignSnapshot;
    const nationsBefore = snap.nations;
    const designsBefore = snap.designs;
    const projectsBefore = snap.nations.get("uk")!.constructionProjects;

    const r = preview(snap, "dv-b", 12);
    expect(r.ok).toBe(true);

    expect(snap).toEqual(before);
    expect(snap.nations).toBe(nationsBefore);
    expect(snap.designs).toBe(designsBefore);
    expect(snap.nations.get("uk")!.constructionProjects).toBe(projectsBefore);
    expect(snap.nations.get("uk")!.constructionProjects).toHaveLength(0);
  });

  it("is deterministic across independent calls", () => {
    const snap = snapshot([design("dv-b")]);
    const first = preview(snap, "dv-b", 5);
    const second = preview(snap, "dv-b", 5);
    expect(second).toEqual(first);
  });
});

describe("previewConstructionBatch quotes what placeConstructionBatch will place (#580)", () => {
  const priced = (id: string) => design(id, 1_000_000, { constructionCostUnits: SafeInt(1_200) });
  const place = (snap: CampaignSnapshot, quantity: number) =>
    placeConstructionBatch(
      snap,
      {
        nationId: "uk",
        commandId: "cmd-q",
        designVersionId: "dv-b",
        quantity,
        month: { month: 1, year: 1880 },
      },
      content,
    );

  it.each([1, 3, 12])("quotes %i ships at the placed projects' cost and months", (quantity) => {
    const snap = snapshot([priced("dv-b")]);
    const quoted = preview(snap, "dv-b", quantity);
    const placed = place(snap, quantity);
    expect(quoted.ok && placed.ok).toBe(true);
    if (!quoted.ok || !placed.ok) return;
    const quote = quoted.preview.quote;
    const unit = Number(placed.projects[0]!.totalWork);
    const months = placed.projects[0]!.buildMonths;
    expect(quote.unitPrice).toBe(unit);
    expect(quote.totalPrice).toBe(placed.projects.reduce((sum, p) => sum + Number(p.totalWork), 0));
    expect(quote.buildMonths).toBe(months);
    expect(quote.monthlyInstalment).toBe(Math.floor(unit / (months ?? 1)) * quantity);
    const index = 1880 * 12 + (months ?? 0);
    expect(quote.deliveryMonth).toBe(
      `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, "0")}`,
    );
  });

  it("refuses what placement refuses, with the same reason", () => {
    const crowded = snapshot([priced("dv-b")]);
    for (const quantity of [1, 12]) {
      const quoted = preview(crowded, "dv-b", quantity);
      const placed = place(crowded, quantity);
      expect(quoted.ok).toBe(placed.ok);
      if (!quoted.ok && !placed.ok) expect(quoted.reason).toBe(placed.reason);
    }
  });
});

describe("a design whose study is still open", () => {
  it("is refused with DESIGN_STUDY_IN_PROGRESS rather than UNKNOWN_DESIGN", () => {
    const snap = snapshot([]);
    const uk = snap.nations.get("uk")!;
    const study: DesignStudy = {
      designStudyId: "study_dv-study",
      nationId: "uk",
      builderContext: "NATIONAL",
      baselineDesignVersionId: "NONE",
      designFamilyId: "",
      newFamily: true,
      derived: false,
      failedCriteria: [],
      baseStudyWork: 3,
      baseStudyCost: money(300),
      discountBp: bp(0),
      finalStudyWork: 3,
      finalStudyCost: money(300),
      workDone: 0,
      costPaid: money(0),
      status: "IN_PROGRESS",
      startMonth: MONTH,
      completionMonth: null,
      rulesetVersion: "test",
      formulaVersion: "design_study_v1",
      projectHash: "hash",
      design: makeDesign("dv-study", "uk"),
    };
    const withStudy: CampaignSnapshot = {
      ...snap,
      nations: new Map([["uk", { ...uk, designStudies: [study] }]]),
    };
    expect(preview(withStudy, "dv-study", 1)).toMatchObject({
      ok: false,
      reason: "DESIGN_STUDY_IN_PROGRESS",
    });
  });
});
