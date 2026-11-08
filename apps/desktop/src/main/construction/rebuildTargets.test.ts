import type { ConstructionProjectQueueEntry } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { withRebuildTargets } from "./rebuildTargets.js";

const entry = (projectId: string, designVersionId: string): ConstructionProjectQueueEntry => ({
  projectId,
  designVersionId,
  className: "Havock class",
  shipType: "destroyer",
  status: "ACTIVE",
  totalWork: 100,
  completedWork: 10,
  paidWork: 10,
  startedAt: "1880-01",
  commandId: null,
  revisable: false,
  holdUntilMonth: null,
  isForeign: false,
});

const nation = {
  fleets: [{ ships: [{ id: "ship-1", name: "HMS Havock" }] }],
  constructionProjects: [
    { id: "p-rebuild", projectType: "REBUILD", targetShipId: "ship-1" },
    { id: "p-new", projectType: "NEW_CONSTRUCTION" },
  ],
};

describe("withRebuildTargets", () => {
  it("marks only rebuild projects with the ship and the new design", () => {
    const [rebuild, fresh] = withRebuildTargets(nation, [
      entry("p-rebuild", "des_new"),
      entry("p-new", "des_other"),
    ]);
    expect(rebuild?.rebuild).toEqual({
      shipId: "ship-1",
      shipName: "HMS Havock",
      designVersionId: "des_new",
    });
    expect(fresh?.rebuild).toBeUndefined();
  });
});
