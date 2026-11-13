import type { CampaignSnapshot } from "@bluewave/campaign";
import {
  entityLabelKey,
  type EntityReferenceDto,
  type TurnSummaryEntry,
} from "../shared/turn-message-contract.js";
import { technologyNames } from "./technologyNames.js";

type Resolver = (id: string) => string | undefined;

function projectNames(snapshot: CampaignSnapshot): Map<string, string> {
  const names = new Map<string, string>();
  for (const nation of snapshot.nations.values()) {
    for (const project of nation.constructionProjects) {
      const className = snapshot.designs.get(project.designVersionId)?.className;
      if (className !== undefined) names.set(project.id, className);
    }
  }
  return names;
}

function shipNames(snapshot: CampaignSnapshot): Map<string, string> {
  const names = new Map<string, string>();
  for (const nation of snapshot.nations.values()) {
    for (const fleet of nation.fleets) {
      for (const ship of fleet.ships) names.set(ship.id, ship.name);
    }
  }
  return names;
}

function resolversFor(snapshot: CampaignSnapshot): Partial<Record<string, Resolver>> {
  const technologies = technologyNames();
  const projects = projectNames(snapshot);
  const ships = shipNames(snapshot);
  return {
    technology: (id) => technologies.get(id),
    constructionProject: (id) => projects.get(id),
    ship: (id) => ships.get(id),
  };
}

function referencesIn(summaries: readonly TurnSummaryEntry[]): EntityReferenceDto[] {
  return summaries.flatMap((summary) =>
    summary.messages.flatMap((message) => [
      ...message.subjectRefs,
      ...message.effectRefs.map((effect) => effect.target),
    ]),
  );
}

export function buildEntityLabels(
  snapshot: CampaignSnapshot,
  summaries: readonly TurnSummaryEntry[],
): Readonly<Record<string, string>> {
  const resolvers = resolversFor(snapshot);
  const labels: Record<string, string> = {};
  for (const ref of referencesIn(summaries)) {
    const label = resolvers[ref.type]?.(ref.id);
    if (label !== undefined && label.length > 0) labels[entityLabelKey(ref)] = label;
  }
  return labels;
}
