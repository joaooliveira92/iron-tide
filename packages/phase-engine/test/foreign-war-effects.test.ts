// SB3-R23 (DESIGN-16 sections 13.6-13.7 and 14; INC-10): the foreign-contract war policy, impoundment and the
// delivery guarantee. These are the pure outcome/predicate tests; the monthly wiring is covered by the phase suite.
import type {
  ConstructionProject,
  ForeignConstructionContract,
  NationState,
} from "@bluewave/campaign";
import { bp, money, SafeInt } from "@bluewave/contracts";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import { describe, expect, it } from "vite-plus/test";
import {
  DELIVERY_GUARANTEE_ACTIVE,
  FOREIGN_CONTRACT_IMPOUNDMENT_NOT_AUTHORIZED,
  FOREIGN_CONTRACT_PHYSICALLY_IMPOSSIBLE,
  FOREIGN_IMPOUNDMENT_MAX_PROBABILITY_BP,
  FOREIGN_IMPOUNDMENT_MIN_TENSION,
  FOREIGN_WAR_OUTCOMES,
  authorizeForeignImpoundment,
  impoundmentProbabilityBp,
  isDeliveryGuaranteeActive,
  resolveForeignWarPolicy,
  type ForeignWarPolicyInput,
} from "../src/foreignWarEffects.js";

const contract = (
  over: Partial<ForeignConstructionContract> = {},
): ForeignConstructionContract => ({
  contractId: "fc-1",
  orderingNationId: "uk",
  builderNationId: "france",
  builderShipyardId: "yard-fr",
  designVersionId: "dv-1",
  quantity: 1,
  totalWorkPerUnit: 1_000,
  totalPriceUnits: money(1_000),
  currencyUnit: "treasury_unit",
  paymentSchedule: [{ dueMonth: "1880-01", amountUnits: money(1_000), workShareBp: bp(10_000) }],
  capacityReservationSchedule: [
    { month: "1880-01", reservedMassKg: 1_000_000, pool: "NEW_CONSTRUCTION" },
  ],
  authorizationMonth: "1880-01",
  plannedKeelMonth: "1880-01",
  plannedDeliveryMonth: "1880-02",
  builderCapabilitySnapshotHash: "h",
  technologyTransferPolicyId: "NONE",
  warDelayPolicyId: "foreign_contract_war_policy_v1",
  impoundmentPolicyId: "foreign_contract_impoundment_v1",
  deliveryGuaranteeClauseId: "NONE",
  occupationDestructionPolicyId: "foreign_contract_occupation_destruction_v1",
  cancellationRefundPolicyId: "foreign_contract_cancellation_refund_v1",
  governingTreatyIds: [],
  rulesetVersion: "1.0.0",
  formulaVersion: "foreign_construction_contract_v1",
  contractHash: "0".repeat(64),
  ...over,
});

const baseInput = (over: Partial<ForeignWarPolicyInput> = {}): ForeignWarPolicyInput => ({
  contract: contract(),
  campaignMonth: "1880-02",
  relation: "neutral",
  tension: 0,
  deliveryGuaranteeActive: false,
  physicallyImpossible: false,
  embargo: false,
  coBelligerent: false,
  builderControllerHostile: false,
  ...over,
});

const project = (status: ConstructionProject["status"]): ConstructionProject => ({
  id: "p1",
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: "dv-1",
  designVersionId: "dv-1",
  totalWork: SafeInt(1_000),
  completedWork: SafeInt(0),
  paidWork: SafeInt(0),
  status,
  startedAt: "1880-01",
  foreignContractId: "fc-1",
  foreignBuilderNationId: "france",
});

