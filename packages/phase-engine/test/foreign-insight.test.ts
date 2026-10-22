import type {
  CampaignSnapshot,
  ForeignConstructionContract,
  ForeignInsightAwardRecord,
  ResearchState,
  TechnologyProgress,
} from "@bluewave/campaign";
import { bp, money, SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  FOREIGN_INSIGHT_ELIGIBLE_FAMILIES,
  FOREIGN_INSIGHT_PER_FAMILY_CAP_MICRO_POINTS,
  applyForeignInsightAwards,
  applyForeignInsightMilestone,
  buildForeignConstructionContract,
  foreignInsightMilestonesDue,
  placeForeignConstructionOrder,
  resolveForeignInsight,
  type ForeignContractTerms,
} from "../src/index.js";
import { MonthExecutor } from "../src/month.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const ORDERING = "uk";
const BUILDER = "france";
const content = productionShipBuildingContent({ navalProfiles: true });

const ALL_CAPABLE = {
  requiredTechnologySatisfied: true,
  shipyardCapabilitySatisfied: true,
  governmentPermissionSatisfied: true,
  componentSourcingSatisfied: true,
  physicallyCapable: true,
} as const;

function tech(techId: string, investedPoints = 0, completed = false): TechnologyProgress {
  return { techId, investedPoints: SafeInt(investedPoints), completed };
}

function researchState(over: Partial<ResearchState> = {}): ResearchState {
  return {
    nationId: ORDERING,
    technologies: [],
    fieldPriorities: {},
    researchBudget: SafeInt(0),
    activeCandidates: new Map(),
    discoveredTechs: [],
    ...over,
  };
}

function researchWithCandidate(
  familyId: string,
  techId: string,
  over: Partial<ResearchState> = {},
): ResearchState {
  return researchState({
    technologies: [tech(techId)],
    activeCandidates: new Map([[familyId, techId]]),
    ...over,
  });
}

const UNLIMITED = (): undefined => undefined;
const costOf = (cost: number) => (): number => cost;

function terms(over: Partial<ForeignContractTerms> = {}): ForeignContractTerms {
  return {
    builderShipyardId: "yard-france-1",
    quantity: 1,
    totalWorkPerUnit: 1_000,
    totalPriceUnits: money(1_000),
    paymentSchedule: [
      { dueMonth: "1880-01", amountUnits: money(500), workShareBp: bp(5_000) },
      { dueMonth: "1880-04", amountUnits: money(500), workShareBp: bp(5_000) },
    ],
    authorizationMonth: "1880-01",
    plannedKeelMonth: "1880-02",
    plannedDeliveryMonth: "1880-06",
    ...over,
  };
}

