import { SafeInt } from "@bluewave/contracts";
import type { ConstructionPackage } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import {
  buildConstructionDesignCatalog,
  buildConstructionProjectQueue,
  buildConstructionProjectQueueWithReadouts,
  constructionCommandIdForProject,
  constructionProjectIdForCommand,
  projectedConstructionOrderCosts,
} from "../src/construction.js";
import {
  fixtureConstructionProject,
  fixtureDesign,
  fixtureNation,
  fixtureSnapshot,
} from "./fixtures.js";

describe("buildConstructionDesignCatalog", () => {
  it("returns only the player nation's designs, sorted deterministically", () => {
    const snapshot = fixtureSnapshot(
      [fixtureNation({ id: "uk" }), fixtureNation({ id: "germany" })],
      [
        fixtureDesign("germany", "des_b"),
        fixtureDesign("uk", "des_a"),
        fixtureDesign("uk", "des_c"),
        fixtureDesign("france", "des_f", { nationId: "france" }),
      ],
    );
    const catalog = buildConstructionDesignCatalog(snapshot, "uk", 1880);
    expect(catalog.map((d) => d.designId)).toEqual(["des_a", "des_c"]);
  });

  it("derives the friendly display fields from the compiled design", () => {
    const snapshot = fixtureSnapshot(
      [fixtureNation({ id: "uk" })],
      [
        fixtureDesign("uk", "des_gbr_inflexible", {
          className: "Inflexible",
          hullType: "ironclad_turret_ship",
          normalizedDisplacementKg: SafeInt(11_880_000),
          normalizedSpeedUms: SafeInt(8 * 514_444),
          machineryType: "reciprocating_compound",
        }),
      ],
    );
    const [design] = buildConstructionDesignCatalog(snapshot, "uk", 1880);
    expect(design.className).toBe("Inflexible");
    expect(design.available).toBe(true);
    expect(design.shipType).toBe("ironclad");
    expect(design.mass).toBe(11_880);
    expect(design.speed).toBe(8);
    expect(design.machineryType).toBe("reciprocating_compound");
    expect(design.requiredTechnologyIds).toEqual([]);
    expect(design.costBasis).toBe("displacement_formula");
    expect(design.projectedCost).toBeGreaterThan(0);
    expect(design.year).toBe(0);
  });

  it("uses the design family's authored creation month for the vintage year", () => {
    const snapshot = fixtureSnapshot(
      [fixtureNation({ id: "uk" })],
      [fixtureDesign("uk", "des_pw", { designVersionId: "des_pw", designFamilyId: "fam_pw" })],
    );
    snapshot.designFamilies.set("fam_pw", {
      designFamilyId: "fam_pw",
      nationId: "uk",
      rootDesignVersionId: "d_pw",
      memberDesignVersionIds: ["des_pw"],
      familyCreationMonth: "1906-12",
    });
    const [design] = buildConstructionDesignCatalog(snapshot, "uk", 1880);
    expect(design.year).toBe(1906);
    expect(design.available).toBe(false);
    expect(buildConstructionDesignCatalog(snapshot, "uk", 1906)[0]!.available).toBe(true);
  });
});

describe("projectedConstructionOrderCosts", () => {
  it("scales cost and capacity from the design's real displacement", () => {
    const ironclad = fixtureDesign("uk", "des_inflexible", {
      normalizedDisplacementKg: SafeInt(11_880_000),
    });
    expect(projectedConstructionOrderCosts(ironclad)).toEqual({
      projectedCost: 119,
      projectedCapacityUnits: 12,
    });

    const small = makeDesignForCosts(SafeInt(4_000_000));
    expect(projectedConstructionOrderCosts(small).projectedCost).toBe(40);
    expect(projectedConstructionOrderCosts(small).projectedCapacityUnits).toBe(4);
  });
});

describe("buildConstructionProjectQueue", () => {
  it("projects authored starts AND command-queued orders, keyed by project id and sorted deterministically", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "uk",
          constructionProjects: [
            fixtureConstructionProject({
              id: "con_gbr_inflexible",
              designVersionId: "des_gbr_inflexible",
              status: "ACTIVE",
              totalWork: SafeInt(100),
              completedWork: SafeInt(60),
              startedAt: "1880-01",
            }),
            fixtureConstructionProject({
              id: "project-req-1-a1b2c3d4",
              designVersionId: "des_gbr_inflexible",
              status: "PLANNED",
            }),
          ],
        }),
      ],
      [
        fixtureDesign("uk", "des_gbr_inflexible", {
          className: "Inflexible",
          hullType: "ironclad_turret_ship",
        }),
      ],
    );

    const entries = buildConstructionProjectQueue(snapshot, "uk");
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.projectId)).toEqual([
      "con_gbr_inflexible",
      "project-req-1-a1b2c3d4",
    ]);

    const authored = entries.find((e) => e.projectId === "con_gbr_inflexible")!;
    expect(authored.className).toBe("Inflexible");
    expect(authored.shipType).toBe("ironclad");
    expect(authored.status).toBe("ACTIVE");
    expect(authored.totalWork).toBe(100);
    expect(authored.completedWork).toBe(60);
    expect(authored.commandId).toBeNull();

    const queued = entries.find((e) => e.projectId === "project-req-1-a1b2c3d4")!;
    expect(queued.status).toBe("PLANNED");
    expect(queued.commandId).toBe("cmd-req-1-a1b2c3d4");
  });

  it("round-trips the project<->command id pairing used by the desktop commands", () => {
    expect(constructionProjectIdForCommand("cmd-tx-7-abcdef01")).toBe("project-tx-7-abcdef01");
    expect(constructionCommandIdForProject("project-tx-7-abcdef01")).toBe("cmd-tx-7-abcdef01");
    expect(constructionCommandIdForProject("con_gbr_inflexible")).toBeNull();
  });

  it("returns an empty queue for an unknown nation", () => {
    const snapshot = fixtureSnapshot([fixtureNation({ id: "uk" })]);
    expect(buildConstructionProjectQueue(snapshot, "germany")).toEqual([]);
  });
});

