// SB3-R20..R22 (DESIGN-16 section 13): the foreign construction contract, the builder-capability gate, the builder's
// capacity consumption and the payment schedule with its one-month grace. Pure engine slice; UI is split to INC-9b.
import type {
  CampaignSnapshot,
  ConstructionProject,
  ForeignConstructionContract,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { EventLedger } from "@bluewave/events";
import { dockRecordFromDefinition, validateForeignBuilderCapability } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import {
  applyBudgetProject,
  applyResumeConstruction,
  applySetAcceleration,
} from "../src/commands.js";
import { applyReviseProject } from "../src/reviseProject.js";
import {
  FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
  FOREIGN_BUILDER_CAPACITY_UNAVAILABLE,
  FOREIGN_BUILDER_NATION_INVALID,
  FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
  FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
  FOREIGN_CONTRACT_HASH_MISMATCH,
  FOREIGN_CONTRACT_PAYMENT_DEFAULT,
  FOREIGN_PAYMENT_CATEGORY_ID,
  FOREIGN_PAYMENT_DEFAULT_DELAYED,
  FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED,
  DELIVERY_GUARANTEE_ACTIVE,
  advanceForeignContractMonth,
  applyForeignPaymentOutcome,
  buildForeignConstructionContract,
  capabilityFailureCode,
  committedNewConstructionMassKg,
  compareForeignConstructionContracts,
  foreignBuilderCommittedMassKg,
  foreignPaymentLedgerEntries,
  foreignUnlockedWork,
  isForeignPaymentDefaultProject,
  isCompleteForeignConstructionContract,
  nationalConstructionCapacity,
  placeForeignConstructionOrder,
  resolveForeignPaymentMonth,
  type ForeignContractTerms,
} from "../src/index.js";
import { FinancialLedger } from "../src/financial-ledger.js";
import { MonthExecutor } from "../src/month.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ navalProfiles: true });
const ORDERING = "uk";
const BUILDER = "france";
const MONTH = { year: 1880, month: 1 };
const MONTH_ID = "1880-01";
// france's authored dock is 12,000,000 kg and the balance's multiple is 30000 bp (3x), so its cap is 36,000,000 kg.
const FRANCE_DOCK_KG = 12_000_000;
const FRANCE_CAP_KG = 36_000_000;

const ALL_CAPABLE = {
  requiredTechnologySatisfied: true,
  shipyardCapabilitySatisfied: true,
  governmentPermissionSatisfied: true,
  componentSourcingSatisfied: true,
  physicallyCapable: true,
} as const;

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

function terms(over: Partial<ForeignContractTerms> = {}): ForeignContractTerms {
  return {
    builderShipyardId: "yard-france-1",
    quantity: 1,
    totalWorkPerUnit: 100,
    totalPriceUnits: 1000,
    paymentSchedule: [
      { dueMonth: "1880-01", amountUnits: 500, workShareBp: 5000 },
      { dueMonth: "1880-04", amountUnits: 500, workShareBp: 5000 },
    ],
    authorizationMonth: "1880-01",
    plannedKeelMonth: "1880-02",
    plannedDeliveryMonth: "1880-06",
    ...over,
  };
}

const order = (snap: CampaignSnapshot, over: Record<string, unknown> = {}) =>
  placeForeignConstructionOrder(
    snap,
    {
      nationId: ORDERING,
      commandId: "cmd-1",
      designVersionId: "dv-1",
      builderNationId: BUILDER,
      month: MONTH,
      terms: terms(),
      capability: ALL_CAPABLE,
      ...over,
    },
    content,
  );

/** A complete contract, used by the payment tests independently of the order path. */
function contractOf(over: Partial<ForeignContractTerms> = {}): ForeignConstructionContract {
  return buildForeignConstructionContract({
    contractId: "fc-1",
    orderingNationId: ORDERING,
    builderNationId: BUILDER,
    designVersionId: "dv-1",
    terms: terms(over),
    reservedMassKg: 5_000_000,
    builderCapabilitySnapshotHash: "cap-hash",
  });
}

const builderCapacity = () => {
  const balance = content.environmentFor(MONTH_ID, BUILDER).constructionBalance;
  return nationalConstructionCapacity(balance, FRANCE_DOCK_KG);
};

describe("builder capability predicates (SB3-R20, DESIGN-16 section 13.2)", () => {
  const dock = dockRecordFromDefinition({
    maximumNewConstructionMassKg: FRANCE_DOCK_KG,
    maximumMajorRepairMassKg: FRANCE_DOCK_KG,
    maximumRebuildMassKg: FRANCE_DOCK_KG,
    maximumConversionMassKg: FRANCE_DOCK_KG,
  });
  const demand = { lengthMm: 0, beamMm: 0, displacementKg: 5_000_000, heaviestKg: 0 };
  const base = {
    demand,
    dock,
    ...ALL_CAPABLE,
    reservedMassKg: 5_000_000,
    availableNewConstructionCapacityKg: FRANCE_CAP_KG,
  };

  it("accepts a fully capable builder with no reasons", () => {
    expect(validateForeignBuilderCapability(base)).toEqual({ satisfied: true, reasons: [] });
  });

  it("accepts a hull exactly at the builder's dock limit (inclusive)", () => {
    const atLimit = { ...base, demand: { ...demand, displacementKg: FRANCE_DOCK_KG } };
    expect(validateForeignBuilderCapability(atLimit).satisfied).toBe(true);
    const over = { ...base, demand: { ...demand, displacementKg: FRANCE_DOCK_KG + 1 } };
    expect(validateForeignBuilderCapability(over)).toMatchObject({
      satisfied: false,
      reasons: [{ code: FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT, field: "DOCK" }],
    });
  });

  it.each([
    ["TECHNOLOGY", { requiredTechnologySatisfied: false }],
    ["SHIPYARD", { shipyardCapabilitySatisfied: false }],
    ["GOVERNMENT", { governmentPermissionSatisfied: false }],
    ["COMPONENTS", { componentSourcingSatisfied: false }],
    ["PHYSICAL", { physicallyCapable: false }],
    ["CAPACITY", { reservedMassKg: FRANCE_CAP_KG + 1 }],
  ])("names the %s predicate when it fails", (field, override) => {
    const result = validateForeignBuilderCapability({ ...base, ...override });
    expect(result.satisfied).toBe(false);
    expect(result.reasons.map((r) => r.field)).toContain(field);
    const expected =
      field === "CAPACITY"
        ? FOREIGN_BUILDER_CAPACITY_UNAVAILABLE
        : FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT;
    expect(result.reasons.every((r) => r.code === expected)).toBe(true);
  });
});

describe("ordering abroad creates one contract (SB3-R20, DESIGN-16 section 13.1)", () => {
  it("records the contract on the ordering nation and a zero-reservation project", () => {
    const before = snapshot();
    const r = order(before);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contract.contractId).toBe("fc-1");
    expect(r.contract.builderNationId).toBe(BUILDER);
    expect(r.contract.orderingNationId).toBe(ORDERING);
    expect(r.contract.contractHash).toMatch(/^[0-9a-f]{64}$/);
    // The stored reservation is zero, so the ordering nation's pool is untouched.
    expect(r.project.newConstructionReservedMassKg).toBe(0);
    expect(r.project.foreignContractId).toBe("fc-1");
    expect(r.project.foreignBuilderNationId).toBe(BUILDER);
    const nation = r.snapshot.nations.get(ORDERING)!;
    expect(nation.foreignContracts).toHaveLength(1);
    expect(nation.foreignContracts![0]).toEqual(r.contract);
    // The input snapshot is untouched (immutability).
    expect(before.nations.get(ORDERING)!.foreignContracts).toBeUndefined();
  });

  it("refuses an order with no contract terms", () => {
    expect(order(snapshot(), { terms: undefined })).toMatchObject({
      ok: false,
      reason: FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
    });
  });

  it("refuses an incomplete contract (empty payment schedule)", () => {
    expect(order(snapshot(), { terms: terms({ paymentSchedule: [] }) })).toMatchObject({
      ok: false,
      reason: FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
    });
  });

  it("refuses a foreign order with no capability and no silent downgrade", () => {
    expect(order(snapshot(), { capability: undefined })).toMatchObject({
      ok: false,
      reason: FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
    });
    expect(
      order(snapshot(), { capability: { ...ALL_CAPABLE, physicallyCapable: false } }),
    ).toMatchObject({
      ok: false,
      reason: FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
    });
  });

  it("refuses a design that does not belong to the ordering nation", () => {
    const foreign = {
      ...snapshot(),
      designs: new Map([["dv-1", makeDesign("dv-1", BUILDER)]]),
    } as CampaignSnapshot;
    expect(order(foreign)).toMatchObject({ ok: false, reason: "DESIGN_NOT_FOR_PLAYER" });
  });

  it("refuses a schedule whose first instalment is due after the authorization month (MEDIUM-5)", () => {
    // A free-work window: nothing is owed at the start of the project. The contract is incomplete.
    const future = order(snapshot(), {
      terms: terms({
        authorizationMonth: "1880-01",
        paymentSchedule: [
          { dueMonth: "1880-04", amountUnits: 500, workShareBp: 5_000 },
          { dueMonth: "1880-08", amountUnits: 500, workShareBp: 5_000 },
        ],
      }),
    });
    expect(future).toMatchObject({ ok: false, reason: FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED });
    // An instalment due exactly at the authorization month is complete.
    expect(
      order(snapshot(), {
        terms: terms({
          authorizationMonth: "1880-04",
          paymentSchedule: [{ dueMonth: "1880-04", amountUnits: 500, workShareBp: 10_000 }],
        }),
      }).ok,
    ).toBe(true);
  });

  it("refuses a self-contract and a builder that is not a nation of the campaign (NIT)", () => {
    expect(order(snapshot(), { builderNationId: ORDERING })).toMatchObject({
      ok: false,
      reason: FOREIGN_BUILDER_NATION_INVALID,
    });
    expect(order(snapshot(), { builderNationId: "atlantis" })).toMatchObject({
      ok: false,
      reason: FOREIGN_BUILDER_NATION_INVALID,
    });
  });
});