function insightContract(over: Partial<ForeignContractTerms> = {}): ForeignConstructionContract {
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

describe("foreign technology insight — milestones and cap (SB3-R24, DESIGN-16 section 13.5)", () => {
  it("awards exactly 500 design-study micro-points per eligible family", () => {
    const research = researchWithCandidate("HULL_CONSTRUCTION", "hc_wrought_iron_hull");
    const resolution = resolveForeignInsight({
      contract: insightContract(),
      milestone: "DESIGN_STUDY",
      research,
      remainingRequirementFor: UNLIMITED,
    });
    expect(resolution.awards).toEqual([
      { familyId: "HULL_CONSTRUCTION", techId: "hc_wrought_iron_hull", microPoints: 500 },
    ]);
    expect(resolution.record).toEqual({
      contractId: "fc-1",
      milestones: ["DESIGN_STUDY"],
      awardedByFamily: { HULL_CONSTRUCTION: 500 },
    });
  });

  it("awards exactly 1,000 construction-observation and 1,500 delivery micro-points", () => {
    const contract = insightContract();
    const research = researchWithCandidate("MACHINERY", "mac_compound_engine");
    const observation = resolveForeignInsight({
      contract,
      milestone: "CONSTRUCTION_OBSERVATION",
      research,
      remainingRequirementFor: UNLIMITED,
    });
    expect(observation.awards[0]!.microPoints).toBe(1_000);
    const delivery = resolveForeignInsight({
      contract,
      milestone: "DELIVERY",
      research,
      remainingRequirementFor: UNLIMITED,
    });
    expect(delivery.awards[0]!.microPoints).toBe(1_500);
  });

  it("caps total insight at exactly 3,000 per family and contract across all three milestones", () => {
    const contract = insightContract();
    let research = researchWithCandidate("GUNNERY", "gun_breech_rifled");
    let record: ForeignInsightAwardRecord | undefined;
    for (const [milestone, points] of [
      ["DESIGN_STUDY", 500],
      ["CONSTRUCTION_OBSERVATION", 1_000],
      ["DELIVERY", 1_500],
    ] as const) {
      const resolution = resolveForeignInsight({
        contract,
        milestone,
        record,
        research,
        remainingRequirementFor: UNLIMITED,
      });
      expect(resolution.awards[0]!.microPoints).toBe(points);
      record = resolution.record;
      research = applyForeignInsightAwards(research, resolution.awards);
    }
    expect(record!.awardedByFamily["GUNNERY"]).toBe(FOREIGN_INSIGHT_PER_FAMILY_CAP_MICRO_POINTS);
    expect(research.technologies[0]!.investedPoints as number).toBe(3_000);
    const repeat = resolveForeignInsight({
      contract,
      milestone: "DELIVERY",
      record,
      research,
      remainingRequirementFor: UNLIMITED,
    });
    expect(repeat.awards).toEqual([]);
    expect(repeat.record).toBe(record);
  });

  it("caps a final award at the family's remaining allowance (exactly at the cap)", () => {
    const record: ForeignInsightAwardRecord = {
      contractId: "fc-1",
      milestones: ["DESIGN_STUDY", "CONSTRUCTION_OBSERVATION"],
      awardedByFamily: { GUNNERY: 2_800 },
    };
    const research = researchWithCandidate("GUNNERY", "gun_breech_rifled");
    const resolution = resolveForeignInsight({
      contract: insightContract(),
      milestone: "DELIVERY",
      record,
      research,
      remainingRequirementFor: UNLIMITED,
    });
    expect(resolution.awards[0]!.microPoints).toBe(200);
    expect(resolution.record!.awardedByFamily["GUNNERY"]).toBe(3_000);
  });

  it("posts micro-points without granting a technology, even when progress reaches cost", () => {
    const research = researchWithCandidate("HULL_CONSTRUCTION", "hc_wrought_iron_hull");
    const resolution = resolveForeignInsight({
      contract: insightContract(),
      milestone: "DELIVERY",
      research,
      remainingRequirementFor: costOf(1_500),
    });
    expect(resolution.awards[0]!.microPoints).toBe(1_500);
    const after = applyForeignInsightAwards(research, resolution.awards);
    expect(after.technologies[0]!.investedPoints as number).toBe(1_500);
    expect(after.technologies[0]!.completed).toBe(false);
    expect(after.discoveredTechs).toEqual([]);
    expect(after.activeCandidates).toEqual(research.activeCandidates);
    expect(after.fieldPriorities).toEqual(research.fieldPriorities);
    expect(after.technologies[0]).toEqual({
      techId: research.technologies[0]!.techId,
      investedPoints: SafeInt(1_500),
      completed: research.technologies[0]!.completed,
    });
  });

  it("does not exceed the technology's remaining research requirement", () => {
    const research = researchWithCandidate("MACHINERY", "mac_compound_engine");
    const limited = resolveForeignInsight({
      contract: insightContract(),
      milestone: "CONSTRUCTION_OBSERVATION",
      research,
      remainingRequirementFor: costOf(300),
    });
    expect(limited.awards[0]!.microPoints).toBe(300);
    const exhausted = resolveForeignInsight({
      contract: insightContract(),
      milestone: "CONSTRUCTION_OBSERVATION",
      research: researchWithCandidate("MACHINERY", "mac_compound_engine", {
        technologies: [tech("mac_compound_engine", 1_000)],
      }),
      remainingRequirementFor: () => 0,
    });
    expect(exhausted.awards).toEqual([]);
    expect(exhausted.record).toBeUndefined();
  });

  it("awards nothing for a technology the ordering nation already knows", () => {
    const discovered = researchWithCandidate("GUNNERY", "gun_breech_rifled", {
      discoveredTechs: ["gun_breech_rifled"],
    });
    expect(
      resolveForeignInsight({
        contract: insightContract(),
        milestone: "DESIGN_STUDY",
        research: discovered,
        remainingRequirementFor: UNLIMITED,
      }).awards,
    ).toEqual([]);
    const completed = researchWithCandidate("GUNNERY", "gun_breech_rifled", {
      technologies: [tech("gun_breech_rifled", 100, true)],
    });
    expect(
      resolveForeignInsight({
        contract: insightContract(),
        milestone: "DESIGN_STUDY",
        research: completed,
        remainingRequirementFor: UNLIMITED,
      }).awards,
    ).toEqual([]);
  });

  it("orders eligible families deterministically and reproduces across runs", () => {
    const research = researchState({
      technologies: [tech("mac_compound_engine"), tech("gun_breech_rifled")],
      activeCandidates: new Map([
        ["MACHINERY", "mac_compound_engine"],
        ["GUNNERY", "gun_breech_rifled"],
      ]),
    });
    const input = {
      contract: insightContract(),
      milestone: "DESIGN_STUDY" as const,
      research,
      remainingRequirementFor: UNLIMITED,
    };
    const first = resolveForeignInsight(input);
    const second = resolveForeignInsight(input);
    expect(first.awards.map((a) => a.familyId)).toEqual(["GUNNERY", "MACHINERY"]);
    expect(first).toEqual(second);
    expect(Object.keys(first.record!.awardedByFamily)).toEqual(["GUNNERY", "MACHINERY"]);
  });

  it("uses the shipped policy's eligible-family list (the canonical research fields)", () => {
    expect(FOREIGN_INSIGHT_ELIGIBLE_FAMILIES).toContain("HULL_CONSTRUCTION");
    expect(FOREIGN_INSIGHT_ELIGIBLE_FAMILIES).toContain("GUNNERY");
    const research = researchState({
      technologies: [tech("hc_wrought_iron_hull"), tech("gun_breech_rifled")],
      activeCandidates: new Map([
        ["HULL_CONSTRUCTION", "hc_wrought_iron_hull"],
        ["GUNNERY", "gun_breech_rifled"],
      ]),
    });
    const resolution = resolveForeignInsight({
      contract: insightContract(),
      milestone: "DESIGN_STUDY",
      research,
      remainingRequirementFor: UNLIMITED,
    });
    expect(resolution.awards.map((a) => a.familyId)).toEqual(["GUNNERY", "HULL_CONSTRUCTION"]);
    expect(resolution.awards.every((a) => a.microPoints === 500)).toBe(true);
  });

  it("awards nothing for an active candidate keyed by a non-field family id", () => {
    const research = researchState({
      technologies: [tech("basic_hull")],
      activeCandidates: new Map([["BASKET_WEAVING", "basic_hull"]]),
    });
    const resolution = resolveForeignInsight({
      contract: insightContract(),
      milestone: "DESIGN_STUDY",
      research,
      remainingRequirementFor: UNLIMITED,
    });
    expect(resolution.awards).toEqual([]);
    expect(resolution.record).toBeUndefined();
  });

  it("awards nothing for a compiled-campaign research state with no active candidates (reachability gap)", () => {
    const compiled = researchState({
      technologies: [tech("hc_wrought_iron_hull"), tech("mac_compound_engine")],
      activeCandidates: new Map(),
    });
    const resolution = resolveForeignInsight({
      contract: insightContract(),
      milestone: "DESIGN_STUDY",
      research: compiled,
      remainingRequirementFor: UNLIMITED,
    });
    expect(resolution.awards).toEqual([]);
    expect(resolution.record).toBeUndefined();
  });

  it("awards nothing for a contract that does not select the insight policy", () => {
    const contract = insightContract({ technologyTransferPolicyId: "NONE" });
    expect(
      resolveForeignInsight({
        contract,
        milestone: "DESIGN_STUDY",
        research: researchWithCandidate("GUNNERY", "gun_breech_rifled"),
        remainingRequirementFor: UNLIMITED,
      }).awards,
    ).toEqual([]);
  });

  it("hashes deterministically and the award record never moves the contract hash", () => {
    const base = insightContract();
    expect(base.contractHash).toMatch(/^[0-9a-f]{64}$/);
    expect(insightContract().contractHash).toBe(base.contractHash);
    expect(
      buildForeignConstructionContract({
        contractId: base.contractId,
        orderingNationId: base.orderingNationId,
        builderNationId: base.builderNationId,
        designVersionId: base.designVersionId,
        terms: terms(),
        reservedMassKg: 5_000_000,
        builderCapabilitySnapshotHash: "cap-hash",
      }).contractHash,
    ).toBe(base.contractHash);
  });
});

describe("foreign insight milestone gates (SB3-R24, DESIGN-16 section 13.5)", () => {
  it("triggers construction-observation exactly at 50% paid work", () => {
    expect(
      foreignInsightMilestonesDue({
        paidWork: 500,
        completedWork: 500,
        totalWork: 1_000,
        completed: false,
      }),
    ).toEqual(["CONSTRUCTION_OBSERVATION"]);
    expect(
      foreignInsightMilestonesDue({
        paidWork: 499,
        completedWork: 499,
        totalWork: 1_000,
        completed: false,
      }),
    ).toEqual([]);
  });

  it("never reports a milestone already recorded, and reports delivery only on completion", () => {
    const record: ForeignInsightAwardRecord = {
      contractId: "fc-1",
      milestones: ["CONSTRUCTION_OBSERVATION"],
      awardedByFamily: { GUNNERY: 1_000 },
    };
    expect(
      foreignInsightMilestonesDue({
        paidWork: 500,
        completedWork: 500,
        totalWork: 1_000,
        completed: false,
        record,
      }),
    ).toEqual([]);
    expect(
      foreignInsightMilestonesDue({
        paidWork: 1_000,
        completedWork: 1_000,
        totalWork: 1_000,
        completed: true,
        record,
      }),
    ).toEqual(["DELIVERY"]);
  });
});

describe("foreign insight integration (SB3-R24, DESIGN-16 section 13.5)", () => {
  function orderingSnapshot(research: ResearchState): CampaignSnapshot {
    const base = makeBattleSnapshot({ areas: ["a-1"], wars: [], turnNumber: 1 });
    return {
      ...base,
      nations: new Map([
        [ORDERING, { ...makeNation(ORDERING, []), research }],
        [BUILDER, makeNation(BUILDER, [])],
      ]),
      designs: new Map([
        ["dv-1", { ...makeDesign("dv-1", ORDERING), normalizedDisplacementKg: SafeInt(5_000_000) }],
      ]),
    } as CampaignSnapshot;
  }

  const order = (snap: CampaignSnapshot, over: Record<string, unknown> = {}) =>
    placeForeignConstructionOrder(
      snap,
      {
        nationId: ORDERING,
        commandId: "cmd-insight",
        designVersionId: "dv-1",
        builderNationId: BUILDER,
        month: { year: 1880, month: 1 },
        terms: terms(),
        capability: ALL_CAPABLE,
        ...over,
      },
      content,
    );

  const invested = (snap: CampaignSnapshot, techId: string): number => {
    const found = snap.nations
      .get(ORDERING)!
      .research.technologies.find((t) => t.techId === techId);
    return found === undefined ? 0 : (found.investedPoints as number);
  };

  it("awards the design-study milestone at order acceptance", () => {
    const before = orderingSnapshot(
      researchWithCandidate("HULL_CONSTRUCTION", "hc_wrought_iron_hull"),
    );
    const result = order(before);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(invested(result.snapshot, "hc_wrought_iron_hull")).toBe(500);
    expect(result.snapshot.nations.get(ORDERING)!.foreignInsightAwards).toEqual([
      {
        contractId: "fc-insight",
        milestones: ["DESIGN_STUDY"],
        awardedByFamily: { HULL_CONSTRUCTION: 500 },
      },
    ]);
    const discovered = result.snapshot.nations.get(ORDERING)!.research.discoveredTechs;
    expect(discovered).toEqual([]);
    expect(invested(before, "hc_wrought_iron_hull")).toBe(0);
  });

  it("awards nothing at acceptance when the family is already known", () => {
    const known = researchWithCandidate("HULL_CONSTRUCTION", "hc_wrought_iron_hull", {
      discoveredTechs: ["hc_wrought_iron_hull"],
    });
    const result = order(orderingSnapshot(known));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(invested(result.snapshot, "hc_wrought_iron_hull")).toBe(0);
    expect(result.snapshot.nations.get(ORDERING)!.foreignInsightAwards).toBeUndefined();
  });

  it("posts construction-observation at 50% paid work and delivery through the monthly step", () => {
    const integrationTerms: ForeignContractTerms = {
      builderShipyardId: "yard-france-1",
      quantity: 1,
      totalWorkPerUnit: 1_000,
      totalPriceUnits: money(1_000),
      paymentSchedule: [
        { dueMonth: "1880-02", amountUnits: money(500), workShareBp: bp(5_000) },
        { dueMonth: "1880-07", amountUnits: money(500), workShareBp: bp(5_000) },
      ],
      authorizationMonth: "1880-02",
      plannedKeelMonth: "1880-03",
      plannedDeliveryMonth: "1880-07",
    };
    const base = orderingSnapshot(
      researchWithCandidate("HULL_CONSTRUCTION", "hc_wrought_iron_hull"),
    );
    const ordered = order(base, { terms: integrationTerms });
    expect(ordered.ok).toBe(true);
    if (!ordered.ok) return;
    expect(invested(ordered.snapshot, "hc_wrought_iron_hull")).toBe(500);
    let snap: CampaignSnapshot = {
      ...ordered.snapshot,
      nations: new Map(ordered.snapshot.nations).set(ORDERING, {
        ...ordered.snapshot.nations.get(ORDERING)!,
        treasury: SafeInt(10_000),
      }),
    };

    const execute = (s: CampaignSnapshot) =>
      new MonthExecutor().execute(s, [], "insight-seed", new DiagnosticCollector(), undefined, {
        shipBuilding: content,
      });
    const advance = (s: CampaignSnapshot): CampaignSnapshot => ({
      ...s,
      turnNumber: SafeInt.add(s.turnNumber, SafeInt(1)),
    });

    const turn1 = execute(snap);
    snap = turn1.finalSnapshot;
    expect(invested(snap, "hc_wrought_iron_hull")).toBe(1_500);
    expect(snap.nations.get(ORDERING)!.foreignInsightAwards).toEqual([
      {
        contractId: "fc-insight",
        milestones: ["DESIGN_STUDY", "CONSTRUCTION_OBSERVATION"],
        awardedByFamily: { HULL_CONSTRUCTION: 1_500 },
      },
    ]);

    for (let turn = 2; turn <= 6; turn++) {
      snap = advance(snap);
      const result = execute(snap);
      snap = result.finalSnapshot;
    }
    expect(invested(snap, "hc_wrought_iron_hull")).toBe(3_000);
    expect(snap.nations.get(ORDERING)!.research.discoveredTechs).toEqual([]);
    expect(snap.nations.get(ORDERING)!.foreignInsightAwards).toEqual([
      {
        contractId: "fc-insight",
        milestones: ["DESIGN_STUDY", "CONSTRUCTION_OBSERVATION", "DELIVERY"],
        awardedByFamily: { HULL_CONSTRUCTION: 3_000 },
      },
    ]);
  });

  it("is deterministic: the same inputs produce the same awards and record", () => {
    const contract = insightContract();
    const research = researchState({
      technologies: [tech("gun_breech_rifled"), tech("mac_compound_engine")],
      activeCandidates: new Map([
        ["MACHINERY", "mac_compound_engine"],
        ["GUNNERY", "gun_breech_rifled"],
      ]),
    });
    const call = () =>
      applyForeignInsightMilestone({
        contract,
        milestone: "DELIVERY",
        research,
        remainingRequirementFor: UNLIMITED,
      });
    const first = call();
    const second = call();
    expect(first.awards).toEqual(second.awards);
    expect(first.record).toEqual(second.record);
    expect(first.research).toEqual(second.research);
    expect(first.awards.map((a) => a.familyId)).toEqual(["GUNNERY", "MACHINERY"]);
    expect(first.awards.map((a) => a.microPoints)).toEqual([1_500, 1_500]);
  });
});
