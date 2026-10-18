// Campaign-compile stage: materialize the world aggregate (areas, routes,
// ports) from the validated content pack, deterministically ordered by id.
import type { ContentPack } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { toSafeInt, toSafeIntOpt, toStr } from "./campaignInput.js";
import type {
  AreaData,
  PortData,
  RouteData,
  TechnologyDefinitionData,
  WorldState,
} from "./state.js";

/** Months from the campaign start (year, month) to January of `year`; never negative. */
function monthsFromStartToYear(year: number, startYear: number, startMonth: number): number {
  return Math.max(0, (year - startYear) * 12 - (startMonth - 1));
}

/**
 * The research catalogue: every pack technology that names a research field and a positive cost. A technology
 * is available from its authored `availabilityMonth`, else from January of its authored `year`, else from the start.
 */
function buildTechnologyCatalogue(
  pack: ContentPack,
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
  pack: ContentPack,
  start: { readonly startYear: number; readonly startMonth: number },
): WorldState {
  const areas: AreaData[] = (pack.areas ?? [])
    .map((a: Record<string, unknown>) => ({
      id: toStr(a["id"], ""),
      name: toStr(a["name"], ""),
      type: (a["type"] as "land" | "sea" | "coastal") ?? "land",
      controller: typeof a["controller"] === "string" ? a["controller"] : undefined,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const routes: RouteData[] = (pack.routes ?? [])
    .map((r: Record<string, unknown>) => ({
      id: toStr(r["id"], ""),
      from: toStr(r["from"], ""),
      to: toStr(r["to"], ""),
      type: (r["type"] as "land" | "sea" | "rail") ?? "land",
      distance: toSafeInt(r["distance"]),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const ports: PortData[] = (pack.ports ?? [])
    .map((p: Record<string, unknown>) => ({
      id: toStr(p["id"], ""),
      name: toStr(p["name"], ""),
      areaId: toStr(p["areaId"], ""),
      nationId: toStr(p["nationId"], ""),
      level: toSafeIntOpt(p["level"], SafeInt(1)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    areas,
    routes,
    ports,
    technologies: buildTechnologyCatalogue(pack, start.startYear, start.startMonth),
  };
}