describe("foreign construction consumes the builder's capacity (SB3-R21, DESIGN-16 section 13.3)", () => {
  it("leaves the ordering nation's committed pool provably untouched and reduces the builder's", () => {
    const capacity = builderCapacity();
    const before = snapshot();
    expect(committedNewConstructionMassKg(before, ORDERING, capacity)).toBe(0);
    expect(foreignBuilderCommittedMassKg(before, BUILDER, capacity)).toBe(0);

    const r = order(before);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(committedNewConstructionMassKg(r.snapshot, ORDERING, capacity)).toBe(0);
    expect(foreignBuilderCommittedMassKg(r.snapshot, BUILDER, capacity)).toBe(5_000_000);
  });

  it("admits reservations exactly at the builder's cap and rejects the double-sell", () => {
    // 12,000,000 kg each, cap 36,000,000 kg: three contracts land exactly on the cap, a fourth is a double-sell.
    let current = snapshot(FRANCE_DOCK_KG);
    for (const commandId of ["cmd-1", "cmd-2", "cmd-3"]) {
      const r = order(current, { commandId });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      current = r.snapshot;
    }
    expect(foreignBuilderCommittedMassKg(current, BUILDER, builderCapacity())).toBe(FRANCE_CAP_KG);
    const fourth = order(current, { commandId: "cmd-4" });
    expect(fourth).toMatchObject({ ok: false, reason: FOREIGN_BUILDER_CAPACITY_UNAVAILABLE });
  });

  it("orders foreign contracts deterministically by builder nation, shipyard, authorization month, contract id", () => {
    const make = (
      contractId: string,
      builderNationId: string,
      builderShipyardId: string,
      authorizationMonth: string,
    ): ForeignConstructionContract =>
      buildForeignConstructionContract({
        contractId,
        orderingNationId: ORDERING,
        builderNationId,
        designVersionId: "dv-1",
        terms: terms({ builderShipyardId, authorizationMonth }),
        reservedMassKg: 1,
        builderCapabilitySnapshotHash: "h",
      });
    const scrambled = [
      make("fc-d", "z", "beta", "1880-01"),
      make("fc-c", "a", "gamma", "1880-01"),
      make("fc-a", "a", "beta", "1880-02"),
      make("fc-b", "a", "beta", "1880-01"),
    ];
    expect(
      [...scrambled].sort(compareForeignConstructionContracts).map((c) => c.contractId),
    ).toEqual(["fc-b", "fc-a", "fc-c", "fc-d"]);
  });
});

