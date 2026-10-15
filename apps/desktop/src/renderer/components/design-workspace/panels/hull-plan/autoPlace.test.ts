import { applyEdit, compileDesign, type DraftEdit } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../content.js";
import { AUTO_PLACE_STATIONS, autoPlace, placeEdit, zoneAtStation } from "./placement-tools.js";

const content = loadDrawingBoardContent();
const ref = content.references.find((r) => r.id === "majestic_like")!;
const ctx = content.environmentFor(ref.month).ctx;
const zones = content.hullForms.find((f) => f.id === ref.draft.hull.hullFormId)!.zones;
const pump = content.catalogue.find((c) => c.id === "pumps_damage_control")!;
const trimAfter = (e: DraftEdit) =>
  Math.abs(compileDesign(applyEdit(ref.draft, e), ctx).stability!.trimBp);
const blocking = (e: DraftEdit | null) =>
  compileDesign(e ? applyEdit(ref.draft, e) : ref.draft, ctx).findings.filter(
    (f) => f.severity === "BLOCKING",
  ).length;

describe("autoPlace", () => {
  it("picks a legal station that leaves the ship at least as level as any other, adding no blocking problem", () => {
    const r = autoPlace(pump, ref.draft, zones, ctx);
    if (!r.ok) throw new Error(r.reason);
    expect(blocking(r.edit)).toBeLessThanOrEqual(blocking(null));
    const best = trimAfter(r.edit);
    for (const station of AUTO_PLACE_STATIONS.filter((_, i) => i % 7 === 0)) {
      const c = placeEdit(
        pump,
        { stationPermille: station, zoneId: zoneAtStation(zones, station), side: "CENTRE" },
        ref.draft,
      );
      if (c.ok) expect(best).toBeLessThanOrEqual(trimAfter(c.edit));
    }
  });

  it("is deterministic", () => {
    expect(autoPlace(pump, ref.draft, zones, ctx)).toEqual(autoPlace(pump, ref.draft, zones, ctx));
  });

  it("refuses, saying why, when no station is legal", () => {
    const nowhere = { ...pump, allowedZones: ["NOT_A_ZONE"] } as unknown as typeof pump;
    const r = autoPlace(nowhere, ref.draft, zones, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/No station takes/);
  });
});