function makeDesignForCosts(displacementKg: SafeInt) {
  return fixtureDesign("uk", "des_amphitrite", { normalizedDisplacementKg: displacementKg });
}

describe("projectedConstructionOrderCosts and designed ships", () => {
  const design = (extra: object = {}) =>
    ({ normalizedDisplacementKg: 2_000_000, ...extra }) as unknown as Parameters<
      typeof projectedConstructionOrderCosts
    >[0];
  it("keeps the displacement formula for authored designs", () => {
    expect(projectedConstructionOrderCosts(design()).projectedCost).toBe(20);
  });
  it("uses the design's own price when the ship-design cost model set one", () => {
    expect(
      projectedConstructionOrderCosts(design({ constructionCostUnits: 11 })).projectedCost,
    ).toBe(11);
  });
});

describe("buildConstructionProjectQueue with work packages", () => {
  const pk = (
    id: string,
    kind: "HULL" | "LAUNCH",
    total: number,
    done: number,
    dependsOn: string[] = [],
  ) => ({
    id,
    kind,
    line: "slipway",
    totalWork: SafeInt(total),
    doneWork: SafeInt(done),
    dependsOn,
  });
  const queue = (overrides: Parameters<typeof fixtureConstructionProject>[0]) =>
    buildConstructionProjectQueue(
      fixtureSnapshot(
        [
          fixtureNation({
            id: "uk",
            constructionProjects: [fixtureConstructionProject(overrides)],
          }),
        ],
        [fixtureDesign("uk", "design-1")],
      ),
      "uk",
    )[0]!;

  it("exposes packages in plain numbers, with dependencies copied, and the yard", () => {
    const entry = queue({
      totalWork: SafeInt(10),
      completedWork: SafeInt(4),
      packages: [pk("hull", "HULL", 7, 4), pk("launch", "LAUNCH", 3, 0, ["hull"])],
      yardId: "yard_small",
    });
    expect(entry.packages).toEqual([
      { id: "hull", kind: "HULL", line: "slipway", totalWork: 7, doneWork: 4, dependsOn: [] },
      {
        id: "launch",
        kind: "LAUNCH",
        line: "slipway",
        totalWork: 3,
        doneWork: 0,
        dependsOn: ["hull"],
      },
    ]);
    expect(entry.yardId).toBe("yard_small");
  });

  it("omits both for a project with one work figure", () => {
    const entry = queue({});
    expect("packages" in entry).toBe(false);
    expect("yardId" in entry).toBe(false);
  });
});

describe("construction explanations", () => {
  it("explains the months left from the work remaining and the monthly instalment", () => {
    const pk = (
      id: string,
      kind: ConstructionPackage["kind"],
      total: number,
      done: number,
      dependsOn: string[] = [],
    ) => ({
      id,
      kind,
      line: "slipway",
      totalWork: SafeInt(total),
      doneWork: SafeInt(done),
      dependsOn,
    });
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "uk",
          constructionProjects: [
            fixtureConstructionProject({
              totalWork: SafeInt(10),
              completedWork: SafeInt(4),
              capacityUnits: { slipway: SafeInt(1), quay: SafeInt(1) },
              packages: [pk("hull", "HULL", 7, 4), pk("launch", "LAUNCH", 3, 0, ["hull"])],
            }),
          ],
        }),
      ],
      [fixtureDesign("uk", "design-1")],
    );
    const entry = buildConstructionProjectQueueWithReadouts(snapshot, "uk", "1880-01", null)[0]!;
    expect(entry.readout?.monthlyInstalmentUnits).toBe(1);
    expect(entry.readout?.remainingMonths).toBe(6);
    const tree = entry.readout?.scheduleExplanation;
    expect(Number(tree?.result)).toBe(entry.readout?.remainingMonths);
    expect(tree?.children?.map((child) => Number(child.result))).toEqual([6, 1]);

    const instalment = entry.readout?.instalmentExplanation;
    expect(Number(instalment?.result)).toBe(entry.readout?.monthlyInstalmentUnits);
    expect(instalment?.children?.map((child) => [child.formulaId, Number(child.result)])).toEqual([
      ["construction_instalment.slipway", 1],
    ]);

    const cost = entry.readout?.costExplanation;
    expect(Number(cost?.result)).toBe(entry.readout?.totalCostUnits);
    expect(cost?.children?.map((child) => [child.formulaId, Number(child.result)])).toEqual([
      ["construction_cost.slipway", 10],
    ]);
  });

  it("omits the instalment and cost trees when the project has no package breakdown or draw", () => {
    const snapshot = fixtureSnapshot(
      [
        fixtureNation({
          id: "uk",
          constructionProjects: [
            fixtureConstructionProject({
              totalWork: SafeInt(10),
              completedWork: SafeInt(4),
              capacityUnits: { slipway: SafeInt(1) },
            }),
          ],
        }),
      ],
      [fixtureDesign("uk", "design-1")],
    );
    const entry = buildConstructionProjectQueueWithReadouts(snapshot, "uk", "1880-01", null)[0]!;
    expect(entry.readout?.instalmentExplanation).toBeDefined();
    expect(entry.readout?.costExplanation).toBeUndefined();
  });
});
