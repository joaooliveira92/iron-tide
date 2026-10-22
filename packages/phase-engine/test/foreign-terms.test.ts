import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { applyOrderForeignConstruction } from "../src/commands.js";
import {
  FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
  FOREIGN_CONSTRUCTION_QUANTITY_INVALID,
  FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED,
  FOREIGN_INSTALMENT_COUNT,
  deriveForeignContractTerms,
  resolveBuilderConstructionSupply,
  resolveForeignBuilderCapability,
} from "../src/index.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ navalProfiles: true });
const ORDERING = "uk";
const BUILDER = "france";
const MONTH_ID = "1880-01";

function design(displacementKg = 5_000_000) {
  return {
    ...makeDesign("dv-1", ORDERING),
    normalizedDisplacementKg: SafeInt(displacementKg),
  };
}

function snapshot(): CampaignSnapshot {
  const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
  return {
    ...base,
    nations: new Map([
      [ORDERING, makeNation(ORDERING, [])],
      [BUILDER, makeNation(BUILDER, [])],
    ]),
    designs: new Map([["dv-1", design()]]),
  } as CampaignSnapshot;
}

function hostileSnapshot(): CampaignSnapshot {
  const base = snapshot();
  return {
    ...base,
    politics: {
      ...base.politics,
      relations: [
        {
          nationA: ORDERING,
          nationB: BUILDER,
          relation: "at_war",
          tension: 10,
          nap: false,
          since: MONTH_ID,
        },
      ],
    },
  };
}

describe("deriveForeignContractTerms (INC-17)", () => {
  it("stamps the versioned instalment policy and splits amounts/shares exactly", () => {
    expect(FOREIGN_INSTALMENT_COUNT).toBe(6);
    const terms = deriveForeignContractTerms({
      design: design(),
      builderCostMultiplierBp: 10_000,
      quantity: 2,
      builderNationId: BUILDER,
      authorizationMonth: MONTH_ID,
    });
    expect(terms.builderShipyardId).toBe(`yard:${BUILDER}`);
    expect(terms.quantity).toBe(2);
    expect(terms.totalWorkPerUnit).toBeGreaterThan(0);
    expect(terms.totalPriceUnits).toBe(terms.totalWorkPerUnit * 2);
    expect(terms.paymentSchedule).toHaveLength(FOREIGN_INSTALMENT_COUNT);
    expect(terms.paymentSchedule.reduce((sum, i) => sum + i.amountUnits, 0)).toBe(
      terms.totalPriceUnits,
    );
    expect(terms.paymentSchedule.reduce((sum, i) => sum + i.workShareBp, 0)).toBe(10_000);
    expect(terms.paymentSchedule.map((i) => i.dueMonth)).toEqual([
      "1880-01",
      "1880-02",
      "1880-03",
      "1880-04",
      "1880-05",
      "1880-06",
    ]);
    expect(terms.plannedKeelMonth).toBe(MONTH_ID);
    expect(terms.plannedDeliveryMonth).toBe("1880-06");
  });

  it("honours a caller delivery month only when it is valid and at or after the last due month", () => {
    const base = {
      design: design(),
      builderCostMultiplierBp: 10_000,
      quantity: 1,
      builderNationId: BUILDER,
      authorizationMonth: MONTH_ID,
    } as const;
    expect(
      deriveForeignContractTerms({ ...base, plannedDeliveryMonth: "1880-09" }).plannedDeliveryMonth,
    ).toBe("1880-09");
    expect(
      deriveForeignContractTerms({ ...base, plannedDeliveryMonth: "1880-02" }).plannedDeliveryMonth,
    ).toBe("1880-06");
    expect(
      deriveForeignContractTerms({ ...base, plannedDeliveryMonth: "not-a-month" })
        .plannedDeliveryMonth,
    ).toBe("1880-06");
  });
});

