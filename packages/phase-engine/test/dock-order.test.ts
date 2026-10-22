import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { placeConstructionOrder } from "../src/index.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

type Design = CampaignSnapshot["designs"] extends Map<string, infer D> ? D : never;

const MONTH = { year: 1880, month: 1 };
const profileContent = productionShipBuildingContent({ navalProfiles: true });

const ukDesign = (displacementKg: number): Design => ({
  ...makeDesign("dv-uk", "uk"),
  normalizedDisplacementKg: SafeInt(displacementKg),
});
const ukSnapshot = (design: Design): CampaignSnapshot => {
  const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
  return {
    ...base,
    nations: new Map([["uk", makeNation("uk", [])]]),
    designs: new Map([[design.designVersionId, design]]),
  };
};
const ukOrder = (snapshot: CampaignSnapshot) =>
  placeConstructionOrder(
    snapshot,
    { nationId: "uk", commandId: "cmd-uk", designVersionId: "dv-uk", month: MONTH },
    profileContent,
  );

describe("the national dock ceiling gates domestic orders (DESIGN-16 section 4, ADR-0135)", () => {
  it("orders a real domestic reference design at the UK dock (12,679 t < 13,000 t)", () => {
    expect(ukOrder(ukSnapshot(ukDesign(12_679_499))).ok).toBe(true);
  });

  it("refuses an oversized design with SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT", () => {
    expect(ukOrder(ukSnapshot(ukDesign(13_000_001)))).toMatchObject({
      ok: false,
      reason: "SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT",
    });
  });

  it("a materialised nation dock overrides the content-derived dock", () => {
    const snapshot = ukSnapshot(ukDesign(1_500_000));
    const uk = snapshot.nations.get("uk")!;
    snapshot.nations.set("uk", {
      ...uk,
      dock: {
        maximumNewConstructionMassKg: 1_000_000,
        maximumMajorRepairMassKg: 1_000_000,
        maximumRebuildMassKg: 1_000_000,
        maximumConversionMassKg: 1_000_000,
      },
    });
    expect(ukOrder(snapshot)).toMatchObject({
      ok: false,
      reason: "SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT",
    });
  });
});