describe("payment schedule and grace (SB3-R22, DESIGN-16 section 13.4)", () => {
  const contract = contractOf();

  it("grants exactly one grace month, then enters the PAYMENT_DEFAULT_DELAYED reason", () => {
    const atDue = resolveForeignPaymentMonth({
      contract,
      campaignMonth: "1880-01",
      paidDueMonths: [],
    });
    expect(atDue).toMatchObject({ paid: false, zeroProgress: true, status: undefined });

    const graceMonth = resolveForeignPaymentMonth({
      contract,
      campaignMonth: "1880-02",
      paidDueMonths: [],
    });
    expect(graceMonth).toMatchObject({ zeroProgress: true, status: undefined });

    const afterGrace = resolveForeignPaymentMonth({
      contract,
      campaignMonth: "1880-03",
      paidDueMonths: [],
    });
    expect(afterGrace).toMatchObject({
      status: "DELAYED",
      delayReasonCode: FOREIGN_PAYMENT_DEFAULT_DELAYED,
      zeroProgress: true,
    });
  });

  it("clears the default when the instalment is paid on the grace month", () => {
    const paid = resolveForeignPaymentMonth({
      contract,
      campaignMonth: "1880-02",
      paidDueMonths: ["1880-01"],
      paidThisMonth: "1880-01",
    });
    expect(paid).toMatchObject({ paid: true, zeroProgress: false, status: undefined });
    expect(paid.postings).toHaveLength(2);
  });

  it("moves the project to DELAYED and records the reason, and stalls until payment", () => {
    const active: ConstructionProject = {
      id: "project-1",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-1",
      designVersionId: "dv-1",
      totalWork: SafeInt(100),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "ACTIVE",
      startedAt: "1880-01",
      foreignContractId: "fc-1",
      foreignBuilderNationId: BUILDER,
    };
    const outcome = resolveForeignPaymentMonth({
      contract,
      campaignMonth: "1880-03",
      paidDueMonths: [],
    });
    const delayed = applyForeignPaymentOutcome(active, outcome);
    expect(delayed.status).toBe("DELAYED");
    expect(delayed.delayReasonCode).toBe(FOREIGN_PAYMENT_DEFAULT_DELAYED);
    // The default is held, not auto-resumed by the ordinary one-month capacity-delay rule.
    expect(isForeignPaymentDefaultProject(delayed)).toBe(true);
  });

  it("posts balanced ledger entries for a paid instalment", () => {
    const installment = contract.paymentSchedule[0]!;
    const entries = foreignPaymentLedgerEntries(contract, installment, {
      campaignMonth: "1880-01",
      phaseId: "appropriation",
      balances: { [ORDERING]: 10_000, [BUILDER]: 1_000 },
    });
    const ledger = new FinancialLedger();
    for (const entry of entries) ledger.append(entry);
    expect(ledger.all).toHaveLength(2);
    expect(ledger.all.every((t) => t.debit === t.credit)).toBe(true);
    expect(ledger.all.map((t) => t.debit as number)).toEqual([500, 500]);
    expect(entries[0]).toMatchObject({
      nationId: ORDERING,
      previousBalance: 10_000,
      newBalance: 9_500,
    });
    expect(entries[1]).toMatchObject({
      nationId: BUILDER,
      previousBalance: 1_000,
      newBalance: 1_500,
    });
  });

  it("unlocks work only for paid instalments' workShareBp, capped at 100% (MEDIUM-3)", () => {
    // Two 5,000 bp instalments: unpaid unlocks nothing, one paid unlocks half, both paid unlock all.
    expect(foreignUnlockedWork(1000, contract, [])).toBe(0);
    expect(foreignUnlockedWork(1000, contract, ["1880-01"])).toBe(500);
    expect(foreignUnlockedWork(1000, contract, ["1880-01", "1880-04"])).toBe(1000);
    // A duplicated/over-100% schedule never unlocks more than the total work.
    const over = buildForeignConstructionContract({
      contractId: "fc-over",
      orderingNationId: ORDERING,
      builderNationId: BUILDER,
      designVersionId: "dv-1",
      terms: terms({
        paymentSchedule: [
          { dueMonth: "1880-01", amountUnits: 100, workShareBp: 9_000 },
          { dueMonth: "1880-04", amountUnits: 100, workShareBp: 9_000 },
        ],
      }),
      reservedMassKg: 1,
      builderCapabilitySnapshotHash: "h",
    });
    expect(foreignUnlockedWork(1000, over, ["1880-01", "1880-04"])).toBe(1000);
  });

  it("never writes a delay reason when the transition is illegal (MINOR-8)", () => {
    const terminal: ConstructionProject = {
      id: "project-done",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-1",
      designVersionId: "dv-1",
      totalWork: SafeInt(100),
      completedWork: SafeInt(100),
      paidWork: SafeInt(100),
      status: "COMPLETED",
      startedAt: "1880-01",
      foreignContractId: "fc-1",
      foreignBuilderNationId: BUILDER,
    };
    const outcome = resolveForeignPaymentMonth({
      contract,
      campaignMonth: "1880-03",
      paidDueMonths: [],
    });
    const applied = applyForeignPaymentOutcome(terminal, outcome);
    expect(applied).toBe(terminal);
    expect(applied.delayReasonCode).toBeUndefined();
    expect(applied.status).toBe("COMPLETED");
  });
});

