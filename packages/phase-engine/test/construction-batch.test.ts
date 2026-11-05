import type { CampaignSnapshot, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { HULL_TYPE_FOR_SHIP_TYPE, PLACEHOLDER_NAME_POOL_ID } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import {
  CONSTRUCTION_BATCH_LIMIT_EXCEEDED,
  MonthExecutor,
  placeConstructionBatch,
} from "../src/index.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const MONTH = { year: 1880, month: 1 };
const content = productionShipBuildingContent({ navalProfiles: true });

type Design = CampaignSnapshot["designs"] extends Map<string, infer D> ? D : never;

function design(id: string, displacementKg = 1_000_000, over: Partial<Design> = {}): Design {
  return {
    ...makeDesign(id, "uk"),
    hullType: HULL_TYPE_FOR_SHIP_TYPE.B,
    normalizedDisplacementKg: SafeInt(displacementKg),
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

const batch = (
  snap: CampaignSnapshot,
  designVersionId: string,
  quantity: number,
  extra: Partial<Parameters<typeof placeConstructionBatch>[1]> = {},
) =>
  placeConstructionBatch(
    snap,
    { nationId: "uk", commandId: "cmd-b1", designVersionId, quantity, month: MONTH, ...extra },
    content,
  );

describe("placeConstructionBatch orders 1..12 ships of one design (SB3-R11)", () => {
  it("orders a single ship and names it from the nation's B pool", () => {
    const r = batch(snapshot([design("dv-b")]), "dv-b", 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.projects).toHaveLength(1);
    expect(r.projects[0]).toMatchObject({
      id: "project-b1-1",
      designVersionId: "dv-b",
      shipName: "Devastation",
      namePoolId: "name_pool:uk:B",
      namePoolOrdinal: 1,
      batchId: "batch-b1",
      batchOrdinal: 1,
    });
    expect(r.namePoolExhausted).toBe(false);
    expect(r.names[0]).toEqual({ name: "Devastation", pool: "name_pool:uk:B", ordinal: 1 });
  });

  it("orders the full twelve and numbers names once the pool is exhausted", () => {
    const r = batch(snapshot([design("dv-b")]), "dv-b", 12);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.projects).toHaveLength(12);
    expect(r.namePoolExhausted).toBe(true);
    expect(r.names.slice(0, 10).map((n) => n.name)).toEqual([
      "Devastation",
      "Thunderer",
      "Dreadnought",
      "Alexandra",
      "Temeraire",
      "Colossus",
      "Collingwood",
      "Royal Sovereign",
      "Majestic",
      "Canopus",
    ]);
    expect(r.names[10]).toMatchObject({
      name: "Devastation 2",
      pool: "name_pool:uk:B",
      ordinal: 1,
    });
    expect(r.names[11]).toMatchObject({
      name: "Devastation 3",
      pool: "name_pool:uk:B",
      ordinal: 1,
    });
    for (const p of r.projects) {
      expect(p.designVersionId).toBe("dv-b");
      expect(p.batchId).toBe("batch-b1");
      expect(p.namedClassId).toBe("dv-b-family");
    }
  });

  it("rejects 13, zero and a non-integer quantity with CONSTRUCTION_BATCH_LIMIT_EXCEEDED", () => {
    const snap = snapshot([design("dv-b")]);
    for (const quantity of [13, 0, 2.5, -1]) {
      const r = batch(snap, "dv-b", quantity);
      expect(r).toMatchObject({ ok: false, reason: CONSTRUCTION_BATCH_LIMIT_EXCEEDED });
      if (r.ok) return;
      expect(r).not.toHaveProperty("snapshot");
      expect(r).not.toHaveProperty("projects");
    }
    expect(snap.nations.get("uk")!.constructionProjects).toHaveLength(0);
  });

  it("orders ships in canonical order: batch ordinal, then project id", () => {
    const r = batch(snapshot([design("dv-b")]), "dv-b", 12);
    if (!r.ok) return;
    expect(r.projects.map((p) => p.batchOrdinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(r.projects.map((p) => p.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `project-b1-${i + 1}`),
    );
  });
});

describe("the batch gate reserves the whole batch before any project exists (SB3-R12)", () => {
  it("reserves exactly the batch against the national cap and refuses the next ship", () => {
    const three = batch(snapshot([design("dv-b", 13_000_000)]), "dv-b", 3);
    expect(three.ok).toBe(true);
    if (!three.ok) return;
    const reserved = three.projects.reduce(
      (sum, p) => sum + (p.newConstructionReservedMassKg ?? 0),
      0,
    );
    expect(reserved).toBe(39_000_000);
    const four = batch(snapshot([design("dv-b", 13_000_000)]), "dv-b", 4);
    expect(four).toMatchObject({ ok: false, reason: "INSUFFICIENT_PROJECT_CAPACITY" });
    if (four.ok) return;
    expect(four).not.toHaveProperty("projects");
  });

  it("creates no project and no reservation when a gate fails", () => {
    const snap = snapshot([design("dv-b", 13_000_001)]);
    const oversized = batch(snap, "dv-b", 1);
    expect(oversized).toMatchObject({ ok: false, reason: "SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT" });
    if (oversized.ok) return;
    expect(oversized).not.toHaveProperty("snapshot");
    expect(oversized).not.toHaveProperty("projects");
    expect(snap.nations.get("uk")!.constructionProjects).toHaveLength(0);
  });

  it("fails independently on a missing nation, unknown design and a foreign design", () => {
    const snap = snapshot([design("dv-b")]);
    expect(
      placeConstructionBatch(
        snap,
        {
          nationId: "nowhere",
          commandId: "cmd-x",
          designVersionId: "dv-b",
          quantity: 1,
          month: MONTH,
        },
        content,
      ),
    ).toMatchObject({ ok: false, reason: "NATION_NOT_FOUND" });
    expect(batch(snap, "dv-missing", 1)).toMatchObject({ ok: false, reason: "UNKNOWN_DESIGN" });
    const foreign = { ...design("dv-fr"), nationId: "france" };
    expect(batch(snapshot([foreign, design("dv-b")]), "dv-fr", 1)).toMatchObject({
      ok: false,
      reason: "DESIGN_NOT_FOR_PLAYER",
    });
  });

  it("refuses a stored design whose draft no longer revalidates", () => {
    const failing = design("dv-draft", 1_000_000, { sourceDraft: {} });
    const r = batch(snapshot([failing]), "dv-draft", 1);
    expect(r).toMatchObject({ ok: false, reason: "DESIGN_REVALIDATION_FAILED" });
  });

  it("draws a placeholder name when the profile is silent for the type", () => {
    const noPool = { ...design("dv-ss", 1_000_000), hullType: "submarine" };
    const r = batch(snapshot([noPool]), "dv-ss", 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.namePoolExhausted).toBe(true);
    expect(r.names).toEqual([
      { name: "Class dv-ss 2", pool: PLACEHOLDER_NAME_POOL_ID, ordinal: 0 },
      { name: "Class dv-ss 3", pool: PLACEHOLDER_NAME_POOL_ID, ordinal: 0 },
    ]);
  });
});

describe("the batch hash is stable and deterministic (SB3-R11)", () => {
  it("hashes the same batch identically across independent calls", () => {
    const snap = snapshot([design("dv-b")]);
    const first = batch(snap, "dv-b", 5);
    const second = batch(snap, "dv-b", 5);
    if (!first.ok || !second.ok) throw new Error("batch failed");
    expect(second.batchHash).toBe(first.batchHash);
    expect(first.batchHash.length).toBe(64);
  });

  it("changes the hash when the batch changes", () => {
    const snap = snapshot([design("dv-b")]);
    const five = batch(snap, "dv-b", 5);
    const six = batch(snap, "dv-b", 6);
    if (!five.ok || !six.ok) throw new Error("batch failed");
    expect(six.batchHash).not.toBe(five.batchHash);
  });
});

describe("repeat orders and the design-study rule (SB3-R14, DESIGN-23 section 5)", () => {
  it("a repeat order of an unchanged compiled version needs no study", () => {
    const snap = snapshot([design("dv-b")]);
    const first = batch(snap, "dv-b", 2);
    expect(first.ok).toBe(true);
    const second = placeConstructionBatch(
      snap,
      {
        nationId: "uk",
        commandId: "cmd-b2",
        designVersionId: "dv-b",
        quantity: 2,
        month: MONTH,
      },
      content,
    );
    expect(second.ok).toBe(true);
  });
});

describe("a completed batch ship uses its recorded canonical name", () => {
  it("names the launched hull from the project's shipName", () => {
    const project: ConstructionProject = {
      id: "project-b1-1",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-b",
      designVersionId: "dv-b",
      totalWork: SafeInt(100),
      completedWork: SafeInt(100),
      paidWork: SafeInt(100),
      status: "ACTIVE",
      startedAt: "1880-01",
      shipName: "Devastation",
      batchId: "batch-b1",
      namedClassId: "dv-b-family",
      batchOrdinal: 1,
    };
    const snap = snapshot([design("dv-b")], [project]);
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(snap, [], "batch-seed", collector);
    expect(result.success).toBe(true);
    const ships = result.finalSnapshot.nations.get("uk")!.fleets.flatMap((f) => f.ships);
    expect(ships.some((s) => s.name === "Devastation")).toBe(true);
  });

  it("keeps the legacy fallback for a project with no recorded name", () => {
    const project: ConstructionProject = {
      id: "project-legacy-1",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-b",
      designVersionId: "dv-b",
      totalWork: SafeInt(100),
      completedWork: SafeInt(100),
      paidWork: SafeInt(100),
      status: "ACTIVE",
      startedAt: "1880-01",
    };
    const snap = snapshot([design("dv-b")], [project]);
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(snap, [], "legacy-seed", collector);
    expect(result.success).toBe(true);
    const ships = result.finalSnapshot.nations.get("uk")!.fleets.flatMap((f) => f.ships);
    expect(ships.some((s) => s.name === "Ship Class dv-b")).toBe(true);
  });

  it("gives every hull of a batch that launches in the same month a distinct id", () => {
    const base: Omit<ConstructionProject, "id" | "shipName" | "batchOrdinal"> = {
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-b",
      designVersionId: "dv-b",
      totalWork: SafeInt(100),
      completedWork: SafeInt(100),
      paidWork: SafeInt(100),
      status: "ACTIVE",
      startedAt: "1880-01",
      batchId: "batch-b1",
      namedClassId: "dv-b-family",
    };
    const snap = snapshot(
      [design("dv-b")],
      [
        { ...base, id: "project-b1-1", shipName: "Devastation", batchOrdinal: 1 },
        { ...base, id: "project-b1-2", shipName: "Thunderer", batchOrdinal: 2 },
      ],
    );
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(snap, [], "batch-seed", collector);
    expect(result.success).toBe(true);
    const launched = result.finalSnapshot.nations
      .get("uk")!
      .fleets.flatMap((f) => f.ships)
      .filter((s) => s.name === "Devastation" || s.name === "Thunderer");
    expect(launched).toHaveLength(2);
    expect(new Set(launched.map((s) => s.id)).size).toBe(2);
  });
});
