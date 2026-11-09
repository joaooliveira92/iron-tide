import type { ConstructionProjectQueueEntry } from "@bluewave/campaign-engine";
import type { ConstructionProjectEntry } from "../../shared/construction-contract.js";

export interface RebuildSourceNation {
  readonly fleets: readonly {
    readonly ships: readonly { readonly id: string; readonly name: string }[];
  }[];
  readonly constructionProjects: readonly {
    readonly id: string;
    readonly projectType: string;
    readonly targetShipId?: string | undefined;
  }[];
}

export function withRebuildTargets(
  nation: RebuildSourceNation | undefined,
  entries: readonly ConstructionProjectQueueEntry[],
): ConstructionProjectEntry[] {
  if (nation === undefined) return [...entries];
  const shipNames = new Map(
    nation.fleets.flatMap((fleet) => fleet.ships.map((ship) => [ship.id, ship.name] as const)),
  );
  const rebuilds = new Map(
    nation.constructionProjects.flatMap((project) =>
      project.projectType === "REBUILD" && project.targetShipId !== undefined
        ? [[project.id, project.targetShipId] as const]
        : [],
    ),
  );
  return entries.map((entry) => {
    const shipId = rebuilds.get(entry.projectId);
    return shipId === undefined
      ? entry
      : {
          ...entry,
          rebuild: {
            shipId,
            shipName: shipNames.get(shipId) ?? shipId,
            designVersionId: entry.designVersionId,
          },
        };
  });
}
