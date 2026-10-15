// SB3-R30/R33 (DESIGN-23 sections 3-5): the read-only build-dialog preview. It must show the names the command path
// would assign, the ordering nation's dock ceiling and whether the design fits, and it must never mutate the snapshot
// or reserve anything.
import type { CampaignSnapshot, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { HULL_TYPE_FOR_SHIP_TYPE } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { CONSTRUCTION_BATCH_LIMIT_EXCEEDED, previewConstructionBatch } from "../src/index.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const MONTH = "1880-01";
const content = productionShipBuildingContent({ navalProfiles: true });

type Design = CampaignSnapshot["designs"] extends Map<string, infer D> ? D : never;

/** A UK pre-dreadnought (the B name pool) at a given displacement, with a real construction yard. */
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
    expect(r.preview).toEqual({
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

  it("reports the design as not fitting when it exceeds the dock ceiling", () => {
    const r = preview(snapshot([design("dv-b", 13_000_001)]), "dv-b", 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.dockCeilingKg).toBe(13_000_000);
    expect(r.preview.designDisplacementKg).toBe(13_000_001);
    expect(r.preview.fitsDock).toBe(false);
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

    // Deep-equal to the pre-call clone, and the same maps/lists: a preview reserves nothing and adds no project.
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
