import type { PartCatalogueEntry, PlacementSpec } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import {
  fittingPoint,
  PLAN_H,
  PLAN_MID,
  PLAN_PAD,
  PLAN_W,
  planFrame,
  stationX,
} from "./geometry.js";
import {
  CENTRE_BAND,
  clientToPlan,
  fittingAt,
  GRAB_RADIUS,
  hasSide,
  moveEdit,
  nextInstanceId,
  nudgeEdit,
  placeEdit,
  planTarget,
  sideAtY,
  stationAtX,
  zoneAtStation,
} from "./placement-tools.js";

const zones = [
  { id: "FORECASTLE", startPermille: 0, endPermille: 100 },
  { id: "FWD_SERVICE", startPermille: 100, endPermille: 500 },
  { id: "AFT_SERVICE", startPermille: 500, endPermille: 1000 },
  { id: "MISSION", startPermille: 300, endPermille: 1000 },
];
const def = (over: Partial<PartCatalogueEntry>): PartCatalogueEntry => ({
  id: "gun_a",
  displayName: "Gun A",
  category: "MAIN_GUN",
  introduction: { fromMonth: "1880-01", obsoleteMonth: null },
  requires: [],
  tags: [],
  fcClass: null,
  parameters: {},
  entryUnits: null,
  rounds: null,
  ...over,
});
const placement = (over: Partial<PlacementSpec> = {}): PlacementSpec => ({
  instanceId: "gun_a_1",
  componentId: "gun_a",
  zoneId: "FWD_SERVICE",
  stationPermille: 200,
  ...over,
});
const frame = planFrame({ lengthWl: 100_000, beam: 14_000 } as never);

describe("stationAtX", () => {
  it("inverts stationX on the snap grid, at the ends and clamped outside", () => {
    for (const s of [0, 100, 250, 500, 1000]) expect(stationAtX(stationX(s))).toBe(s);
    expect(stationAtX(PLAN_PAD - 50)).toBe(0);
    expect(stationAtX(PLAN_W)).toBe(1000);
  });
  it("snaps to 10 permille", () => {
    expect(stationAtX(stationX(333))).toBe(330);
    expect(stationAtX(stationX(336))).toBe(340);
  });
});

describe("zoneAtStation", () => {
  it("returns the containing zone, never MISSION, half-open with a closed hull end", () => {
    expect(zoneAtStation(zones, 50)).toBe("FORECASTLE");
    expect(zoneAtStation(zones, 100)).toBe("FWD_SERVICE");
    expect(zoneAtStation(zones, 400)).toBe("FWD_SERVICE");
    expect(zoneAtStation(zones, 500)).toBe("AFT_SERVICE");
    expect(zoneAtStation(zones, 1000)).toBe("AFT_SERVICE");
  });
  it("is null when no zone covers the station", () => {
    expect(zoneAtStation([], 400)).toBeNull();
    expect(zoneAtStation(zones, -10)).toBeNull();
  });
});

describe("sideAtY", () => {
  it("centre near the centreline, starboard above, port below", () => {
    expect(sideAtY(frame, PLAN_MID)).toBe("CENTRE");
    expect(sideAtY(frame, PLAN_MID - frame.maxHalf * CENTRE_BAND)).toBe("CENTRE");
    expect(sideAtY(frame, PLAN_MID - frame.maxHalf)).toBe("STBD");
    expect(sideAtY(frame, PLAN_MID + frame.maxHalf)).toBe("PORT");
  });
});

describe("planTarget", () => {
  it("combines station, zone and side from one point", () => {
    expect(planTarget(frame, zones, stationX(300), PLAN_MID - frame.maxHalf)).toEqual({
      stationPermille: 300,
      zoneId: "FWD_SERVICE",
      side: "STBD",
    });
  });
});

describe("placeEdit", () => {
  const target = { stationPermille: 300, zoneId: "FWD_SERVICE" as const, side: "PORT" as const };
  it("adds a placement with a fresh id, the zone, the station and, for guns, the side", () => {
    const r = placeEdit(def({}), target, { placements: [placement()] });
    expect(r).toEqual({
      ok: true,
      edit: {
        kind: "add_placement",
        placement: {
          instanceId: "gun_a_2",
          componentId: "gun_a",
          zoneId: "FWD_SERVICE",
          stationPermille: 300,
          side: "PORT",
        },
      },
    });
  });
  it("leaves the side off components that have none", () => {
    const r = placeEdit(def({ category: "RANGEFINDER" }), target, { placements: [] });
    expect(r.ok && r.edit.kind === "add_placement" && "side" in r.edit.placement).toBe(false);
  });
  it("refuses a zone the component is not allowed in, and a point with no zone", () => {
    const r = placeEdit(def({ allowedZones: ["AFT_SERVICE"] }), target, { placements: [] });
    expect(r).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/cannot go in the fwd service zone/),
    });
    expect(placeEdit(def({}), { ...target, zoneId: null }, { placements: [] })).toMatchObject({
      ok: false,
    });
  });
});

