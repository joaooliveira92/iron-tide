/**
 * ADR-0093 Step 4 — ship-design persists first-class armament identity onto the engine design.
 *
 * The compile already resolves every installed weapon through `@bluewave/armament` (Step 3); this proves
 * the engine adapter (`toEngineDesign`) carries that identity forward, deterministically ordered, so it can
 * be persisted on the compiled design version and consumed by combat. It is additive: the legacy
 * compatibility path (no first-class armament content) carries no identity.
 */
import { describe, it, expect } from "vite-plus/test";
import { buildShipBuildingContent, compileDesign, toEngineDesign } from "../src/index.js";
import { nationalContext, shipBuildingContent, shipBuildingData } from "./helpers/earlyContext.js";

const OPENING_MONTH = "1880-01";
/** The first-class armament content covers the original three nations; other nations use the legacy path. */
const ARMAMENT_NATIONS = new Set(["uk", "france", "germany"]);
const openingStarters = shipBuildingContent.starterDesigns.filter(
  (s) => s.month === OPENING_MONTH && ARMAMENT_NATIONS.has(s.draft.nationId),
);
const legacyContent = buildShipBuildingContent({ ...shipBuildingData, armament: undefined });

function engineOptions(id: string) {
  return {
    designVersionId: `dv_${id}`,
    designFamilyId: `fam_${id}`,
    className: id,
    hullType: "battleship",
    machineryType: "steam_triple_expansion",
    contentVersion: "test_v1",
    kgPerHitPoint: 4_000,
  };
}

describe("Step 4: engine design carries the compiled armament identity", () => {
  it("carries canonical, deterministically-ordered identity for every opening starter", () => {
    expect(openingStarters).toHaveLength(18);
    for (const s of openingStarters) {
      const compiled = compileDesign(s.draft, nationalContext(s.month, s.draft.nationId));
      expect(compiled.valid, s.id).toBe(true);
      const e = toEngineDesign(compiled, s.draft, engineOptions(s.id));
      expect(e.armament, s.id).toBeDefined();
      expect(e.armament!.length).toBeGreaterThan(0);
      const ids = e.armament!.map((a) => a.instanceId);
      expect(
        [...ids].sort((x, y) => (x < y ? -1 : 1)),
        s.id,
      ).toEqual(ids);
      for (const a of e.armament!) {
        expect(a.gunModelId, s.id).toMatch(/^[a-z0-9_]+$/);
        expect(a.mountId, s.id).toMatch(/^[a-z0-9_]+$/);
        expect(a.ammunitionId, s.id).toMatch(/^[a-z0-9_]+$/);
        expect(a.gunCount).toBeGreaterThan(0);
      }
    }
  });

  it("is deterministic across repeated compiles", () => {
    const s = openingStarters[0]!;
    const one = toEngineDesign(
      compileDesign(s.draft, nationalContext(s.month, s.draft.nationId)),
      s.draft,
      engineOptions(s.id),
    );
    const two = toEngineDesign(
      compileDesign(s.draft, nationalContext(s.month, s.draft.nationId)),
      s.draft,
      engineOptions(s.id),
    );
    expect(two.armament).toEqual(one.armament);
  });

  it("omits the identity on the legacy compatibility path", () => {
    const s = openingStarters.find((d) => d.draft.nationId === "uk")!;
    const ctx = legacyContent.environmentFor(s.month, s.draft.nationId).ctx;
    const compiled = compileDesign(s.draft, ctx);
    const e = toEngineDesign(compiled, s.draft, engineOptions(s.id));
    expect(e.armament).toBeUndefined();
  });
});