describe("monthly revalidation seam (SB3-R20, DESIGN-16 section 13.2)", () => {
  it("revalidates the builder's capability and resolves the month's payment together", () => {
    const contract = contractOf();
    const dock = dockRecordFromDefinition({
      maximumNewConstructionMassKg: FRANCE_DOCK_KG,
      maximumMajorRepairMassKg: FRANCE_DOCK_KG,
      maximumRebuildMassKg: FRANCE_DOCK_KG,
      maximumConversionMassKg: FRANCE_DOCK_KG,
    });
    const good = advanceForeignContractMonth({
      contract,
      campaignMonth: "1880-02",
      demand: { lengthMm: 0, beamMm: 0, displacementKg: 5_000_000, heaviestKg: 0 },
      dock,
      conditions: ALL_CAPABLE,
      reservedMassKg: 5_000_000,
      availableNewConstructionCapacityKg: FRANCE_CAP_KG,
      paidDueMonths: [],
    });
    expect(good.capability.satisfied).toBe(true);
    expect(good.payment.zeroProgress).toBe(true);

    const occupied = advanceForeignContractMonth({
      contract,
      campaignMonth: "1880-02",
      demand: { lengthMm: 0, beamMm: 0, displacementKg: 5_000_000, heaviestKg: 0 },
      dock,
      conditions: { ...ALL_CAPABLE, physicallyCapable: false },
      reservedMassKg: 5_000_000,
      availableNewConstructionCapacityKg: FRANCE_CAP_KG,
      paidDueMonths: [],
    });
    expect(occupied.capability.satisfied).toBe(false);
    expect(occupied.capability.reasons.map((r) => r.field)).toContain("PHYSICAL");
  });
});

// INC-9 rework: the payment/grace path is wired into the running monthly pipeline (M1/M2), the contract hash is
// enforced where a stored contract is consumed (M3), a payment default blocks ResumeConstruction (M4), and an
// unresolved builder balance fails the order (Med1).

