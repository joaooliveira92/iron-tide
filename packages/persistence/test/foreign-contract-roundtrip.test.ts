// INC-9 (SB3-R20/R22): a foreign construction contract and a foreign project survive the save/load boundary, and the
// state hash is unchanged. Mirrors the nation-dock round-trip pattern (ADR-0135).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CampaignSnapshot,
  CampaignState,
  ConstructionProject,
  ForeignConstructionContract,
  NationState,
} from "@bluewave/campaign";
import { bp, money, SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { CURRENT_COMPATIBILITY_VERSION } from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";

const contract: ForeignConstructionContract = {
  contractId: "fc-1",
  orderingNationId: "uk",
  builderNationId: "france",
  builderShipyardId: "yard-france-1",
  designVersionId: "dv-1",
  quantity: 2,
  totalWorkPerUnit: 500,
  totalPriceUnits: money(10_000),
  currencyUnit: "treasury_unit",
  paymentSchedule: [
    { dueMonth: "1880-01", amountUnits: money(5_000), workShareBp: bp(5_000) },
    { dueMonth: "1880-04", amountUnits: money(5_000), workShareBp: bp(5_000) },
  ],
  capacityReservationSchedule: [
    { month: "1880-01", reservedMassKg: 10_000_000, pool: "NEW_CONSTRUCTION" },
  ],
  authorizationMonth: "1880-01",
  plannedKeelMonth: "1880-02",
  plannedDeliveryMonth: "1880-08",
  builderCapabilitySnapshotHash: "cap-hash",
  technologyTransferPolicyId: "foreign_construction_insight_v1",
  warDelayPolicyId: "foreign_contract_war_policy_v1",
  impoundmentPolicyId: "foreign_contract_impoundment_v1",
  deliveryGuaranteeClauseId: "NONE",
  occupationDestructionPolicyId: "foreign_contract_occupation_destruction_v1",
  cancellationRefundPolicyId: "foreign_contract_cancellation_refund_v1",
  governingTreatyIds: ["treaty-1"],
  rulesetVersion: "1.0.0",
  formulaVersion: "foreign_construction_contract_v1",
  contractHash: "0".repeat(64),
};

const project: ConstructionProject = {
  id: "project-1",
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: "dv-1",
  designVersionId: "dv-1",
  totalWork: SafeInt(500),
  completedWork: SafeInt(0),
  paidWork: SafeInt(0),
  status: "ACTIVE",
  startedAt: "1880-01",
  newConstructionReservedMassKg: 0,
  foreignContractId: "fc-1",
  foreignBuilderNationId: "france",
  delayReasonCode: "PAYMENT_DEFAULT_DELAYED",
};

function state(): CampaignState {
  const nation: NationState = {
    id: "uk",
    name: "United Kingdom",
    tag: "UK",
    treasury: SafeInt(10000),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
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
    constructionProjects: [project],
    foreignContracts: [contract],
    foreignContractPayments: [{ contractId: "fc-1", paidDueMonths: ["1880-01"] }],
    foreignInsightAwards: [
      {
        contractId: "fc-1",
        milestones: ["DESIGN_STUDY"],
        awardedByFamily: { HULL_CONSTRUCTION: 500 },
      },
    ],
    isPlayable: true,
    isAI: false,
  };
  const snapshot: CampaignSnapshot = {
    version: "1.0.0",
    turnNumber: SafeInt.ONE,
    campaignId: "foreign-contract-roundtrip",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "uk", type: "playable" }],
    world: { areas: [{ id: "area-1", name: "Test Area", type: "sea" }], routes: [], ports: [] },
    nations: new Map([["uk", nation]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "1.0.0",
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
  const envelope = createEnvelope("campaign-snapshot", CURRENT_COMPATIBILITY_VERSION, snapshot);
  const rawHash = sha256Hex(canonicalSerialize({ snapshot, envelope }));
  return { snapshot, envelope, rawHash };
}

describe("foreign construction contract persistence (INC-9)", () => {
  let tmpDir: string;
  let store: SaveStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "persistence-foreign-contract-"));
    store = new SaveStore();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips the contract and the foreign project with an unchanged hash", () => {
    const saved = state();
    store.save(saved, tmpDir);
    const loaded = store.load(tmpDir, new DiagnosticCollector());
    expect(loaded).not.toBeNull();
    const nation = loaded!.snapshot.nations.get("uk")!;
    expect(nation.foreignContracts).toEqual([contract]);
    expect(nation.foreignContractPayments).toEqual([
      { contractId: "fc-1", paidDueMonths: ["1880-01"] },
    ]);
    expect(nation.constructionProjects).toEqual([project]);
    expect(nation.foreignInsightAwards).toEqual([
      {
        contractId: "fc-1",
        milestones: ["DESIGN_STUDY"],
        awardedByFamily: { HULL_CONSTRUCTION: 500 },
      },
    ]);
    expect(loaded!.rawHash).toBe(saved.rawHash);
  });
});
