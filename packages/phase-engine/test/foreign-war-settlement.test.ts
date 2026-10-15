// SB3-R23 / DESIGN-16 §13.6-13.7: the settlement money a war outcome moves. A refund effect returns the cumulative
// paid amount from the builder to the ordering nation; a zero-paid forfeiture moves nothing.
import type { CampaignSnapshot, ForeignConstructionContract } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  buildForeignConstructionContract,
  foreignContractIdForCommand,
  foreignPostingLedgerEntries,
  placeForeignConstructionOrder,
} from "../src/foreignConstruction.js";
import {
  FOREIGN_SETTLEMENT_CATEGORY_ID,
  FOREIGN_SETTLEMENT_POLICY_ID,
  foreignWarSettlementPostings,
} from "../src/foreignWarEffects.js";
import { FinancialLedger } from "../src/financial-ledger.js";
import { MonthExecutor } from "../src/month.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ navalProfiles: true });
const ORDERING = "uk";
const BUILDER = "france";
const MONTH_ID = "1880-01";
const ALL_CAPABLE = {
  requiredTechnologySatisfied: true,
  shipyardCapabilitySatisfied: true,
  governmentPermissionSatisfied: true,
  componentSourcingSatisfied: true,
  physicallyCapable: true,
} as const;

function terms() {
  return {
    builderShipyardId: "yard-france-1",
    quantity: 1,
    totalWorkPerUnit: 1000,
    totalPriceUnits: 1000,
    paymentSchedule: [
      { dueMonth: MONTH_ID, amountUnits: 500, workShareBp: 5_000 },
      { dueMonth: "1880-04", amountUnits: 500, workShareBp: 5_000 },
    ],
    authorizationMonth: MONTH_ID,
    plannedKeelMonth: MONTH_ID,
    plannedDeliveryMonth: "1880-06",
  };
}

function contract(): ForeignConstructionContract {
  return buildForeignConstructionContract({
    contractId: foreignContractIdForCommand("cmd-1"),
    orderingNationId: ORDERING,
    builderNationId: BUILDER,
    designVersionId: "dv-1",
    terms: terms(),
    reservedMassKg: 5_000_000,
    builderCapabilitySnapshotHash: "h",
  });
}

describe("foreignWarSettlementPostings (SB3-R23 §13.6/13.7)", () => {
  const c = contract();

  it("is the versioned shipped settlement policy", () => {
    expect(FOREIGN_SETTLEMENT_POLICY_ID).toBe("foreign_contract_settlement_v1");
  });

  it("returns the paid amount from the builder to the ordering nation for a settlement outcome", () => {
    expect(foreignWarSettlementPostings(c, "CANCEL_WITH_SETTLEMENT", 500)).toEqual([
      {
        nationId: BUILDER,
        direction: "OUTFLOW",
        categoryId: FOREIGN_SETTLEMENT_CATEGORY_ID,
        amountUnits: 500,
        reason: `foreign_contract_settlement:${c.contractId}:CANCEL_WITH_SETTLEMENT`,
      },
      {
        nationId: ORDERING,
        direction: "INFLOW",
        categoryId: FOREIGN_SETTLEMENT_CATEGORY_ID,
        amountUnits: 500,
        reason: `foreign_contract_settlement:${c.contractId}:CANCEL_WITH_SETTLEMENT`,
      },
    ]);
  });

  it("compensates on an impoundment when something was paid", () => {
    const postings = foreignWarSettlementPostings(c, "IMPOUND", 500);
    expect(postings.map((p) => [p.nationId, p.direction, p.amountUnits])).toEqual([
      [BUILDER, "OUTFLOW", 500],
      [ORDERING, "INFLOW", 500],
    ]);
  });

  it("moves nothing for a zero-paid forfeiture or a non-refund outcome", () => {
    expect(foreignWarSettlementPostings(c, "IMPOUND", 0)).toEqual([]);
    expect(foreignWarSettlementPostings(c, "PHYSICALLY_IMPOSSIBLE", 0)).toEqual([]);
    expect(foreignWarSettlementPostings(c, "CONTINUE", 500)).toEqual([]);
    expect(foreignWarSettlementPostings(c, "DELAY", 500)).toEqual([]);
    expect(foreignWarSettlementPostings(c, "SUSPEND", 500)).toEqual([]);
  });

  it("posts balanced ledger entries that move both treasuries by the paid amount", () => {
    const ledger = new FinancialLedger();
    for (const entry of foreignPostingLedgerEntries(
      foreignWarSettlementPostings(c, "IMPOUND", 500),
      {
        campaignMonth: MONTH_ID,
        phaseId: "appropriation",
        balances: { [ORDERING]: 10_000, [BUILDER]: 1_000 },
      },
    ))
      ledger.append(entry);
    expect(ledger.all).toHaveLength(2);
    expect(ledger.all.every((t) => t.debit === t.credit)).toBe(true);
    // Builder pays out, ordering nation is paid.
    expect(ledger.all.find((t) => t.nationId === BUILDER)).toMatchObject({
      previousBalance: 1_000,
      newBalance: 500,
    });
    expect(ledger.all.find((t) => t.nationId === ORDERING)).toMatchObject({
      previousBalance: 10_000,
      newBalance: 10_500,
    });
  });
});