const nation = (status: ConstructionProject["status"]): NationState =>
  ({
    prestige: SafeInt(20),
    id: "uk",
    name: "United Kingdom",
    tag: "UK",
    treasury: SafeInt(1_000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: "uk",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [project(status)],
    isPlayable: true,
    isAI: false,
  }) as NationState;

describe("foreign war outcomes (SB3-R23)", () => {
  it("defines exactly the six DESIGN-16 section 13.6 outcomes", () => {
    expect([...FOREIGN_WAR_OUTCOMES].sort()).toEqual([
      "CANCEL_WITH_SETTLEMENT",
      "CONTINUE",
      "DELAY",
      "IMPOUND",
      "PHYSICALLY_IMPOSSIBLE",
      "SUSPEND",
    ]);
  });

  it("physical impossibility wins and a delivery guarantee never overrides it", () => {
    const impossible = resolveForeignWarPolicy(baseInput({ physicallyImpossible: true }));
    expect(impossible.outcome).toBe("PHYSICALLY_IMPOSSIBLE");
    expect(impossible.reasonCode).toBe(FOREIGN_CONTRACT_PHYSICALLY_IMPOSSIBLE);
    const impossibleGuaranteed = resolveForeignWarPolicy(
      baseInput({ physicallyImpossible: true, deliveryGuaranteeActive: true }),
    );
    expect(impossibleGuaranteed.outcome).toBe("PHYSICALLY_IMPOSSIBLE");
    expect(impossibleGuaranteed.guaranteeBlockedImpoundment).toBe(false);
  });

  it("an explicit embargo suspends the contract", () => {
    expect(resolveForeignWarPolicy(baseInput({ embargo: true })).outcome).toBe("SUSPEND");
  });

  it("allied co-belligerents and uninvolved third-party wars continue", () => {
    expect(resolveForeignWarPolicy(baseInput({ relation: "allied" })).outcome).toBe("CONTINUE");
    expect(resolveForeignWarPolicy(baseInput({ coBelligerent: true })).outcome).toBe("CONTINUE");
    expect(resolveForeignWarPolicy(baseInput({ relation: "neutral" })).outcome).toBe("CONTINUE");
  });

  it("a valid delivery guarantee blocks a discretionary impoundment but not physical impossibility", () => {
    const guaranteed = resolveForeignWarPolicy(
      baseInput({ relation: "at_war", tension: 10, deliveryGuaranteeActive: true }),
    );
    expect(guaranteed.outcome).toBe("DELAY");
    expect(guaranteed.reasonCode).toBe(DELIVERY_GUARANTEE_ACTIVE);
    expect(guaranteed.guaranteeBlockedImpoundment).toBe(true);
  });

  it("enemies without a guarantee draw the tension-scaled impoundment, deterministically", () => {
    const draw = (seed: string) =>
      resolveForeignWarPolicy(
        baseInput({ relation: "at_war", tension: 10, randomEngine: new RandomEngine(seed) }),
      );
    const first = draw("war-seed");
    expect(["IMPOUND", "DELAY"]).toContain(first.outcome);
    // The same seed produces the same outcome and draw.
    const second = draw("war-seed");
    expect(second.outcome).toBe(first.outcome);
    expect(second.decision?.draw).toBe(first.decision?.draw);
    // Below the tension floor no discretionary impoundment is drawn at all.
    const calm = resolveForeignWarPolicy(
      baseInput({ relation: "at_war", tension: FOREIGN_IMPOUNDMENT_MIN_TENSION - 1 }),
    );
    expect(calm.outcome).toBe("DELAY");
    expect(calm.decision).toBeUndefined();
  });
});

describe("impoundmentPredicate (SB3-R23)", () => {
  it("is zero below the tension floor and capped at the maximum", () => {
    expect(impoundmentProbabilityBp(0)).toBe(0);
    expect(impoundmentProbabilityBp(FOREIGN_IMPOUNDMENT_MIN_TENSION - 1)).toBe(0);
    expect(impoundmentProbabilityBp(10)).toBe(FOREIGN_IMPOUNDMENT_MAX_PROBABILITY_BP);
  });

  it("treats a non-NONE guarantee clause as active", () => {
    expect(isDeliveryGuaranteeActive(contract())).toBe(false);
    expect(
      isDeliveryGuaranteeActive(contract({ deliveryGuaranteeClauseId: "treaty_clause_1" })),
    ).toBe(true);
  });
});

describe("authorizeForeignImpoundment (SB3-R23)", () => {
  it("refuses a discretionary impoundment without a policy result", () => {
    const resolution = resolveForeignWarPolicy(baseInput()); // CONTINUE
    const result = authorizeForeignImpoundment({
      nation: nation("ACTIVE"),
      projectId: "p1",
      contract: contract(),
      resolution,
      campaignMonth: "1880-02",
      paidAmountUnits: 0,
      custodyNationId: "france",
    });
    expect(result).toMatchObject({
      ok: false,
      reason: FOREIGN_CONTRACT_IMPOUNDMENT_NOT_AUTHORIZED,
    });
  });

  it("authorises an IMPOUND outcome: the project is IMPOUNDED and one causal record is written", () => {
    const resolution = resolveForeignWarPolicy(
      baseInput({ relation: "at_war", tension: 10, randomEngine: new RandomEngine("x") }),
    );
    // Force the authorised outcome regardless of the draw, to test the application path.
    const authorised = { ...resolution, outcome: "IMPOUND" as const };
    const result = authorizeForeignImpoundment({
      nation: nation("ACTIVE"),
      projectId: "p1",
      contract: contract(),
      resolution: authorised,
      campaignMonth: "1880-02",
      paidAmountUnits: 400,
      custodyNationId: "france",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nation.constructionProjects[0]!.status).toBe("IMPOUNDED");
    expect(result.record).toMatchObject({
      contractId: "fc-1",
      custodyNationId: "france",
      legalTitle: "ORDERING_NATION",
      paidAmountUnits: 400,
      unpaidAmountUnits: 600,
      compensationOrForfeiture: "COMPENSATION",
      projectStatus: "IMPOUNDED",
      futureDeliveryEligible: false,
    });
  });

  it("records a draw in the ledger when the impoundment predicate fires", () => {
    const ledger = new RandomLedger();
    resolveForeignWarPolicy(
      baseInput({
        relation: "at_war",
        tension: 10,
        randomEngine: new RandomEngine("ledger-seed"),
        randomLedger: ledger,
      }),
    );
    expect(ledger.all.length).toBe(1);
  });
});
