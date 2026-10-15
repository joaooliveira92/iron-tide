// Campaign-compile stage: materialize the world aggregate (areas, routes,
// ports) from the validated content pack, deterministically ordered by id.
import type { ContentPack } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { toSafeInt, toSafeIntOpt, toStr } from "./campaignInput.js";
import type { AreaData, PortData, RouteData, WorldState } from "./state.js";

export function buildWorldState(pack: ContentPack): WorldState {
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

  return { areas, routes, ports };
}
