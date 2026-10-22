import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { HULL_TYPE_FOR_SHIP_TYPE } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { constructionOrderEligibility, MonthExecutor } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot } from "./battle-fixtures.js";
import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

const content = productionShipBuildingContent();
const reference = readReferenceDesignEntries();
const draftOf = (id: string): Record<string, unknown> => ({
  ...reference.find((d) => d.id === id)!.draft,
  nationId: ATTACKER_NATION,
});

const STARTERS = [
  ["B", "alexandra_1877"],
  ["CA", "starter_armoured_cruiser_1880"],
  ["CL", "starter_protected_cruiser_1880"],
  ["DD", "starter_torpedo_gunboat_1880"],
  ["KE", "starter_corvette_1880"],
  ["AMC", "starter_armed_liner_1880"],
] as const;

function snapshotIn(year: number, month = 6): CampaignSnapshot {
  return {
    ...makeBattleSnapshot({ areas: ["a-1"], wars: [] }),
    startYear: year,
    startMonth: month,
  };
}

function submit(
  snapshot: CampaignSnapshot,
  draft: unknown,
  hullType: string,
  id = "des_test",
): CommandEnvelope<CommandBody> {
  return {
    commandId: `sd-${id}`,
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey: `ik-${id}`,
    timestamp: "test",
    body: {
      type: "SubmitDesign",
      nationId: ATTACKER_NATION,
      designVersionId: id,
      designFamilyId: "fam_test",
      className: "Test class",
      hullType,
      machineryType: "locomotive_boiler",
      draft,
    },
  };
}

function run(
  snapshot: CampaignSnapshot,
  commands: CommandEnvelope<CommandBody>[],
  withContent = true,
) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    snapshot,
    commands,
    "design-seed",
    collector,
    undefined,
    withContent ? { shipBuilding: content } : undefined,
  );
  return {
    result,
    collector,
    designs: result.finalSnapshot.designs,
    families: result.finalSnapshot.designFamilies,
  };
}

const withCategory = (id: string, category: string) => {
  const d = draftOf(id) as { requirement: Record<string, unknown> };
  return { ...d, requirement: { ...d.requirement, category } };
};
const rejectedWith = (collector: DiagnosticCollector) =>
  collector.all.filter((x) => x.code === "DESIGN_REJECTED").map((x) => x.message);

describe("ship-type enforcement at the engine boundary (ADR-0088)", () => {
  it.each(STARTERS)("accepts the %s starter design in January 1880", (type, id) => {
    const snapshot = snapshotIn(1880, 1);
    const hull = HULL_TYPE_FOR_SHIP_TYPE[type];
    const { designs, collector } = run(snapshot, [submit(snapshot, draftOf(id), hull)]);
    expect(rejectedWith(collector)).toEqual([]);
    expect(designs.get("des_test")?.hullType).toBe(hull);
  });

  it.each(["BB", "BC", "CV", "CVL", "AV", "SS", "MTB", "TR"])(
    "refuses a %s design at the opening date, leaving the snapshot untouched",
    (type) => {
      const snapshot = snapshotIn(1880, 1);
      const draft = withCategory("alexandra_1877", type);
      const { designs, collector } = run(snapshot, [submit(snapshot, draft, "dreadnought")]);
      expect(designs.has("des_test")).toBe(false);
      expect(rejectedWith(collector)).toHaveLength(1);
      expect(rejectedWith(collector)[0]).toMatch(/SHIP_TYPE_/);
    },
  );

  it("refuses an unregistered ship type without throwing", () => {
    const snapshot = snapshotIn(1880, 1);
    const draft = withCategory("alexandra_1877", "SUPER_BATTLESHIP");
    const { designs, collector } = run(snapshot, [submit(snapshot, draft, "battleship")]);
    expect(designs.has("des_test")).toBe(false);
    expect(rejectedWith(collector)).toEqual([]);
  });

  it("refuses a hull type that does not belong to the design's ship type", () => {
    const snapshot = snapshotIn(1880, 1);
    const corvette = draftOf("starter_corvette_1880");
    const { designs, collector } = run(snapshot, [submit(snapshot, corvette, "battleship")]);
    expect(designs.has("des_test")).toBe(false);
    expect(rejectedWith(collector)[0]).toMatch(
      /hull type 'battleship' does not match ship type 'KE'/,
    );
  });

  it("revalidates a stored design before an order and refuses one the rules no longer allow", () => {
    const snapshot = snapshotIn(1880, 1);
    const { designs, result } = run(snapshot, [
      submit(snapshot, draftOf("starter_torpedo_gunboat_1880"), "destroyer"),
    ]);
    const design = designs.get("des_test")!;
    expect(
      constructionOrderEligibility(result.finalSnapshot, design, content, "1880-01").eligible,
    ).toBe(true);
    const before = constructionOrderEligibility(result.finalSnapshot, design, content, "1870-01");
    expect(before.eligible).toBe(false);
    expect(before.rejections[0]?.code).toBe("DESIGN_REVALIDATION_FAILED");
    expect(
      constructionOrderEligibility(result.finalSnapshot, design, undefined, "1880-01").rejections[0]
        ?.code,
    ).toBe("DESIGN_REVALIDATION_UNAVAILABLE");
  });

  it("limits armed merchant cruisers to their share of the cruiser fleet when an order is placed", () => {
    const snapshot = snapshotIn(1880, 1);
    const { designs, result } = run(snapshot, [
      submit(snapshot, draftOf("starter_armed_liner_1880"), "armed_merchant_cruiser"),
    ]);
    const design = designs.get("des_test")!;
    const nation = result.finalSnapshot.nations.get(ATTACKER_NATION)!;
    const project = (n: number) => ({
      id: `con_${n}`,
      type: "ship" as const,
      projectType: "NEW_CONSTRUCTION" as const,
      targetId: `ship_${n}`,
      designVersionId: "des_test",
      totalWork: 1,
      completedWork: 0,
      paidWork: 0,
      status: "ACTIVE" as const,
      startedAt: "1880-01",
    });
    const withProjects = (n: number): CampaignSnapshot => ({
      ...result.finalSnapshot,
      nations: new Map([
        ...result.finalSnapshot.nations,
        [
          ATTACKER_NATION,
          {
            ...nation,
            fleets: [],
            constructionProjects: Array.from({ length: n }, (_, i) => project(i)) as never,
          },
        ],
      ]),
    });
    expect(constructionOrderEligibility(withProjects(0), design, content, "1880-01").eligible).toBe(
      true,
    );
    expect(constructionOrderEligibility(withProjects(1), design, content, "1880-01").eligible).toBe(
      true,
    );
    const third = constructionOrderEligibility(withProjects(2), design, content, "1880-01");
    expect(third.eligible).toBe(false);
    expect(third.rejections.map((r) => r.code)).toContain("AMC_FLEET_LIMIT_EXCEEDED");
    expect(
      constructionOrderEligibility(withProjects(2), design, content, "1880-01", "con_0").eligible,
    ).toBe(true);
  });
});
