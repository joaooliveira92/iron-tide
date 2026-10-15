// SB3-R21 / DESIGN-16 section 13.3: the builder's contract-priority policy. Accepted foreign contracts rank after
// legally mandatory domestic work and before new discretionary domestic projects; allocation is deterministic and
// never sells the same capacity twice.
import type { CampaignSnapshot, ForeignConstructionContract } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildForeignConstructionContract } from "../src/foreignConstruction.js";
import {
  FOREIGN_CONTRACT_PRIORITY_DEFERRED,
  FOREIGN_CONTRACT_PRIORITY_POLICY_ID,
  allocateBuilderCapacity,
  foreignContractsCommittedMassKg,
  nationalConstructionCapacity,
  type BuilderCapacityClaim,
} from "../src/newConstructionCapacity.js";
import { constructionOrderEligibility } from "../src/orderEligibility.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ navalProfiles: true });
const MONTH_ID = "1880-01";
const UK = "uk";
const FRANCE = "france";
const UK_DOCK = 13_000_000;
const UK_CAP = 39_000_000; // 3x the uk dock (shipyardCapacityMultipleBp 30000)

const claim = (
  id: string,
  rank: BuilderCapacityClaim["rank"],
  massKg: number,
  tieBreak: readonly (string | number)[] = [],
): BuilderCapacityClaim => ({ id, rank, massKg, tieBreak });

describe("allocateBuilderCapacity (SB3-R21 §13.3)", () => {
  it("is the versioned shipped policy", () => {
    expect(FOREIGN_CONTRACT_PRIORITY_POLICY_ID).toBe("foreign_contract_priority_v1");
  });

  it("allocates mandatory domestic, then accepted foreign, then discretionary domestic", () => {
    const result = allocateBuilderCapacity(
      [
        claim("new-domestic", "DISCRETIONARY_DOMESTIC", 60),
        claim("foreign", "ACCEPTED_FOREIGN_CONTRACT", 50),
        claim("mandatory", "MANDATORY_DOMESTIC", 40),
      ],
      100,
    );
    expect(result.admitted).toEqual(["mandatory", "foreign"]);
    expect(result.deferred).toEqual([
      { id: "new-domestic", reason: FOREIGN_CONTRACT_PRIORITY_DEFERRED },
    ]);
  });

  it("admits a claim exactly on the cap and defers the next", () => {
    const onCap = allocateBuilderCapacity(
      [claim("a", "MANDATORY_DOMESTIC", 60), claim("b", "DISCRETIONARY_DOMESTIC", 40)],
      100,
    );
    expect(onCap.admitted).toEqual(["a", "b"]);
    expect(onCap.deferred).toEqual([]);

    const over = allocateBuilderCapacity(
      [claim("a", "MANDATORY_DOMESTIC", 60), claim("b", "DISCRETIONARY_DOMESTIC", 41)],
      100,
    );
    expect(over.admitted).toEqual(["a"]);
    expect(over.deferred).toEqual([{ id: "b", reason: FOREIGN_CONTRACT_PRIORITY_DEFERRED }]);
  });

  it("breaks ties deterministically by the documented tuple, independent of input order", () => {
    const foreign = (id: string, tieBreak: readonly (string | number)[]) =>
      claim(id, "ACCEPTED_FOREIGN_CONTRACT", 10, tieBreak);
    const scrambled = [
      foreign("fc-d", [FRANCE, "beta", "1880-01", "fc-d"]),
      foreign("fc-c", [FRANCE, "alpha", "1880-02", "fc-c"]),
      foreign("fc-a", [FRANCE, "alpha", "1880-01", "fc-a"]),
      foreign("fc-b", [FRANCE, "alpha", "1880-01", "fc-b"]),
    ];
    // builder nation, shipyard, authorization month, claim id: fc-a, fc-b, fc-c, fc-d.
    const forward = allocateBuilderCapacity(scrambled, 100).admitted;
    const reversed = allocateBuilderCapacity([...scrambled].reverse(), 100).admitted;
    expect(forward).toEqual(["fc-a", "fc-b", "fc-c", "fc-d"]);
    expect(reversed).toEqual(forward);
  });
});

// The committed foreign mass + the domestic order deferral

function contractWith(
  builderNationId: string,
  reservedMassKg: number,
): ForeignConstructionContract {
  return buildForeignConstructionContract({
    contractId: `fc-${builderNationId}`,
    orderingNationId: FRANCE,
    builderNationId,
    designVersionId: "dv-1",
    terms: {
      builderShipyardId: "yard-1",
      quantity: 1,
      totalWorkPerUnit: 100,
      totalPriceUnits: 1000,
      paymentSchedule: [{ dueMonth: MONTH_ID, amountUnits: 1000, workShareBp: 10_000 }],
      authorizationMonth: MONTH_ID,
      plannedKeelMonth: MONTH_ID,
      plannedDeliveryMonth: MONTH_ID,
    },
    reservedMassKg,
    builderCapabilitySnapshotHash: "h",
  });
}