describe("monthly step integration (M1/M2, DESIGN-16 section 13.4)", () => {
  const INTEGRATION_MONTH = { year: 1880, month: 2 };
  const DUE = "1880-02";
  const TOTAL_WORK = 1000;

  function integrationSnapshot(ukTreasury: number, ukBaseResources: number): CampaignSnapshot {
    const base = makeBattleSnapshot({ areas: ["a-1"], wars: [], turnNumber: 1 });
    const uk = {
      ...makeNation(ORDERING, []),
      treasury: SafeInt(ukTreasury),
      baseResources: SafeInt(ukBaseResources),
      navalAppropriationRateBp: SafeInt(0),
      expenses: SafeInt(0),
    };
    const france = {
      ...makeNation(BUILDER, []),
      treasury: SafeInt(10_000),
      baseResources: SafeInt(0),
      navalAppropriationRateBp: SafeInt(0),
    };
    return {
      ...base,
      slots: [{ nationId: ORDERING, type: "playable" }],
      nations: new Map([
        [ORDERING, uk],
        [BUILDER, france],
      ]),
      designs: new Map([["dv-1", design(5_000_000)]]),
    };
  }

  function integrationTerms(): ForeignContractTerms {
    return {
      builderShipyardId: "yard-france-1",
      quantity: 1,
      totalWorkPerUnit: TOTAL_WORK,
      totalPriceUnits: 1_000,
      // Two 5,000 bp instalments: paying the first unlocks half the work (MEDIUM-3 schedule-driven work), so the
      // project cannot complete on one payment.
      paymentSchedule: [
        { dueMonth: DUE, amountUnits: 500, workShareBp: 5_000 },
        { dueMonth: "1880-07", amountUnits: 500, workShareBp: 5_000 },
      ],
      authorizationMonth: DUE,
      plannedKeelMonth: "1880-03",
      plannedDeliveryMonth: "1880-07",
    };
  }

  function orderedSnapshot(ukTreasury: number, ukBaseResources: number): CampaignSnapshot {
    const result = placeForeignConstructionOrder(
      integrationSnapshot(ukTreasury, ukBaseResources),
      {
        nationId: ORDERING,
        commandId: "cmd-int",
        designVersionId: "dv-1",
        builderNationId: BUILDER,
        month: INTEGRATION_MONTH,
        terms: integrationTerms(),
        capability: ALL_CAPABLE,
      },
      content,
    );
    if (!result.ok) throw new Error(`order failed: ${result.diagnostics.join("; ")}`);
    return result.snapshot;
  }

  const execute = (snap: CampaignSnapshot, collector = new DiagnosticCollector()) =>
    new MonthExecutor().execute(snap, [], "foreign-seed", collector, undefined, {
      shipBuilding: content,
    });

  /** Advance the campaign one turn, optionally rewriting the ordering nation's treasury/base resources. */
  function advance(
    snap: CampaignSnapshot,
    over: { ukTreasury?: number; ukBaseResources?: number } = {},
  ): CampaignSnapshot {
    const withTurn = { ...snap, turnNumber: SafeInt.add(snap.turnNumber, SafeInt(1)) };
    if (over.ukTreasury === undefined && over.ukBaseResources === undefined) return withTurn;
    const uk = withTurn.nations.get(ORDERING)!;
    return {
      ...withTurn,
      nations: new Map(withTurn.nations).set(ORDERING, {
        ...uk,
        ...(over.ukTreasury === undefined ? {} : { treasury: SafeInt(over.ukTreasury) }),
        ...(over.ukBaseResources === undefined
          ? {}
          : { baseResources: SafeInt(over.ukBaseResources) }),
      }),
    };
  }

  const foreignProject = (snap: CampaignSnapshot): ConstructionProject =>
    snap.nations
      .get(ORDERING)!
      .constructionProjects.find((p) => p.foreignContractId !== undefined)!;

  it("drives the real monthly phase into PAYMENT_DEFAULT_DELAYED (zero progress), then pays and resumes", () => {
    // Turn 1 (1880-02, due) and turn 2 (1880-03, grace): the instalment is unpaid, so the project gets zero progress
    // but is not yet delayed; turn 3 (1880-04) is after the shipped one-month grace and enters the default. Turn 1
    // deliberately carries enough `baseResources` for a NON-ZERO construction cap, so the zero progress is the skip
    // fund's doing, not an empty cap (MAJOR-2 falsifiability).
    const turn1 = execute(orderedSnapshot(100, 120_000));
    expect(foreignProject(turn1.finalSnapshot).status).toBe("ACTIVE");
    expect(foreignProject(turn1.finalSnapshot).completedWork as number).toBe(0);
    expect(
      turn1.financialLedger.all.some((e) => e.categoryId === FOREIGN_PAYMENT_CATEGORY_ID),
    ).toBe(false);

    const turn2 = execute(advance(turn1.finalSnapshot));
    expect(foreignProject(turn2.finalSnapshot).completedWork as number).toBe(0);
    expect(foreignProject(turn2.finalSnapshot).status).toBe("ACTIVE");

    const turn3 = execute(advance(turn2.finalSnapshot));
    const delayed = foreignProject(turn3.finalSnapshot);
    expect(delayed.status).toBe("DELAYED");
    expect(delayed.delayReasonCode).toBe(FOREIGN_PAYMENT_DEFAULT_DELAYED);
    expect(delayed.completedWork as number).toBe(0);
    expect(turn3.finalSnapshot.nations.get(ORDERING)!.treasury as number).toBe(100);

    // Turn 4 (1880-05): the ordering treasury now covers the arrears. The instalment is paid, the builder is credited,
    // the default clears, and the paid instalment's workShareBp unlocks half the project's work (INC-9d). No ordinary
    // construction charge is taken on top of the instalment.
    const funded = advance(turn3.finalSnapshot, { ukTreasury: 10_000, ukBaseResources: 120_000 });
    const turn4 = execute(funded);
    const resumed = foreignProject(turn4.finalSnapshot);
    expect(resumed.status).toBe("ACTIVE");
    expect(resumed.delayReasonCode).toBeUndefined();
    expect(resumed.completedWork as number).toBe(TOTAL_WORK / 2);
    expect(turn4.finalSnapshot.nations.get(ORDERING)!.treasury as number).toBe(9_500);
    expect(turn4.finalSnapshot.nations.get(BUILDER)!.treasury as number).toBe(10_500);
    const payments = turn4.financialLedger.all.filter(
      (e) => e.categoryId === FOREIGN_PAYMENT_CATEGORY_ID,
    );
    expect(payments).toHaveLength(2);
    expect(payments.map((e) => e.nationId).sort()).toEqual([BUILDER, ORDERING].sort());
    expect(payments.every((e) => (e.debit as number) === 500 && (e.credit as number) === 500)).toBe(
      true,
    );
    // No ordinary appropriation ledger line was charged for the foreign work.
    expect(
      turn4.financialLedger.all.some(
        (e) => e.categoryId === "APPROPRIATION" && e.nationId === ORDERING,
      ),
    ).toBe(false);
    // The payment record survives so the same instalment is never charged twice.
    expect(turn4.finalSnapshot.nations.get(ORDERING)!.foreignContractPayments).toEqual([
      { contractId: "fc-int", paidDueMonths: [DUE] },
    ]);
  });

  it("keeps an unpaid foreign month at zero progress with a non-zero construction cap (MAJOR-2)", () => {
    // The ordering nation's cap here is `floor(120_000 / 12 / 100) = 100` work units, and its treasury (100) cannot
    // cover the 500 instalment. If the skip filter were removed the ordinary appropriation would fund 100 work, so
    // the `completedWork === 0` assertion is falsifiable.
    const unpaid = execute(orderedSnapshot(100, 120_000));
    expect(foreignProject(unpaid.finalSnapshot).completedWork as number).toBe(0);
    expect(
      unpaid.financialLedger.all.some((e) => e.categoryId === FOREIGN_PAYMENT_CATEGORY_ID),
    ).toBe(false);

    // An identical month whose treasury covers the instalment DOES progress, proving the difference is the payment.
    const paid = execute(orderedSnapshot(10_000, 120_000));
    expect(foreignProject(paid.finalSnapshot).completedWork as number).toBeGreaterThan(0);
    expect(
      paid.financialLedger.all.filter((e) => e.categoryId === FOREIGN_PAYMENT_CATEGORY_ID),
    ).toHaveLength(2);
  });

  it("holds a builder-capability failure in DELAYED through the same month's auto-resume (MAJOR-1)", () => {
    // Order against france's content dock, then shrink the materialised dock so the builder is genuinely incapable
    // on revalidation (the design's displacement exceeds the dock and its free capacity).
    const ordered = orderedSnapshot(100, 120_000);
    const france = ordered.nations.get(BUILDER)!;
    const shrunk: CampaignSnapshot = {
      ...ordered,
      nations: new Map(ordered.nations).set(BUILDER, {
        ...france,
        dock: {
          maximumNewConstructionMassKg: 1_000_000,
          maximumMajorRepairMassKg: 1_000_000,
          maximumRebuildMassKg: 1_000_000,
          maximumConversionMassKg: 1_000_000,
        },
      }),
    };
    const collector = new DiagnosticCollector();
    const turn1 = execute(shrunk, collector);
    const held = foreignProject(turn1.finalSnapshot);
    // Without the capability-delayed exclusion the same-month auto-resume would return this to ACTIVE.
    expect(held.status).toBe("DELAYED");
    expect(held.delayReasonCode).toBe(FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT);
    expect(held.completedWork as number).toBe(0);
    expect(collector.warnings.map((w) => w.code)).toContain(
      FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
    );
  });

  it("clears a builder-capability delay once capability recovers (no stale reason on ACTIVE)", () => {
    const ordered = orderedSnapshot(100, 120_000);
    const france = ordered.nations.get(BUILDER)!;
    const shrunk: CampaignSnapshot = {
      ...ordered,
      nations: new Map(ordered.nations).set(BUILDER, {
        ...france,
        dock: {
          maximumNewConstructionMassKg: 1_000_000,
          maximumMajorRepairMassKg: 1_000_000,
          maximumRebuildMassKg: 1_000_000,
          maximumConversionMassKg: 1_000_000,
        },
      }),
    };
    const failed = execute(shrunk);
    expect(foreignProject(failed.finalSnapshot).status).toBe("DELAYED");
    // Restore the builder's content-derived dock (remove the materialised override); the next month revalidates as
    // capable, the capability delay lifts, and no stale reason is left on the ACTIVE project.
    const restored = advance(failed.finalSnapshot);
    const france2 = restored.nations.get(BUILDER)!;
    const { dock: _dock, ...withoutDock } = france2;
    const recovered: CampaignSnapshot = {
      ...restored,
      nations: new Map(restored.nations).set(BUILDER, withoutDock as typeof france2),
    };
    const turn2 = execute(recovered);
    const resumed = foreignProject(turn2.finalSnapshot);
    expect(resumed.status).toBe("ACTIVE");
    expect(resumed.delayReasonCode).toBeUndefined();
    expect("delayReasonCode" in resumed).toBe(false);
  });

  it("clears the payment default and resumes the project when the instalment is paid (M2)", () => {
    const contract = contractOf();
    const defaulted: ConstructionProject = {
      id: "project-m2",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-1",
      designVersionId: "dv-1",
      totalWork: SafeInt(100),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "DELAYED",
      startedAt: "1880-01",
      foreignContractId: "fc-1",
      foreignBuilderNationId: BUILDER,
      delayReasonCode: FOREIGN_PAYMENT_DEFAULT_DELAYED,
    };
    const paid = resolveForeignPaymentMonth({
      contract,
      campaignMonth: "1880-02",
      paidDueMonths: ["1880-01"],
      paidThisMonth: "1880-01",
    });
    expect(paid).toMatchObject({ paid: true, status: undefined });
    const resumed = applyForeignPaymentOutcome(defaulted, paid, "ACTIVE");
    expect(resumed.status).toBe("ACTIVE");
    expect(resumed.delayReasonCode).toBeUndefined();
    expect("delayReasonCode" in resumed).toBe(false);
    // A resumed project can be funded again; the resume target is the caller's, not hard-coded.
    const waiting = applyForeignPaymentOutcome(defaulted, paid, "AWAITING_CAPACITY");
    expect(waiting.status).toBe("AWAITING_CAPACITY");
  });

  it("flags a tampered stored contract and refuses to consume it (M3)", () => {
    const ordered = orderedSnapshot(10_000, 0);
    const nation = ordered.nations.get(ORDERING)!;
    const contract = nation.foreignContracts![0]!;
    const tampered = { ...contract, totalPriceUnits: contract.totalPriceUnits + 1 };
    const tamperedSnapshot: CampaignSnapshot = {
      ...ordered,
      nations: new Map(ordered.nations).set(ORDERING, { ...nation, foreignContracts: [tampered] }),
    };
    const collector = new DiagnosticCollector();
    const result = execute(tamperedSnapshot, collector);
    expect(collector.errors.map((e) => e.code)).toContain(FOREIGN_CONTRACT_HASH_MISMATCH);
    expect(foreignProject(result.finalSnapshot).completedWork as number).toBe(0);
    expect(
      result.financialLedger.all.some((e) => e.categoryId === FOREIGN_PAYMENT_CATEGORY_ID),
    ).toBe(false);
  });

  it("refuses ResumeConstruction while a foreign payment default holds the project (M4)", () => {
    const base = snapshot();
    const nation = base.nations.get(ORDERING)!;
    const project: ConstructionProject = {
      id: "proj-held",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-1",
      designVersionId: "dv-1",
      totalWork: SafeInt(100),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "DELAYED",
      startedAt: "1880-01",
      delayReasonCode: FOREIGN_PAYMENT_DEFAULT_DELAYED,
    };
    const held: CampaignSnapshot = {
      ...base,
      nations: new Map(base.nations).set(ORDERING, { ...nation, constructionProjects: [project] }),
    };
    const collector = new DiagnosticCollector();
    const next = applyResumeConstruction(
      held,
      { type: "ResumeConstruction", nationId: ORDERING, projectId: "proj-held" },
      collector,
    );
    expect(next).toBe(held);
    expect(collector.errors.map((e) => e.code)).toContain(FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED);
    expect(next.nations.get(ORDERING)!.constructionProjects[0]!.status).toBe("DELAYED");
  });

  it("refuses ResumeConstruction by the persisted default reason even after a halt changed the status (MINOR-6)", () => {
    // `DELAYED -> HALTED` is legal, so a halt would otherwise hide the default (which keyed on `status === DELAYED`).
    const base = snapshot();
    const nation = base.nations.get(ORDERING)!;
    const project: ConstructionProject = {
      id: "proj-halted-default",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-1",
      designVersionId: "dv-1",
      totalWork: SafeInt(100),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "HALTED",
      startedAt: "1880-01",
      foreignContractId: "fc-1",
      foreignBuilderNationId: BUILDER,
      delayReasonCode: FOREIGN_PAYMENT_DEFAULT_DELAYED,
    };
    const snap: CampaignSnapshot = {
      ...base,
      nations: new Map(base.nations).set(ORDERING, { ...nation, constructionProjects: [project] }),
    };
    const collector = new DiagnosticCollector();
    const next = applyResumeConstruction(
      snap,
      { type: "ResumeConstruction", nationId: ORDERING, projectId: "proj-halted-default" },
      collector,
    );
    expect(next).toBe(snap);
    expect(collector.errors.map((e) => e.code)).toContain(FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED);
  });

  it("refuses a domestic budget for a foreign-contract project (no progress without payment)", () => {
    const base = snapshot();
    const nation = base.nations.get(ORDERING)!;
    const project: ConstructionProject = {
      id: "proj-fgn",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "dv-1",
      designVersionId: "dv-1",
      totalWork: SafeInt(100),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "ACTIVE",
      startedAt: "1880-01",
      foreignContractId: "fc-1",
      foreignBuilderNationId: BUILDER,
    };
    const snap: CampaignSnapshot = {
      ...base,
      nations: new Map(base.nations).set(ORDERING, { ...nation, constructionProjects: [project] }),
    };
    const collector = new DiagnosticCollector();
    const next = applyBudgetProject(
      snap,
      { type: "budget_project", nationId: ORDERING, projectId: "proj-fgn", budget: SafeInt(100) },
      "1880-01",
      SafeInt(0),
      () => SafeInt(0),
      new FinancialLedger(),
      new EventLedger(),
      collector,
    );
    expect(next).toBe(snap);
    expect(collector.errors.map((e) => e.code)).toContain(FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE);
  });

  it("fails an order with a CAPACITY reason when the builder's balance cannot be resolved (Med1)", () => {
    const base = snapshot();
    const nation = base.nations.get(BUILDER)!;
    const withDock: CampaignSnapshot = {
      ...base,
      nations: new Map(base.nations).set(BUILDER, {
        ...nation,
        dock: {
          maximumNewConstructionMassKg: FRANCE_DOCK_KG,
          maximumMajorRepairMassKg: FRANCE_DOCK_KG,
          maximumRebuildMassKg: FRANCE_DOCK_KG,
          maximumConversionMassKg: FRANCE_DOCK_KG,
        },
      }),
    };
    // No content: the builder's balance (and therefore its cap) cannot be resolved.
    const result = placeForeignConstructionOrder(
      withDock,
      {
        nationId: ORDERING,
        commandId: "cmd-1",
        designVersionId: "dv-1",
        builderNationId: BUILDER,
        month: MONTH,
        terms: terms(),
        capability: ALL_CAPABLE,
      },
      undefined,
    );
    expect(result).toMatchObject({
      ok: false,
      reason: FOREIGN_BUILDER_CAPACITY_UNAVAILABLE,
    });
    if (!result.ok) expect(result.diagnostics.some((d) => d.startsWith("CAPACITY"))).toBe(true);
  });
});