// Monthly integration: a paid contract impounded at war returns the paid money

describe("the monthly war step posts the settlement (SB3-R23)", () => {
  function snapshot(builderTreasury = 10_000): CampaignSnapshot {
    const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
    const uk = {
      ...makeNation(ORDERING, []),
      treasury: SafeInt(10_000),
      baseResources: SafeInt(0),
      navalAppropriationRateBp: SafeInt(0),
      expenses: SafeInt(0),
    };
    const france = {
      ...makeNation(BUILDER, []),
      treasury: SafeInt(builderTreasury),
      baseResources: SafeInt(0),
      navalAppropriationRateBp: SafeInt(0),
    };
    return {
      ...base,
      nations: new Map([
        [ORDERING, uk],
        [BUILDER, france],
      ]),
      designs: new Map([
        ["dv-1", { ...makeDesign("dv-1", ORDERING), normalizedDisplacementKg: SafeInt(5_000_000) }],
      ]),
    } as CampaignSnapshot;
  }

  const hostile = (snap: CampaignSnapshot): CampaignSnapshot => ({
    ...snap,
    politics: {
      ...snap.politics,
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
  });

  const ordered = (builderTreasury = 10_000): CampaignSnapshot => {
    const placed = placeForeignConstructionOrder(
      snapshot(builderTreasury),
      {
        nationId: ORDERING,
        commandId: "cmd-1",
        designVersionId: "dv-1",
        builderNationId: BUILDER,
        month: { year: 1880, month: 1 },
        terms: terms(),
        capability: ALL_CAPABLE,
      },
      content,
    );
    if (!placed.ok) throw new Error(`order failed: ${placed.reason}`);
    // Record the first instalment as already paid (the settlement returns it), keeping the project live.
    const ordering = placed.snapshot.nations.get(ORDERING)!;
    return {
      ...placed.snapshot,
      nations: new Map(placed.snapshot.nations).set(ORDERING, {
        ...ordering,
        foreignContractPayments: [
          { contractId: placed.contract.contractId, paidDueMonths: [MONTH_ID] },
        ],
      }),
    };
  };

  /** Run hostile months until an impound lands, returning the result; throws if none in 12 seeds. */
  const impoundOnce = (builderTreasury = 10_000) => {
    for (let i = 0; i < 12; i++) {
      const result = new MonthExecutor().execute(
        hostile(ordered(builderTreasury)),
        [],
        `settle-seed-${String(i)}`,
        new DiagnosticCollector(),
        undefined,
        { shipBuilding: content },
      );
      const project = result.finalSnapshot.nations
        .get(ORDERING)!
        .constructionProjects.find((p) => p.foreignContractId !== undefined);
      if (project?.status === "IMPOUNDED") return { result, seed: i };
    }
    throw new Error("no impound in 12 seeds");
  };

  it("credits the ordering nation and debits the builder when an impounded contract had paid instalments", () => {
    const { result, seed } = impoundOnce();
    // The builder returned the 500 already paid: ordering 10,000 -> 10,500, builder 10,000 -> 9,500.
    expect(result.finalSnapshot.nations.get(ORDERING)!.treasury as number).toBe(10_500);
    expect(result.finalSnapshot.nations.get(BUILDER)!.treasury as number).toBe(9_500);
    const settlement = result.financialLedger.all.filter(
      (e) => e.categoryId === FOREIGN_SETTLEMENT_CATEGORY_ID,
    );
    expect(settlement).toHaveLength(2);
    expect(settlement.map((e) => e.nationId).sort()).toEqual([BUILDER, ORDERING].sort());
    expect(
      settlement.every((e) => (e.debit as number) === 500 && (e.credit as number) === 500),
    ).toBe(true);
    // The ledger's settled balance is the committed treasury.
    expect(settlement.find((e) => e.nationId === ORDERING)!.newBalance as number).toBe(10_500);
    expect(settlement.find((e) => e.nationId === BUILDER)!.newBalance as number).toBe(9_500);

    // The settlement is posted exactly once. The next month is given a NON-ZERO construction cap (baseResources),
    // so the ordinary appropriation WOULD fund and reactivate the hull if the IMPOUNDED terminal skip were missing;
    // it must instead stay in custody and move no money.
    const next = new MonthExecutor().execute(
      {
        ...result.finalSnapshot,
        turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt(1)),
        nations: new Map(result.finalSnapshot.nations).set(ORDERING, {
          ...result.finalSnapshot.nations.get(ORDERING)!,
          baseResources: SafeInt(1_200_000),
        }),
      },
      [],
      `settle-seed-${String(seed)}-next`,
      new DiagnosticCollector(),
      undefined,
      { shipBuilding: content },
    );
    const held = next.finalSnapshot.nations
      .get(ORDERING)!
      .constructionProjects.find((p) => p.foreignContractId !== undefined);
    expect(held?.status).toBe("IMPOUNDED");
    expect(next.finalSnapshot.nations.get(ORDERING)!.treasury as number).toBe(10_500);
    expect(next.finalSnapshot.nations.get(BUILDER)!.treasury as number).toBe(9_500);
    expect(
      next.financialLedger.all.filter((e) => e.categoryId === FOREIGN_SETTLEMENT_CATEGORY_ID),
    ).toHaveLength(0);
  });

  it("clamps the compensation to the builder's means and never writes a negative balance", () => {
    // Builder holds only 100 of the 500 paid: it returns 100, the rest is forfeited; ordering 10,000 -> 10,100.
    const partial = impoundOnce(100);
    expect(partial.result.finalSnapshot.nations.get(ORDERING)!.treasury as number).toBe(10_100);
    expect(partial.result.finalSnapshot.nations.get(BUILDER)!.treasury as number).toBe(0);
    const partialEntries = partial.result.financialLedger.all.filter(
      (e) => e.categoryId === FOREIGN_SETTLEMENT_CATEGORY_ID,
    );
    expect(
      partialEntries.every((e) => (e.debit as number) === 100 && (e.credit as number) === 100),
    ).toBe(true);

    // A penniless builder returns nothing: no settlement entries, no negative treasury, ordering unchanged.
    const none = impoundOnce(0);
    expect(none.result.finalSnapshot.nations.get(ORDERING)!.treasury as number).toBe(10_000);
    expect(none.result.finalSnapshot.nations.get(BUILDER)!.treasury as number).toBe(0);
    expect(
      none.result.financialLedger.all.filter(
        (e) => e.categoryId === FOREIGN_SETTLEMENT_CATEGORY_ID,
      ),
    ).toHaveLength(0);
  });
});
