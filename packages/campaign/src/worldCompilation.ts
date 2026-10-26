import { compareCodePoints } from "@bluewave/deterministic";
import type { ContentPack } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import type {
  AreaData,
  PortData,
  PossessionData,
  RouteData,
  TechnologyDefinitionData,
  WorldState,
} from "./state.js";

type WorldPackSource = Partial<
  Pick<ContentPack, "areas" | "routes" | "ports" | "possessions" | "technologies">
>;

function monthsFromStartToYear(year: number, startYear: number, startMonth: number): number {
  return Math.max(0, (year - startYear) * 12 - (startMonth - 1));
}

function buildTechnologyCatalogue(
  pack: WorldPackSource,
  startYear: number,
  startMonth: number,
): TechnologyDefinitionData[] {
  const catalogue: TechnologyDefinitionData[] = [];
  for (const t of pack.technologies ?? []) {
    if (t.researchFieldId === undefined || t.cost === undefined) continue;
    const availability =
      t.availabilityMonth ??
      (t.year === undefined ? 0 : monthsFromStartToYear(t.year, startYear, startMonth));
    catalogue.push({
      techId: t.id,
      researchFieldId: t.researchFieldId,
      cost: SafeInt(t.cost),
      discoveryWeight: SafeInt(t.discoveryWeight ?? 1),
      prerequisites: (t.prerequisites ?? []).map((p) => p.techId).sort(),
      availabilityMonth: SafeInt(availability),
    });
  }
  return catalogue.sort((a, b) => (a.techId < b.techId ? -1 : a.techId > b.techId ? 1 : 0));
}

export function buildWorldState(
  pack: WorldPackSource,
  start: { readonly startYear: number; readonly startMonth: number },
): WorldState {
  const areas: AreaData[] = [...(pack.areas ?? [])]
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      controller: a.controller,
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));

  const routes: RouteData[] = [...(pack.routes ?? [])]
    .map((r) => ({
      id: r.id,
      from: r.from,
      to: r.to,
      type: r.type,
      distance: SafeInt(r.distance),
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));

  const ports: PortData[] = [...(pack.ports ?? [])]
    .map((p) => ({
      id: p.id,
      name: p.name,
      areaId: p.areaId,
      nationId: p.nationId,
      level: SafeInt(p.level ?? 1),
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));

  const possessions: PossessionData[] = (pack.possessions ?? [])
    .map((p) => ({ id: p.id, nationId: p.nationId, areaId: p.areaId }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    areas,
    routes,
    ports,
    possessions,
    technologies: buildTechnologyCatalogue(pack, start.startYear, start.startMonth),
  };
}