describe("applyOrderForeignConstruction refuses a fabricated contract (INC-17)", () => {
  it("rejects a runtime body that still carries renderer-supplied terms", () => {
    const collector = new DiagnosticCollector();
    const fabricated: Parameters<typeof applyOrderForeignConstruction>[1] & { terms?: unknown } = {
      type: "OrderForeignConstruction",
      nationId: ORDERING,
      designVersionId: "dv-1",
      builderNationId: BUILDER,
      quantity: 1,
      terms: { totalPriceUnits: 1 },
    };
    const before = snapshot();
    const next = applyOrderForeignConstruction(
      before,
      fabricated,
      "cmd-fab",
      content,
      MONTH_ID,
      collector,
    );
    expect(next).toBe(before);
    expect(collector.errors.map((e) => e.code)).toContain(FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED);
    expect(before.nations.get(ORDERING)!.foreignContracts ?? []).toHaveLength(0);
  });

  it("rejects a quantity outside 1..12 with FOREIGN_CONSTRUCTION_QUANTITY_INVALID", () => {
    for (const quantity of [0, 13]) {
      const collector = new DiagnosticCollector();
      const before = snapshot();
      const next = applyOrderForeignConstruction(
        before,
        {
          type: "OrderForeignConstruction",
          nationId: ORDERING,
          designVersionId: "dv-1",
          builderNationId: BUILDER,
          quantity,
        },
        "cmd-qty",
        content,
        MONTH_ID,
        collector,
      );
      expect(next).toBe(before);
      expect(collector.errors.map((e) => e.code)).toContain(FOREIGN_CONSTRUCTION_QUANTITY_INVALID);
    }
  });

  it("fails capability with FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT when ordering and builder are at war", () => {
    const before = hostileSnapshot();
    const conditions = resolveForeignBuilderCapability(before, content, {
      orderingNationId: ORDERING,
      builderNationId: BUILDER,
      design: design(),
      campaignMonth: MONTH_ID,
      constructionSupplyAvailable: true,
      dock: {},
    });
    expect(conditions.governmentPermissionSatisfied).toBe(false);
    expect(conditions.physicallyCapable).toBe(false);

    const collector = new DiagnosticCollector();
    const next = applyOrderForeignConstruction(
      before,
      {
        type: "OrderForeignConstruction",
        nationId: ORDERING,
        designVersionId: "dv-1",
        builderNationId: BUILDER,
        quantity: 1,
      },
      "cmd-war",
      content,
      MONTH_ID,
      collector,
    );
    expect(next).toBe(before);
    expect(collector.errors.map((e) => e.code)).toContain(FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT);
    expect(before.nations.get(ORDERING)!.foreignContracts ?? []).toHaveLength(0);
  });

  it("fails closed (no throw) when the builder cannot obtain its armament or armour plate (MAJOR)", () => {
    const profile = content.navalProfileFor(BUILDER, MONTH_ID);
    if (profile === null) throw new Error("expected a france naval profile");
    const unavailable: ShipBuildingContent = {
      ...content,
      navalProfileFor: (nationId, month) =>
        nationId === BUILDER && month === MONTH_ID
          ? {
              ...profile,
              industrialProfile: {
                ...profile.industrialProfile,
                heavyGunProduction: "UNAVAILABLE",
              },
            }
          : content.navalProfileFor(nationId, month),
    };
    expect(resolveBuilderConstructionSupply(unavailable, BUILDER, MONTH_ID)).toEqual({
      available: false,
      costMultiplierBp: 10_000,
    });

    const before = snapshot();
    const collector = new DiagnosticCollector();
    const next = applyOrderForeignConstruction(
      before,
      {
        type: "OrderForeignConstruction",
        nationId: ORDERING,
        designVersionId: "dv-1",
        builderNationId: BUILDER,
        quantity: 1,
      },
      "cmd-supply",
      unavailable,
      MONTH_ID,
      collector,
    );
    expect(next).toBe(before);
    expect(collector.errors.map((e) => e.code)).toContain(FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT);
    expect(before.nations.get(ORDERING)!.foreignContracts ?? []).toHaveLength(0);
  });
});
