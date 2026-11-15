import { SURRENDER_SCORE } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";

const TIERS = [30, 50, 70];

const CHOKEPOINTS = ["med_gibraltar", "sea_singapore", "indian_adden", "ott_eg_coast"];

const MULTI_PORT_COLONIAL = [
  "pacific_australia",
  "africa_cape",
  "africa_algeria",
  "dei_java",
  "philippines_luzon",
];

describe("production cession costs (#816)", () => {
  const { state, bundle } = compileProductionCampaign();
  const areas = state.snapshot.world.areas;
  const homes = new Set(
    [...state.snapshot.nations.values()].flatMap((n) =>
      n.homeAreaId !== undefined ? [n.homeAreaId] : [],
    ),
  );
  const controlled = areas.filter((a) => a.controller !== undefined);
  const byId = new Map(areas.map((a) => [a.id, a]));

  it("controls 62 areas of which 14 are home areas", () => {
    expect(controlled).toHaveLength(62);
    expect(homes.size).toBe(14);
  });

  it("prices every non-home controlled area in a tier below the surrender threshold", () => {
    const priced = controlled.filter((a) => !homes.has(a.id));
    expect(priced).toHaveLength(48);
    for (const a of priced) {
      expect(TIERS, a.id).toContain(a.cessionCost);
      expect(a.cessionCost ?? SURRENDER_SCORE, a.id).toBeLessThan(SURRENDER_SCORE);
    }
  });

  it("leaves home areas and sea areas unpriced", () => {
    for (const a of areas) {
      if (homes.has(a.id) || a.controller === undefined)
        expect(a.cessionCost, a.id).toBeUndefined();
    }
  });

  it("prices chokepoints at 50 and multi-port colonial areas at 70", () => {
    for (const id of CHOKEPOINTS) expect(byId.get(id)?.cessionCost, id).toBe(50);
    for (const id of MULTI_PORT_COLONIAL) expect(byId.get(id)?.cessionCost, id).toBe(70);
  });

  it("carries BALANCE_TARGET LOW provenance on every priced area", () => {
    for (const a of bundle.areas.filter((x) => x.cessionCost !== undefined)) {
      expect(a.provenance?.sourceStatus, a.id).toBe("BALANCE_TARGET");
      expect(a.provenance?.confidence, a.id).toBe("LOW");
    }
  });
});
