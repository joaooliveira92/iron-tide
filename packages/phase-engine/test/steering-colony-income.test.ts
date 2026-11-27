import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { accelerationTermsOf } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { constructionSteeringPreviews } from "../src/constructionSteeringPreview.js";
import { design, project, snapshot } from "./helpers/constructionFixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent();
const environment = content.environmentFor("1880-02");
const terms = accelerationTermsOf(environment.constructionBalance, environment.costBalance);

const COLONY_BASE = 3_500;
const colonyIncome = {
  baselineYear: 1880,
  startFactorBp: 10_000,
  slopeBpPerYear: 120,
  floorBp: 2_500,
};

function pacedSnapshot(withPossession: boolean): CampaignSnapshot {
  const base = snapshot(
    [
      {
        ...project({ withPackages: true, designVersionId: "d1" }),
        buildMonths: 10,
        startedAt: "1880-02",
      },
    ],
    new Map([["d1", design("d1", 60)]]),
    COLONY_BASE,
    1,
  );
  if (!withPossession) return base;
  return {
    ...base,
    world: {
      ...base.world,
      possessions: [{ id: "p1", nationId: "GBR", areaId: "a1", colonyValueBp: SafeInt(1_000) }],
    },
  };
}

function fundsLimited(from: CampaignSnapshot, withRules: boolean): boolean | undefined {
  return constructionSteeringPreviews(from, "GBR", content, {
    acceleration: terms,
    ...(withRules ? { colonyIncome } : {}),
  }).get("proj-1")?.accelerate?.fundsLimited;
}

describe("steering preview colony income", () => {
  it("counts colony income toward the funds that pay the monthly work", () => {
    expect(fundsLimited(pacedSnapshot(true), false)).toBe(true);
    expect(fundsLimited(pacedSnapshot(false), true)).toBe(true);
    expect(fundsLimited(pacedSnapshot(true), true)).toBe(false);
  });
});
