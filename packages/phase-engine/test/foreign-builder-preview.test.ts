import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
  FOREIGN_CONSTRUCTION_QUANTITY_INVALID,
  FOREIGN_INSTALMENT_COUNT,
  previewForeignConstruction,
} from "../src/index.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ navalProfiles: true });
const ORDERING = "uk";
const BUILDER = "france";
const MONTH_ID = "1880-01";

function design(displacementKg: number) {
  return {
    ...makeDesign("dv-1", ORDERING),
    normalizedDisplacementKg: SafeInt(displacementKg),
  };
}

function snapshot(displacementKg = 5_000_000): CampaignSnapshot {
  const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
  return {
    ...base,
    nations: new Map([
      [ORDERING, makeNation(ORDERING, [])],
      [BUILDER, makeNation(BUILDER, [])],
    ]),
    designs: new Map([["dv-1", design(displacementKg)]]),
  } as CampaignSnapshot;
}

const preview = (
  snap: CampaignSnapshot,
  quantity: number,
  options: Parameters<typeof previewForeignConstruction>[6] = {},
) => previewForeignConstruction(snap, ORDERING, "dv-1", quantity, content, MONTH_ID, options);

describe("previewForeignConstruction (SB3-R20/R23/R34)", () => {
  it("lists candidate builders with dock ceiling, capacity and fit, ascending by nation id", () => {
    const result = preview(snapshot(), 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.preview.builders.map((b) => b.nationId);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toContain(BUILDER);
    expect(ids).not.toContain(ORDERING);
    const france = result.preview.builders.find((b) => b.nationId === BUILDER)!;
    expect(france.dockCeilingKg).not.toBeNull();
    expect(france.fitsDock).toBe(true);
    expect(france.capabilitySatisfied).toBe(true);
    expect(france.capabilityFailureCode).toBeNull();
    expect(france.reservedMassKg).toBeGreaterThan(0);
    expect(france.impoundmentRiskBp).toBe(0);
    expect(france.deliveryGuarantee).toBe(false);
  });

  it("refuses a quantity outside 1..12 with the command's own reason code", () => {
    const result = preview(snapshot(), 13);
    expect(result).toEqual({
      ok: false,
      reason: FOREIGN_CONSTRUCTION_QUANTITY_INVALID,
      diagnostics: expect.any(Array),
    });
  });

  it("derives the contract terms for the chosen builder (price = work x quantity; six instalments)", () => {
    const result = preview(snapshot(), 3, { builderNationId: BUILDER });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contract = result.preview.contract;
    expect(contract).not.toBeNull();
    expect(contract!.quantity).toBe(3);
    expect(contract!.totalPriceUnits).toBe(contract!.totalWorkPerUnit * 3);
    expect(contract!.paymentSchedule).toHaveLength(FOREIGN_INSTALMENT_COUNT);
    expect(contract!.paymentGraceMonths).toBe(1);
    const franceReservedKg = result.preview.builders.find(
      (b) => b.nationId === BUILDER,
    )!.reservedMassKg;
    expect(contract!.capacityReservationSchedule).toEqual([
      { month: "1880-01", reservedMassKg: franceReservedKg, pool: "NEW_CONSTRUCTION" },
    ]);
    expect(contract!.capabilitySatisfied).toBe(true);
    const shares = contract!.paymentSchedule.reduce((s, i) => s + i.workShareBp, 0);
    expect(shares).toBe(10_000);
  });

  it("marks a hull over the builder's dock limit as incapable (FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT)", () => {
    const result = preview(snapshot(40_000_000), 1, { builderNationId: BUILDER });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const france = result.preview.builders.find((b) => b.nationId === BUILDER)!;
    expect(france.fitsDock).toBe(false);
    expect(france.capabilitySatisfied).toBe(false);
    expect(france.capabilityFailureCode).toBe(FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT);
    expect(france.capabilityReasons.some((r) => r.startsWith("DOCK"))).toBe(true);
  });

  it("reports tension-scaled impoundment risk and blocks capability at war", () => {
    const base = snapshot();
    const atWar: CampaignSnapshot = {
      ...base,
      politics: {
        ...base["politics"],
        relations: [
          {
            nationA: ORDERING,
            nationB: BUILDER,
            relation: "at_war",
            tension: 8,
            nap: false,
            since: MONTH_ID,
          },
        ],
      },
    };
    const result = preview(atWar, 1, { builderNationId: BUILDER });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const france = result.preview.builders.find((b) => b.nationId === BUILDER)!;
    expect(france.relation).toBe("at_war");
    expect(france.impoundmentRiskBp).toBeGreaterThan(0);
    expect(france.capabilitySatisfied).toBe(false);
  });
});
