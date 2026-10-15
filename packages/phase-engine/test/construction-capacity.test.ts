// SB3-R18/R19 (DESIGN-16 sections 7-9): the national concurrency cap is enforced at order time and is kept strictly
// separate from the work-micro-unit pools. Exemptions never create capacity from nothing.
import type { CampaignSnapshot, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { HULL_TYPE_FOR_SHIP_TYPE, constructionPoolForProjectKind } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { placeConstructionOrder } from "../src/index.js";
import { committedNewConstructionMassKg, nationalConstructionCapacity } from "../src/index.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const MONTH = { year: 1880, month: 1 };
const profileContent = productionShipBuildingContent({ navalProfiles: true });
const UK_DOCK = 13_000_000;

type Design = CampaignSnapshot["designs"] extends Map<string, infer D> ? D : never;

const design = (id: string, hullType: string, displacementKg: number): Design => ({
  ...makeDesign(id, "uk"),
  hullType,
  normalizedDisplacementKg: SafeInt(displacementKg),
});

function snapshot(designs: readonly Design[], projects: ConstructionProject[] = []) {
  const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
  const uk = { ...makeNation("uk", []), constructionProjects: projects };
  return {
    ...base,
    nations: new Map([["uk", uk]]),
    designs: new Map(designs.map((d) => [d.designVersionId, d])),
  } as CampaignSnapshot;
}

const order = (
  snap: CampaignSnapshot,
  designVersionId: string,
  commandId: string,
  content = profileContent,
) =>
  placeConstructionOrder(
    snap,
    { nationId: "uk", commandId, designVersionId, month: MONTH },
    content,
  );

/** Content whose balance is overridden, so exemption boundaries can be exercised without a huge order loop. */
function withCapacityBalance(overrides: {
  shipyardCapacityMultipleBp?: number;
  amcCapacityExemptionBp?: number;
  smallCorvetteMaxDisplacementKg?: number;
}) {
  const base = profileContent;
  return {
    ...base,
    environmentFor: (month: string, nationId?: string) => {
      const env = base.environmentFor(month, nationId);
      return { ...env, constructionBalance: { ...env.constructionBalance, ...overrides } };
    },
  };
}

describe("the national concurrency cap gates order-time reservation (SB3-R18)", () => {
  it("reserves the design's displacement and persists it on the project", () => {
    const snap = snapshot([design("dv-b", "pre_dreadnought", 5_000_000)]);
    const r = order(snap, "dv-b", "c1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.newConstructionReservedMassKg).toBe(5_000_000);
  });

  it("accepts an order that lands exactly on the cap and refuses the next one", () => {
    const snap = snapshot([design("dv-b", "pre_dreadnought", UK_DOCK)]);
    let current = snap;
    for (const id of ["c1", "c2", "c3"]) {
      const r = order(current, "dv-b", id);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      current = r.snapshot;
    }
    // 3 x 13,000,000 == cap 39,000,000: exactly at the cap is allowed.
    const fourth = order(current, "dv-b", "c4");
    expect(fourth).toMatchObject({ ok: false, reason: "INSUFFICIENT_PROJECT_CAPACITY" });
  });

  it("skips the cap when there is no content or dock (nation-neutral order)", () => {
    const snap = snapshot([design("dv-b", "pre_dreadnought", UK_DOCK)]);
    // No content means no dock and no balance: the order path keeps its nation-neutral behaviour.
    const r = placeConstructionOrder(
      snap,
      { nationId: "uk", commandId: "c1", designVersionId: "dv-b", month: MONTH },
      undefined,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.newConstructionReservedMassKg).toBeUndefined();
  });
});

describe("pool inclusions and exclusions (SB3-R19)", () => {
  it("a rebuild books to REFIT_REBUILD and never counts against the new-construction cap", () => {
    expect(constructionPoolForProjectKind("REBUILD")).toBe("REFIT_REBUILD");
    const rebuild: ConstructionProject = {
      id: "con_rebuild",
      type: "ship",
      projectType: "REBUILD",
      targetShipId: "s1",
      targetId: "dv-b",
      designVersionId: "dv-b",
      totalWork: SafeInt(100),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "ACTIVE",
      startedAt: "1880-01",
      newConstructionReservedMassKg: 999_999_999,
    };
    const snap = snapshot([design("dv-b", "pre_dreadnought", UK_DOCK)], [rebuild]);
    const r = order(snap, "dv-b", "c1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Only the new order's own reservation counts; the rebuild's huge reservation is ignored.
    const orders = r.snapshot.nations
      .get("uk")!
      .constructionProjects.filter((p) => p.projectType === "NEW_CONSTRUCTION");
    expect(orders).toHaveLength(1);
    expect(orders[0]!.newConstructionReservedMassKg).toBe(UK_DOCK);
  });

  it("a submarine books to NEW_CONSTRUCTION and counts against the cap", () => {
    expect(constructionPoolForProjectKind("NEW_CONSTRUCTION")).toBe("NEW_CONSTRUCTION");
    const snap = snapshot([design("dv-ss", "submarine", UK_DOCK)]);
    let current = snap;
    for (const id of ["c1", "c2", "c3"]) {
      const r = order(current, "dv-ss", id);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      current = r.snapshot;
    }
    expect(order(current, "dv-ss", "c4")).toMatchObject({
      ok: false,
      reason: "INSUFFICIENT_PROJECT_CAPACITY",
    });
  });

  it("an AMC exempts 80 % of its displacement and reserves the remaining 20 %", () => {
    const amc = design("dv-amc", HULL_TYPE_FOR_SHIP_TYPE.AMC, 10_000_000);
    const r = order(snapshot([amc]), "dv-amc", "c1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.newConstructionReservedMassKg).toBe(2_000_000); // ceil(10,000,000 * 2,000 / 10,000)
  });

  it("a small corvette reserves the non-exempt share, and one over the threshold reserves all of it", () => {
    const small = design("dv-ke", HULL_TYPE_FOR_SHIP_TYPE.KE, 1_000_000);
    const big = design("dv-ke-big", HULL_TYPE_FOR_SHIP_TYPE.KE, 1_000_001);
    const r = order(snapshot([small]), "dv-ke", "c1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.newConstructionReservedMassKg).toBe(200_000); // 20 % of 1,000,000
    const rBig = order(snapshot([big]), "dv-ke-big", "c2");
    expect(rBig.ok).toBe(true);
    if (!rBig.ok) return;
    expect(rBig.project.newConstructionReservedMassKg).toBe(1_000_001); // not exempt
  });

  it("a fully exempt ship consumes no normal capacity, and the external source carries the rest", () => {
    const exemptContent = withCapacityBalance({ amcCapacityExemptionBp: 10_000 });
    const r = order(
      snapshot([design("dv-amc", HULL_TYPE_FOR_SHIP_TYPE.AMC, 10_000_000)]),
      "dv-amc",
      "c1",
      exemptContent,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.newConstructionReservedMassKg).toBe(0);
  });
});

describe("exemption reduces the tonnage reserved from the cap (SB3-R18/R19)", () => {
  it("fifteen 13,000 t corvettes land exactly on the cap because each reserves only 20 %", () => {
    // Raise the small-corvette threshold so a dock-sized corvette still qualifies.
    const content = withCapacityBalance({ smallCorvetteMaxDisplacementKg: UK_DOCK });
    const snap = snapshot([design("dv-ke", HULL_TYPE_FOR_SHIP_TYPE.KE, UK_DOCK)]);
    let current = snap;
    for (let i = 0; i < 15; i++) {
      const r = order(current, "dv-ke", `c${i}`, content);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.project.newConstructionReservedMassKg).toBe(2_600_000); // 20 % of 13,000,000
      current = r.snapshot;
    }
    expect(order(current, "dv-ke", "c-extra", content)).toMatchObject({
      ok: false,
      reason: "INSUFFICIENT_PROJECT_CAPACITY",
    });
  });
});

describe("reservation accounting is deterministic", () => {
  const project = (id: string, massKg: number): ConstructionProject => ({
    id,
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: id,
    designVersionId: "dv-b",
    totalWork: SafeInt(1),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status: "ACTIVE",
    startedAt: "1880-01",
    newConstructionReservedMassKg: massKg,
  });

  it("the committed mass does not depend on the projects' insertion order", () => {
    const a = snapshot(
      [design("dv-b", "pre_dreadnought", 1)],
      [project("con_b", 20), project("con_a", 10)],
    );
    const b = snapshot(
      [design("dv-b", "pre_dreadnought", 1)],
      [project("con_a", 10), project("con_b", 20)],
    );
    const balance = profileContent.environmentFor("1880-01").constructionBalance;
    const capacity = nationalConstructionCapacity(balance, UK_DOCK);
    expect(committedNewConstructionMassKg(a, "uk", capacity)).toBe(30);
    expect(committedNewConstructionMassKg(b, "uk", capacity)).toBe(30);
  });
});
