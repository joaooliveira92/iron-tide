import type { ExplanationTree } from "@bluewave/events";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { PlayerProjection } from "../src/projection.js";
import { buildPlayerProjection } from "../src/projection.js";
import {
  baseFor,
  fixtureCatalogue,
  fixtureNation,
  fixtureSnapshot,
  fixtureState,
} from "./fixtures.js";

function ship(id: string, hitPoints: number) {
  return {
    id,
    name: id,
    classId: "battleship",
    nationId: "uk",
    locationAreaId: "area-lon",
    designVersionId: "design-uk",
    hitPoints: SafeInt(hitPoints),
    maxHitPoints: SafeInt(hitPoints),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE" as const,
    crewQuality: SafeInt(100),
  };
}

function projectionWith(overrides: Parameters<typeof fixtureNation>[0]): PlayerProjection {
  const uk = fixtureNation(overrides);
  const projection = buildPlayerProjection(
    fixtureState(
      fixtureSnapshot([uk], [], {
        world: { areas: [], routes: [], ports: [], technologies: fixtureCatalogue },
      }),
    ),
    "uk",
    { month: 1, year: 1880 },
  );
  if (projection === undefined) throw new Error("projection missing");
  return projection;
}

function childSum(tree: ExplanationTree): number {
  return (tree.children ?? []).reduce((total, child) => total + Number(child.result), 0);
}

const healthy = {
  id: "uk",
  treasury: SafeInt(500),
  baseResources: baseFor(100),
  expenses: SafeInt(38),
  fleets: [
    {
      id: "fleet-1",
      nationId: "uk",
      name: "Home Fleet",
      locationAreaId: "area-lon",
      ships: [ship("ship-1", 160)],
    },
  ],
  research: {
    nationId: "uk",
    technologies: [],
    fieldPriorities: {},
    researchBudget: SafeInt(5),
    activeCandidates: new Map(),
    discoveredTechs: [],
  },
};

describe("economy explanations", () => {
  it("explains the projected net from the same lines that produce it", () => {
    const projection = projectionWith(healthy);
    const tree = projection.economy.netExplanation;
    expect(tree).toBeDefined();
    expect(tree?.formulaId).toBe("economy_net");
    expect(Number(tree?.result)).toBe(projection.economy.projectedNet);
    expect(projection.economy.projectedNet).toBe(41);
    expect(childSum(tree!)).toBe(projection.economy.projectedNet);
    expect((tree?.children ?? []).map((child) => child.formulaId)).toEqual([
      "economy_net.appropriation",
      "economy_net.obligations",
      "economy_net.maintenance",
      "economy_net.research",
    ]);
  });

  it("walks the treasury forward to the month-end funds it displays", () => {
    const projection = projectionWith(healthy);
    const tree = projection.economy.monthEndExplanation;
    expect(tree).toBeDefined();
    expect(Number(tree?.result)).toBe(projection.economy.monthEndTreasury);
    expect(childSum(tree!)).toBe(projection.economy.monthEndTreasury);
    const treasury = tree?.children?.find(
      (child) => child.formulaId === "economy_month_end.treasury",
    );
    expect(Number(treasury?.result)).toBe(projection.economy.treasury);
    expect(projection.economy.monthEndTreasury).toBe(541);
  });

  it("explains the appropriation from the economic base and the rate", () => {
    const projection = projectionWith(healthy);
    const tree = projection.economy.appropriationExplanation;
    expect(tree).toBeDefined();
    expect(Number(tree?.result)).toBe(projection.economy.monthlyAppropriation);
    expect(tree?.inputs["baseResources"]).toBe(6000);
    expect(Number(tree?.children?.[0]?.result)).toBe(6000);
  });

  it("explains the runway only while the treasury is shrinking", () => {
    const projection = projectionWith({
      ...healthy,
      treasury: SafeInt(30),
      baseResources: baseFor(1),
      expenses: SafeInt(0),
    });
    expect(projection.economy.runwayMonths).toBe(1);
    const tree = projection.economy.runwayExplanation;
    expect(tree).toBeDefined();
    expect(Number(tree?.result)).toBe(projection.economy.runwayMonths);

    const solvent = projectionWith({
      ...healthy,
      treasury: SafeInt(500),
      baseResources: baseFor(200),
    });
    expect(solvent.economy.runwayMonths).toBeUndefined();
    expect(solvent.economy.runwayExplanation).toBeUndefined();
  });
});
