// SB3-R18/R19 (DESIGN-16 sections 7-9): the compiled capacity utilisation readout splits the non-exempt mass that
// competes with the cap from the exempt AMC/small-corvette share layered outside it. Every number is derived — never
// authored by a UI.
import type { CampaignSnapshot, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { HULL_TYPE_FOR_SHIP_TYPE } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import {
  constructionCapacityUtilization,
  nationalConstructionCapacity,
  type NationalConstructionCapacity,
} from "../src/index.js";
import { makeBattleSnapshot, makeDesign, makeNation } from "./battle-fixtures.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const MONTH_ID = "1880-01";
const UK_DOCK = 13_000_000;
const profileContent = productionShipBuildingContent({ navalProfiles: true });

type Design = CampaignSnapshot["designs"] extends Map<string, infer D> ? D : never;

const design = (id: string, hullType: string, displacementKg: number): Design => ({
  ...makeDesign(id, "uk"),
  hullType,
  normalizedDisplacementKg: SafeInt(displacementKg),
});

const project = (
  id: string,
  designVersionId: string,
  over: Partial<ConstructionProject> = {},
): ConstructionProject => ({
  id,
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: id,
  designVersionId,
  totalWork: SafeInt(100),
  completedWork: SafeInt(0),
  paidWork: SafeInt(0),
  status: "ACTIVE",
  startedAt: MONTH_ID,
  ...over,
});

function snapshot(designs: readonly Design[], projects: ConstructionProject[] = []) {
  const base = makeBattleSnapshot({ areas: ["a-1"], wars: [] });
  const uk = { ...makeNation("uk", []), constructionProjects: projects };
  return {
    ...base,
    nations: new Map([["uk", uk]]),
    designs: new Map(designs.map((d) => [d.designVersionId, d])),
  } as CampaignSnapshot;
}

const capacity = (
  content = profileContent,
  dockMaxMassKg = UK_DOCK,
): NationalConstructionCapacity =>
  nationalConstructionCapacity(content.environmentFor(MONTH_ID).constructionBalance, dockMaxMassKg);

/** Content whose construction balance is overridden, so the exemption split can be exercised directly. */
function withCapacityBalance(overrides: { amcCapacityExemptionBp?: number }) {
  const base = profileContent;
  return {
    ...base,
    environmentFor: (month: string, nationId?: string) => {
      const env = base.environmentFor(month, nationId);
      return { ...env, constructionBalance: { ...env.constructionBalance, ...overrides } };
    },
  };
}

describe("constructionCapacityUtilization (SB3-R18/R19)", () => {
  it("splits committed normal-pool mass from the exempt AMC share", () => {
    // The shipped AMC exemption is 80%: a 10,000,000 kg AMC reserves 2,000,000 normal and leaves 8,000,000 exempt.
    const snap = snapshot(
      [
        design("dv-amc", HULL_TYPE_FOR_SHIP_TYPE.AMC, 10_000_000),
        design("dv-b", "pre_dreadnought", 5_000_000),
      ],
      [
        // The stored reservation (1,500,000) deliberately differs from the design-derived AMC reservation
        // (2,000,000), so the committed share proves it reads the STORED value while the exempt share recomputes.
        project("con-amc", "dv-amc", { newConstructionReservedMassKg: 1_500_000 }),
        project("con-b", "dv-b", { newConstructionReservedMassKg: 5_000_000 }),
      ],
    );
    const util = constructionCapacityUtilization(snap, "uk", capacity());
    expect(util.maxConcurrentMassKg).toBe(capacity().maxConcurrentMassKg);
    // 1,500,000 (stored AMC reservation) + 5,000,000 (ordinary) compete with the cap.
    expect(util.committedMassKg).toBe(6_500_000);
    // 8,000,000 (AMC exempt share) sits outside it.
    expect(util.exemptMassKg).toBe(8_000_000);
  });

  it("reserves zero normal capacity for a fully-exempt AMC, which is then wholly exempt", () => {
    const snap = snapshot(
      [design("dv-amc", HULL_TYPE_FOR_SHIP_TYPE.AMC, 10_000_000)],
      [project("con-amc", "dv-amc")],
    );
    const util = constructionCapacityUtilization(
      snap,
      "uk",
      capacity(withCapacityBalance({ amcCapacityExemptionBp: 10_000 })),
    );
    expect(util.committedMassKg).toBe(0);
    expect(util.exemptMassKg).toBe(10_000_000);
  });

  it("reports zeros for a nation with no non-terminal projects, and for a nation absent from the snapshot", () => {
    const empty = constructionCapacityUtilization(
      snapshot([design("dv-b", "battleship", 1)]),
      "uk",
      capacity(),
    );
    expect(empty).toEqual({
      maxConcurrentMassKg: capacity().maxConcurrentMassKg,
      committedMassKg: 0,
      exemptMassKg: 0,
    });

    const absent = constructionCapacityUtilization(
      snapshot([design("dv-b", "battleship", 1)]),
      "france",
      capacity(),
    );
    expect(absent.committedMassKg).toBe(0);
    expect(absent.exemptMassKg).toBe(0);
  });

  it("excludes terminal and REFIT_REBUILD projects from both shares", () => {
    const snap = snapshot(
      [
        design("dv-amc", HULL_TYPE_FOR_SHIP_TYPE.AMC, 10_000_000),
        design("dv-b", "pre_dreadnought", 5_000_000),
      ],
      [
        project("con-done", "dv-amc", { status: "COMPLETED" }),
        project("con-rebuild", "dv-b", { projectType: "REBUILD" }),
      ],
    );
    const util = constructionCapacityUtilization(snap, "uk", capacity());
    expect(util.committedMassKg).toBe(0);
    expect(util.exemptMassKg).toBe(0);
  });

  it("never counts a foreign-contract project against the ordering nation's shares", () => {
    // A foreign project is built and funded by its builder (DESIGN-16 section 13.3); its displacement must not appear
    // in the ordering nation's exemption readout even though its status is `NEW_CONSTRUCTION`.
    const snap = snapshot(
      [design("dv-amc", HULL_TYPE_FOR_SHIP_TYPE.AMC, 10_000_000)],
      [
        project("con-foreign", "dv-amc", {
          foreignContractId: "fc-1",
          newConstructionReservedMassKg: 0,
        }),
      ],
    );
    const util = constructionCapacityUtilization(snap, "uk", capacity());
    expect(util.committedMassKg).toBe(0);
    expect(util.exemptMassKg).toBe(0);
  });
});
