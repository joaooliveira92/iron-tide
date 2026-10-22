import { describe, expect, it } from "vite-plus/test";
import {
  applyEdit,
  batterySummary,
  changeKindsOf,
  compileDesign,
  EditError,
  mountNames,
  type ComponentSummary,
  type PlacementSpec,
} from "../src/index.js";
import { changeKindOf } from "../src/revision.js";
import { ctx, draft } from "./fixtures/gunboat.js";

const comp = (
  instanceId: string,
  category: ComponentSummary["category"],
  caliberUm: number,
  params: Record<string, number> = {},
  weightKg = 1_000,
): ComponentSummary =>
  ({
    instanceId,
    componentId: `c_${instanceId}`,
    category,
    weightKg,
    costMicro: 0,
    maintenanceMonthlyBp: 0,
    buildWorkMicro: null,
    productionLine: null,
    requires: [],
    params,
    attr: { caliberUm },
    torpedoMount: null,
  }) satisfies ComponentSummary;
const at = (instanceId: string, stationPermille: number, side?: PlacementSpec["side"]) => ({
  instanceId,
  stationPermille,
  ...(side ? { side } : {}),
});

describe("batterySummary", () => {
  const components = [
    comp("m1", "MAIN_GUN", 305_000, { barrels: 2, rounds: 80 }, 50_000),
    comp("m2", "MAIN_GUN", 305_000, { barrels: 2, rounds: 80 }, 50_000),
    comp("s1", "SECONDARY_GUN", 152_000, { barrels: 1, rounds: 150 }, 6_000),
    comp("s2", "DUAL_PURPOSE_GUN", 152_000, { barrels: 1, rounds: 100 }, 6_000),
    comp("t1", "TORPEDO_TUBE", 0, { tubes: 2 }, 3_000),
    comp("r1", "RANGEFINDER", 0),
  ];
  const placements = [at("m1", 700), at("m2", 200), at("s1", 400), at("s2", 300), at("t1", 500)];
  const rows = batterySummary(components, placements);

  it("groups by role and calibre, main then secondary then torpedo, ignoring other fittings", () => {
    expect(rows.map((r) => r.key)).toEqual(["MAIN:305000", "SECONDARY:152000", "TORPEDO:0"]);
  });
  it("totals mounts, barrels and weight, ordering instances bow first", () => {
    expect(rows[0]).toMatchObject({
      mounts: 2,
      barrels: 4,
      weightKg: 100_000,
      instanceIds: ["m2", "m1"],
    });
    expect(rows[1]).toMatchObject({ mounts: 2, barrels: 2, instanceIds: ["s2", "s1"] });
    expect(rows[2]).toMatchObject({ mounts: 1, barrels: 2 });
  });
  it("reports rounds per gun only when every mount agrees", () => {
    expect(rows[0]!.roundsPerGun).toBe(80);
    expect(rows[1]!.roundsPerGun).toBeNull();
    expect(rows[2]!.roundsPerGun).toBeNull();
  });
  it("is empty without weapons, and deterministic", () => {
    expect(batterySummary([comp("r1", "RANGEFINDER", 0)], [])).toEqual([]);
    expect(batterySummary(components, placements)).toEqual(rows);
  });
  it("reads a real compiled design", () => {
    const c = compileDesign(draft, ctx);
    const real = batterySummary(c.components, draft.placements);
    for (const r of real) expect(r.mounts).toBe(r.instanceIds.length);
  });
});

describe("batterySummary: tertiary guns", () => {
  it("a TERTIARY_GUN fitting is its own TERTIARY battery, ordered after secondary and before torpedo", () => {
    const rows = batterySummary(
      [
        comp("t1", "TORPEDO_TUBE", 0, { tubes: 1 }),
        comp("q1", "TERTIARY_GUN", 57_000, { barrels: 1, rounds: 200 }),
        comp("s1", "SECONDARY_GUN", 152_000, { barrels: 1, rounds: 150 }),
      ],
      [at("t1", 500), at("q1", 300), at("s1", 400)],
    );
    expect(rows.map((r) => [r.key, r.role])).toEqual([
      ["SECONDARY:152000", "SECONDARY"],
      ["TERTIARY:57000", "TERTIARY"],
      ["TORPEDO:0", "TORPEDO"],
    ]);
  });
});