describe("foreign war effects in the monthly phase (SB3-R23, INC-10)", () => {
  const hostileRelation = (snap: CampaignSnapshot, tension: number): CampaignSnapshot => ({
    ...snap,
    politics: {
      ...snap.politics,
      relations: [
        {
          nationA: ORDERING,
          nationB: BUILDER,
          relation: "at_war",
          tension,
          nap: false,
          since: MONTH_ID,
        },
      ],
    },
  });

  const orderedSnapshot = (over: Partial<ForeignContractTerms> = {}): CampaignSnapshot => {
    const placed = order(snapshot(), { terms: terms(over) });
    if (!placed.ok) throw new Error(`order failed: ${placed.reason}`);
    return placed.snapshot;
  };

  it("holds a guaranteed contract DELAYED rather than impounding it when the parties are enemies", () => {
    const snap = hostileRelation(
      orderedSnapshot({ deliveryGuaranteeClauseId: "treaty_clause_1" }),
      10,
    );
    const result = new MonthExecutor().execute(
      snap,
      [],
      "war-seed",
      new DiagnosticCollector(),
      undefined,
      {
        shipBuilding: content,
      },
    );
    const project = result.finalSnapshot.nations
      .get(ORDERING)!
      .constructionProjects.find((p) => p.foreignContractId !== undefined)!;
    expect(project.status).toBe("DELAYED");
    expect(project.delayReasonCode).toBe(DELIVERY_GUARANTEE_ACTIVE);
    expect(
      result.finalSnapshot.nations.get(ORDERING)!.foreignContractImpoundments ?? [],
    ).toHaveLength(0);
  });

  it("impounds an unguranteed contract when the tension-scaled draw fires, recording the contract", () => {
    // Tension 10 → a 9_000 bp impoundment probability; search the fixed seed space for a drawn outcome so the assertion
    // is deterministic. At least one seed in this range must impound (P(no impound) = 0.1 per seed).
    let impounded = false;
    for (let i = 0; i < 8 && !impounded; i++) {
      const snap = hostileRelation(orderedSnapshot(), 10);
      const result = new MonthExecutor().execute(
        snap,
        [],
        `war-seed-${String(i)}`,
        new DiagnosticCollector(),
        undefined,
        { shipBuilding: content },
      );
      const nation = result.finalSnapshot.nations.get(ORDERING)!;
      const project = nation.constructionProjects.find((p) => p.foreignContractId !== undefined)!;
      expect(["IMPOUNDED", "DELAYED"]).toContain(project.status);
      if (project.status === "IMPOUNDED") {
        impounded = true;
        expect(nation.foreignContractImpoundments ?? []).toHaveLength(1);
        expect(nation.foreignContractImpoundments![0]!.authorizingPredicate).toBe(
          "foreign_contract_war_policy_v1:IMPOUND",
        );
      }
    }
    expect(impounded).toBe(true);
  });
});

