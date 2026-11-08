import { projectedConstructionOrderCosts } from "@bluewave/campaign-engine";
import {
  buildWorkshopView,
  compileDesign,
  designPrice,
  type DesignDraft,
} from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { buildDesignVersion, PhaseEngineError, planDesignStudy, pricingFor } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot } from "./battle-fixtures.js";
import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ withStudyRules: true });
const month = "1895-07";
const draft: DesignDraft = {
  ...(readReferenceDesignEntries().find((d) => d.id === "havock_like")!.draft as DesignDraft),
  nationId: ATTACKER_NATION,
};

function setup() {
  const env = content.environmentFor(month);
  const view = buildWorkshopView(draft, env);
  const compiled = compileDesign(draft, env.ctx);
  const version = buildDesignVersion(
    compiled,
    draft,
    {
      designVersionId: "des_price_probe",
      designFamilyId: "fam_price_probe",
      className: "Price probe",
      hullType: "destroyer",
      machineryType: draft.machinery.plantId,
      contentVersion: "test",
      kgPerHitPoint: content.kgPerHitPoint,
    },
    pricingFor(content, month),
  );
  const price = designPrice({
    costMicro: view.forecast.costMicro,
    monthlyMaintenanceMicro: view.forecast.monthlyMaintenanceMicro,
    treasuryUnitMicro: content.treasuryUnitMicro,
    study: { balance: content.study!, derived: false },
  });
  return { compiled, version, price, view };
}

describe("one design price shared by designer, study and catalog", () => {
  it("derives the designer units, catalog projected cost and construction cost from one value", () => {
    const { version, price } = setup();
    expect(price.treasuryUnits).toBeGreaterThan(0);
    expect(Number(version.constructionCostUnits)).toBe(price.treasuryUnits);
    expect(projectedConstructionOrderCosts(version).projectedCost).toBe(price.treasuryUnits);
  });

  it("derives the study base cost and months from the same price", () => {
    const { compiled, version, price } = setup();
    const snapshot = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
    const planned = planDesignStudy(
      snapshot,
      ATTACKER_NATION,
      version,
      { compiled, draft },
      content,
      month,
    );
    expect(planned.baseStudyCost).toBe(price.study!.baseStudyCost);
    expect(planned.finalStudyCost).toBe(price.studyCost);
    expect(planned.finalStudyWork).toBe(price.studyMonths);
  });

  it("reports the treasury fit and an over-budget state in units", () => {
    const { view } = setup();
    const input = {
      costMicro: view.forecast.costMicro,
      monthlyMaintenanceMicro: view.forecast.monthlyMaintenanceMicro,
      treasuryUnitMicro: content.treasuryUnitMicro,
    };
    const base = designPrice(input).treasuryUnits;
    const short = designPrice({ ...input, freeTreasuryUnits: base - 1 }).treasury!;
    expect(short.overBudget).toBe(true);
    expect(short.shortfallUnits).toBe(1);
    const enough = designPrice({ ...input, freeTreasuryUnits: base + 5 }).treasury!;
    expect(enough.overBudget).toBe(false);
    expect(enough.remainingUnits).toBe(5);
    expect(designPrice(input).treasury).toBeNull();
  });

  it("refuses to plan a study for a design that carries no priced construction cost", () => {
    const { compiled, version } = setup();
    const { constructionCostUnits: _priced, ...unpriced } = version;
    const snapshot = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
    expect(() =>
      planDesignStudy(snapshot, ATTACKER_NATION, unpriced, { compiled, draft }, content, month),
    ).toThrow(PhaseEngineError);
  });
});