describe("mountNames", () => {
  const m = (id: string, station: number, side?: PlacementSpec["side"]) => at(id, station, side);
  const names = (mounts: ReturnType<typeof m>[]) =>
    Array.from(mountNames(mounts), ([id, n]) => `${id}=${n}`).sort();
  it("names centreline mounts A, B forward and Y, X aft", () => {
    expect(names([m("a", 100), m("b", 200), m("c", 700), m("d", 800)])).toEqual([
      "a=A",
      "b=B",
      "c=X",
      "d=Y",
    ]);
  });
  it("handles one, two and three mounts", () => {
    expect(names([m("a", 100)])).toEqual(["a=A"]);
    expect(names([m("a", 100), m("b", 800)])).toEqual(["a=A", "b=Y"]);
    expect(names([m("a", 100), m("b", 200), m("c", 800)])).toEqual(["a=A", "b=B", "c=Y"]);
  });
  it("orders by station, not by input order, and breaks ties by id", () => {
    expect(names([m("z", 800), m("y", 100)])).toEqual(["y=A", "z=Y"]);
    expect(names([m("b", 300), m("a", 300)])).toEqual(["a=A", "b=Y"]);
  });
  it("names wing mounts by side and order", () => {
    expect(
      names([m("p2", 600, "PORT"), m("p1", 300, "PORT"), m("s1", 400, "STBD"), m("c", 500)]),
    ).toEqual(["c=A", "p1=Port 1", "p2=Port 2", "s1=Starboard 1"]);
  });
  it("is empty for no mounts", () => {
    expect(names([])).toEqual([]);
  });
});

describe("set_side and batch edits", () => {
  const id = draft.placements[0]!.instanceId;
  it("set_side changes only that mount's side", () => {
    const next = applyEdit(draft, { kind: "set_side", instanceId: id, side: "PORT" });
    expect(next.placements[0]!.side).toBe("PORT");
    expect(next.placements.slice(1)).toEqual(draft.placements.slice(1));
    expect(() => applyEdit(draft, { kind: "set_side", instanceId: "ghost", side: "PORT" })).toThrow(
      EditError,
    );
  });
  it("a batch applies in order as one edit and leaves the input untouched", () => {
    const before = JSON.stringify(draft);
    const next = applyEdit(draft, {
      kind: "batch",
      edits: [
        { kind: "set_side", instanceId: id, side: "STBD" },
        { kind: "remove_placement", instanceId: id },
      ],
    });
    expect(next.placements.find((p) => p.instanceId === id)).toBeUndefined();
    expect(JSON.stringify(draft)).toBe(before);
  });
  it("a failing step fails the whole batch, and an empty batch is rejected", () => {
    expect(() =>
      applyEdit(draft, {
        kind: "batch",
        edits: [
          { kind: "set_side", instanceId: id, side: "PORT" },
          { kind: "remove_placement", instanceId: "ghost" },
        ],
      }),
    ).toThrow(EditError);
    expect(() => applyEdit(draft, { kind: "batch", edits: [] })).toThrow(EditError);
  });
  it("changeKindsOf reports every distinct kind in a batch, and none for a brief", () => {
    const cat = (i: string) => (i === "gun" ? ("MAIN_GUN" as const) : undefined);
    expect(
      changeKindsOf(
        {
          kind: "batch",
          edits: [
            { kind: "set_side", instanceId: "gun", side: "PORT" },
            { kind: "set_side", instanceId: "other", side: "PORT" },
            { kind: "remove_armour_region", region: "BELT_MAIN" },
          ],
        },
        cat,
      ).sort(),
    ).toEqual(["ARMOUR", "FITTINGS", "MAIN_ARMAMENT"]);
    expect(changeKindsOf({ kind: "set_requirement", patch: { category: "CL" } }, cat)).toEqual([]);
    expect(changeKindOf({ kind: "set_side", instanceId: "gun", side: "PORT" }, cat)).toBe(
      "MAIN_ARMAMENT",
    );
  });
});