describe("DESIGN-16 section 18 reason-code reconciliation (INC-9f)", () => {
  it("the section 18 payment-default name is the alias of the single emitted code", () => {
    expect(FOREIGN_CONTRACT_PAYMENT_DEFAULT).toBe(FOREIGN_PAYMENT_DEFAULT_DELAYED);
  });

  it("a capacity-predicate failure is reported with the dedicated section 18 code", () => {
    const over = validateForeignBuilderCapability({
      demand: { lengthMm: 0, beamMm: 0, displacementKg: 1_000_000, heaviestKg: 0 },
      dock: {
        maximumNewConstructionMassKg: FRANCE_DOCK_KG,
        maximumMajorRepairMassKg: FRANCE_DOCK_KG,
        maximumRebuildMassKg: FRANCE_DOCK_KG,
        maximumConversionMassKg: FRANCE_DOCK_KG,
      },
      requiredTechnologySatisfied: true,
      shipyardCapabilitySatisfied: true,
      governmentPermissionSatisfied: true,
      componentSourcingSatisfied: true,
      physicallyCapable: true,
      reservedMassKg: FRANCE_CAP_KG + 1,
      availableNewConstructionCapacityKg: FRANCE_CAP_KG,
    });
    expect(capabilityFailureCode(over)).toBe(FOREIGN_BUILDER_CAPACITY_UNAVAILABLE);
  });
});