function snapshotWithBuilderContract(
  reservedMassKg: number,
  projectStatus: "ACTIVE" | "COMPLETED" = "ACTIVE",
): CampaignSnapshot {
  const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
  const uk = makeNation(UK, []);
  const france: typeof uk = {
    ...makeNation(FRANCE, []),
    foreignContracts: [contractWith(UK, reservedMassKg)],
    constructionProjects: [
      {
        id: "project-fc-uk",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "dv-1",
        designVersionId: "dv-1",
        totalWork: SafeInt(100),
        completedWork: SafeInt(0),
        paidWork: SafeInt(0),
        status: projectStatus,
        startedAt: MONTH_ID,
        foreignContractId: `fc-${UK}`,
        foreignBuilderNationId: UK,
        newConstructionReservedMassKg: 0,
      },
    ],
  };
  return {
    ...base,
    nations: new Map([
      [UK, uk],
      [FRANCE, france],
    ]),
    designs: new Map([
      ["dv-1", { ...makeDesign("dv-1", UK), normalizedDisplacementKg: SafeInt(5_000_000) }],
    ]),
  } as CampaignSnapshot;
}

describe("foreignContractsCommittedMassKg (SB3-R21 §13.3)", () => {
  it("sums the contracts every nation placed with the given builder, and only those", () => {
    const snap = snapshotWithBuilderContract(7_000_000);
    expect(foreignContractsCommittedMassKg(snap, UK)).toBe(7_000_000);
    expect(foreignContractsCommittedMassKg(snap, FRANCE)).toBe(0);
  });

  it("releases a builder's capacity once the ordering nation's project is terminal", () => {
    expect(
      foreignContractsCommittedMassKg(snapshotWithBuilderContract(7_000_000, "COMPLETED"), UK),
    ).toBe(0);
  });
});

describe("a new discretionary domestic project yields to accepted foreign contracts (§13.3)", () => {
  const capacity = nationalConstructionCapacity(
    content.environmentFor(MONTH_ID, UK).constructionBalance,
    UK_DOCK,
  );

  it("uses the cap on the builder's own dock", () => {
    expect(capacity.maxConcurrentMassKg).toBe(UK_CAP);
  });

  it("defers a domestic order that would over-subscribe a builder holding foreign contracts", () => {
    // 38,000,000 kg of accepted foreign contracts already hold the uk's capacity; a 5,000,000 kg domestic order
    // would exceed the 39,000,000 kg cap, and the discretionary domestic rank yields to them.
    const snap = snapshotWithBuilderContract(38_000_000);
    const design = snap.designs.get("dv-1")!;
    const result = constructionOrderEligibility(snap, design, content, MONTH_ID);
    expect(result.eligible).toBe(false);
    expect(result.rejections.map((r) => r.code)).toContain(FOREIGN_CONTRACT_PRIORITY_DEFERRED);
    expect(result.rejections.map((r) => r.code)).not.toContain("INSUFFICIENT_PROJECT_CAPACITY");
  });

  it("still admits a domestic order when there is no foreign competition (unchanged code)", () => {
    const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
    const snap = {
      ...base,
      nations: new Map([[UK, makeNation(UK, [])]]),
      designs: new Map([
        ["dv-1", { ...makeDesign("dv-1", UK), normalizedDisplacementKg: SafeInt(5_000_000) }],
      ]),
    } as CampaignSnapshot;
    const result = constructionOrderEligibility(snap, snap.designs.get("dv-1")!, content, MONTH_ID);
    expect(result.eligible).toBe(true);
  });

  it("reports the capacity reason, not the priority, when the builder's own work is the binding constraint", () => {
    // uk already has 38,000,000 kg of its OWN domestic work in flight and 1,000,000 kg of foreign contracts; a
    // 5,000,000 kg domestic order exceeds the cap on domestic work alone, so the priority reason would misattribute.
    const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
    const ukOwnProject = {
      id: "project-own",
      type: "ship" as const,
      projectType: "NEW_CONSTRUCTION" as const,
      targetId: "dv-1",
      designVersionId: "dv-1",
      totalWork: SafeInt(100),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "ACTIVE" as const,
      startedAt: MONTH_ID,
      newConstructionReservedMassKg: 38_000_000,
    };
    const withOwn = {
      ...base,
      nations: new Map([
        [UK, { ...makeNation(UK, []), constructionProjects: [ukOwnProject] }],
        [FRANCE, snapshotWithBuilderContract(1_000_000).nations.get(FRANCE)!],
      ]),
      designs: new Map([
        ["dv-1", { ...makeDesign("dv-1", UK), normalizedDisplacementKg: SafeInt(5_000_000) }],
      ]),
    } as CampaignSnapshot;
    const result = constructionOrderEligibility(
      withOwn,
      withOwn.designs.get("dv-1")!,
      content,
      MONTH_ID,
    );
    expect(result.eligible).toBe(false);
    expect(result.rejections.map((r) => r.code)).toContain("INSUFFICIENT_PROJECT_CAPACITY");
    expect(result.rejections.map((r) => r.code)).not.toContain(FOREIGN_CONTRACT_PRIORITY_DEFERRED);
  });
});