describe("moveEdit", () => {
  const target = { stationPermille: 600, zoneId: "AFT_SERVICE" as const, side: "CENTRE" as const };
  it("is a plain move when the side is unchanged, and a single batch when it changes", () => {
    const plain = moveEdit(placement(), def({}), target);
    expect(plain).toMatchObject({
      ok: true,
      edit: { kind: "move_placement", stationPermille: 600, zoneId: "AFT_SERVICE" },
    });
    const sided = moveEdit(placement(), def({}), { ...target, side: "STBD" });
    expect(sided).toMatchObject({ ok: true, edit: { kind: "batch" } });
    if (sided.ok && sided.edit.kind === "batch")
      expect(sided.edit.edits.map((e) => e.kind)).toEqual(["move_placement", "set_side"]);
  });
  it("never sets a side on a fitting without one, and refuses a disallowed zone", () => {
    const r = moveEdit(placement(), def({ category: "RANGEFINDER" }), { ...target, side: "STBD" });
    expect(r).toMatchObject({ ok: true, edit: { kind: "move_placement" } });
    expect(moveEdit(placement(), def({ allowedZones: ["FORECASTLE"] }), target)).toMatchObject({
      ok: false,
    });
  });
});

describe("nudgeEdit", () => {
  it("moves along the hull and follows the zone it enters", () => {
    expect(nudgeEdit(placement({ stationPermille: 490 }), def({}), zones, 10)).toMatchObject({
      ok: true,
      edit: { stationPermille: 500, zoneId: "AFT_SERVICE" },
    });
    expect(nudgeEdit(placement({ stationPermille: 200 }), def({}), zones, -50)).toMatchObject({
      ok: true,
      edit: { stationPermille: 150, zoneId: "FWD_SERVICE" },
    });
  });
  it("clamps at the hull ends and says so at the limit", () => {
    expect(
      nudgeEdit(placement({ stationPermille: 1000, zoneId: "AFT_SERVICE" }), def({}), zones, 10),
    ).toMatchObject({ ok: false });
    expect(
      nudgeEdit(placement({ stationPermille: 990, zoneId: "AFT_SERVICE" }), def({}), zones, 50),
    ).toMatchObject({
      ok: true,
      edit: { stationPermille: 1000 },
    });
  });
  it("refuses to nudge into a zone the component cannot use", () => {
    const r = nudgeEdit(
      placement({ stationPermille: 490 }),
      def({ allowedZones: ["FWD_SERVICE"] }),
      zones,
      20,
    );
    expect(r).toMatchObject({ ok: false });
  });
});

describe("helpers", () => {
  it("hasSide is true for guns and tubes only", () => {
    expect(hasSide(def({}))).toBe(true);
    expect(hasSide(def({ category: "TORPEDO_TUBE" }))).toBe(true);
    expect(hasSide(def({ category: "MAGAZINE" }))).toBe(false);
    expect(hasSide(undefined)).toBe(false);
  });
  it("nextInstanceId skips taken ids", () => {
    expect(nextInstanceId({ placements: [] }, "x")).toBe("x_1");
    expect(
      nextInstanceId(
        { placements: [placement({ instanceId: "x_1" }), placement({ instanceId: "x_2" })] },
        "x",
      ),
    ).toBe("x_3");
  });
});

describe("clientToPlan", () => {
  it("scales a client point by the drawing's on-screen size", () => {
    const rect = { left: 100, top: 50, width: PLAN_W * 2, height: PLAN_H * 2 };
    expect(clientToPlan(rect, 100 + PLAN_W, 50 + PLAN_H)).toEqual({ x: PLAN_W / 2, y: PLAN_H / 2 });
  });
  it("is null for a rectangle with no size", () => {
    expect(clientToPlan({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toBeNull();
  });
});

describe("fittingAt", () => {
  const draft = {
    placements: [
      placement({ instanceId: "a", stationPermille: 200 }),
      placement({ instanceId: "b", stationPermille: 600, side: "PORT" }),
    ],
  };
  const at = (i: number) =>
    fittingPoint(frame, draft.placements[i]!.stationPermille, draft.placements[i]!.side, i);
  it("finds the fitting under the pointer, the nearest one, within the grab radius", () => {
    expect(fittingAt(frame, draft, at(0).x, at(0).y)).toBe("a");
    expect(fittingAt(frame, draft, at(1).x + 3, at(1).y - 3)).toBe("b");
    expect(fittingAt(frame, draft, at(0).x + GRAB_RADIUS, at(0).y)).toBe("a"); // boundary: exactly on the radius
    expect(fittingAt(frame, draft, at(0).x + GRAB_RADIUS + 1, at(0).y)).toBeNull();
    expect(fittingAt(frame, { placements: [] }, 10, 10)).toBeNull();
  });
  it("breaks a tie toward the earlier placement", () => {
    const twin = { placements: [placement({ instanceId: "x" }), placement({ instanceId: "y" })] };
    // Same station and side: index 0 and 1 get different cosmetic nudges, so aim between them.
    const p0 = fittingPoint(frame, 200, undefined, 0);
    const p1 = fittingPoint(frame, 200, undefined, 1);
    expect(fittingAt(frame, twin, p0.x, (p0.y + p1.y) / 2)).toBe("x");
  });
});