describe("INC-9e foreign-project command guards and monthly hardening", () => {
  it("MINOR-1: a successful non-payment resume clears a stale delay reason", () => {
    const placed = order(snapshot());
    if (!placed.ok) throw new Error("order failed");
    const nation = placed.snapshot.nations.get(ORDERING)!;
    const held = {
      ...placed.project,
      status: "HALTED" as const,
      delayReasonCode: FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
    };
    const withHeld = {
      ...placed.snapshot,
      nations: new Map([
        [ORDERING, { ...nation, constructionProjects: [held] }],
        [BUILDER, placed.snapshot.nations.get(BUILDER)!],
      ]),
    };
    const next = applyResumeConstruction(
      withHeld,
      { type: "ResumeConstruction", nationId: ORDERING, projectId: held.id },
      new DiagnosticCollector(),
    );
    const resumed = next.nations.get(ORDERING)!.constructionProjects[0]!;
    expect(resumed.status).not.toBe("HALTED");
    expect(resumed.delayReasonCode).toBeUndefined();
  });

  it("MINOR-4: a schedule with duplicate due months is not a complete contract", () => {
    const duplicate = buildForeignConstructionContract({
      contractId: "fc-dup",
      orderingNationId: ORDERING,
      builderNationId: BUILDER,
      designVersionId: "dv-1",
      terms: {
        builderShipyardId: "yard-1",
        quantity: 1,
        totalWorkPerUnit: 100,
        totalPriceUnits: 1_000,
        paymentSchedule: [
          { dueMonth: "1880-01", amountUnits: 500, workShareBp: 5_000 },
          { dueMonth: "1880-01", amountUnits: 500, workShareBp: 5_000 },
        ],
        authorizationMonth: "1880-01",
        plannedKeelMonth: "1880-02",
        plannedDeliveryMonth: "1880-06",
      },
      reservedMassKg: 1_000_000,
      builderCapabilitySnapshotHash: "h",
    });
    expect(isCompleteForeignConstructionContract(duplicate)).toBe(false);
  });

  it("MINOR-5: SetAcceleration and ReviseProject refuse a foreign-contract project", () => {
    const placed = order(snapshot());
    if (!placed.ok) throw new Error("order failed");
    const accelCollector = new DiagnosticCollector();
    const accelerated = applySetAcceleration(
      placed.snapshot,
      {
        type: "SetAcceleration",
        nationId: ORDERING,
        projectId: placed.project.id,
        accelerated: true,
      },
      accelCollector,
    );
    expect(accelerated).toBe(placed.snapshot);
    expect(accelCollector.errors.map((e) => e.code)).toContain(FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE);

    const reviseCollector = new DiagnosticCollector();
    const revised = applyReviseProject(
      placed.snapshot,
      {
        type: "ReviseProject",
        nationId: ORDERING,
        projectId: placed.project.id,
        newDesignVersionId: "dv-2",
        draft: {},
      },
      content,
      MONTH_ID,
      reviseCollector,
    );
    expect(revised).toBe(placed.snapshot);
    expect(reviseCollector.errors.map((e) => e.code)).toContain(
      FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
    );
  });
});
