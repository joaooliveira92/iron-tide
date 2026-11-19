import {
  TerrainAreaSchema,
  decodeTerrainRules,
  validateAgainstSchema,
  type TerrainArea,
  type TerrainPolygonSource,
  type TerrainRules,
  type TerrainVertex,
} from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

import type { ParseOutput } from "./parse.js";
import { interiorsOverlap, selfIntersection, signedArea2 } from "./terrainGeometry.js";

export interface TerrainValidated {
  readonly rules: TerrainRules;
  readonly areas: readonly TerrainArea[];
}

const STAGE = "validate";

function fail(
  collector: DiagnosticCollector,
  code: string,
  message: string,
  remediation: string,
): void {
  collector.addError(code, message, {
    stage: STAGE,
    sourceLocation: { path: "terrain.ts", line: 1 },
    remediation,
  });
}

function rulesFrom(rulesets: readonly unknown[], collector: DiagnosticCollector) {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["terrain"] !== undefined,
  );
  if (carriers.length > 1) {
    fail(
      collector,
      "TERRAIN-RULES-DUPLICATE",
      `More than one ruleset carries a terrain section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      "Keep the terrain section in a single ruleset",
    );
    return undefined;
  }
  const carrier = carriers[0] as Record<string, unknown> | undefined;
  if (carrier === undefined) return undefined;
  const decoded = decodeTerrainRules(carrier["terrain"]);
  if (decoded.ok) return decoded.value;
  fail(
    collector,
    "TERRAIN-RULES-INVALID",
    `Ruleset '${String(carrier["id"])}' terrain section is invalid at '${decoded.field}': ${decoded.message}`,
    "Author every terrain ruleset value, or remove the section and the terrain collection",
  );
  return undefined;
}

function validatePolygons(
  area: TerrainArea,
  rules: TerrainRules,
  collector: DiagnosticCollector,
): void {
  const where = `terrain area '${area.areaId}'`;
  const { box } = area;
  if (box.minXM >= box.maxXM || box.minYM >= box.maxYM) {
    fail(
      collector,
      "TERRAIN-BOX-EMPTY",
      `${where} has an empty box`,
      "Give the box a positive width and height in metres",
    );
  }
  const inBox = (v: TerrainVertex) =>
    v.xM >= box.minXM && v.xM <= box.maxXM && v.yM >= box.minYM && v.yM <= box.maxYM;
  const seen = new Set<string>();
  for (const polygon of area.polygons) {
    const label = `${where} polygon '${polygon.id}'`;
    if (seen.has(polygon.id)) {
      fail(collector, "TERRAIN-DUPLICATE-POLYGON", `${label} is declared twice`, "Rename it");
    }
    seen.add(polygon.id);
    if (polygon.vertices.length > rules.maxVerticesPerPolygon) {
      fail(
        collector,
        "TERRAIN-VERTEX-CAP",
        `${label} has ${polygon.vertices.length} vertices, above the cap of ${rules.maxVerticesPerPolygon}`,
        "Simplify the outline or split the polygon",
      );
    }
    if (!polygon.vertices.every(inBox)) {
      fail(
        collector,
        "TERRAIN-OUTSIDE-BOX",
        `${label} has a vertex outside the area box`,
        "Move the vertex inside the box or widen the box",
      );
    }
    const intersection = selfIntersection(polygon.vertices);
    if (intersection !== undefined) {
      fail(
        collector,
        "TERRAIN-SELF-INTERSECTION",
        `${label} is not a simple polygon: ${intersection}`,
        "Redraw the outline without crossings",
      );
    } else if (signedArea2(polygon.vertices) <= 0) {
      fail(
        collector,
        "TERRAIN-NOT-COUNTER-CLOCKWISE",
        `${label} is not counter-clockwise`,
        "List the vertices counter-clockwise; the compiler never reverses them",
      );
    }
  }
  if (!inBox(area.battleOrigin)) {
    fail(
      collector,
      "TERRAIN-ORIGIN-OUTSIDE-BOX",
      `${where} battle origin lies outside the area box`,
      "Move the battle origin inside the box or widen the box",
    );
  }
  for (const base of area.bases) {
    if (!inBox(base)) {
      fail(
        collector,
        "TERRAIN-OUTSIDE-BOX",
        `${where} base '${base.portId}' lies outside the area box`,
        "Move the base inside the box or widen the box",
      );
    }
  }
}

function validateOverlap(area: TerrainArea, collector: DiagnosticCollector): void {
  const land = area.polygons.filter((p: TerrainPolygonSource) => p.layer === "LAND");
  const shallows = area.polygons.filter((p: TerrainPolygonSource) => p.layer === "SHALLOWS");
  for (const l of land) {
    for (const s of shallows) {
      if (interiorsOverlap(l.vertices, s.vertices)) {
        fail(
          collector,
          "TERRAIN-LAND-OVER-SHALLOWS",
          `terrain area '${area.areaId}' LAND '${l.id}' overlaps SHALLOWS '${s.id}' (LAND wins)`,
          "Trim the shallows so they only touch the coast",
        );
      }
    }
  }
}

export function validateTerrain(
  input: ParseOutput,
  rulesets: readonly unknown[],
  areas: readonly unknown[],
  ports: readonly unknown[],
  collector: DiagnosticCollector,
): TerrainValidated | undefined {
  const raw = input.collectionDocs.get("terrain") ?? [];
  if (raw.length === 0) return undefined;
  const rules = rulesFrom(rulesets, collector);
  if (rules === undefined) {
    if (!collector.hasErrors) {
      fail(
        collector,
        "TERRAIN-RULES-MISSING",
        "The terrain collection has records but no ruleset carries a terrain section",
        "Add the terrain section (exclusion radius, vertex cap) to a ruleset",
      );
    }
    return undefined;
  }
  const knownAreas = new Set(areas.map((a) => String((a as Record<string, unknown>)["id"])));
  const portAreas = new Map(
    ports.map((p) => [
      String((p as Record<string, unknown>)["id"]),
      String((p as Record<string, unknown>)["areaId"]),
    ]),
  );
  const decoded: TerrainArea[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const area = validateAgainstSchema(
      item,
      TerrainAreaSchema,
      "TerrainArea",
      "terrain.ts",
      collector,
    );
    if (area === undefined) continue;
    if (seen.has(area.areaId)) {
      fail(
        collector,
        "TERRAIN-DUPLICATE-AREA",
        `terrain area '${area.areaId}' is declared twice`,
        "Keep one record per area",
      );
      continue;
    }
    seen.add(area.areaId);
    if (!knownAreas.has(area.areaId)) {
      fail(
        collector,
        "TERRAIN-UNKNOWN-AREA",
        `terrain area '${area.areaId}' is not a declared area`,
        "Use an area id from areas.ts",
      );
    }
    const baseIds = new Set<string>();
    for (const base of area.bases) {
      if (baseIds.has(base.portId)) {
        fail(
          collector,
          "TERRAIN-DUPLICATE-BASE",
          `terrain area '${area.areaId}' places port '${base.portId}' twice`,
          "Place each port once",
        );
      }
      baseIds.add(base.portId);
      const portArea = portAreas.get(base.portId);
      if (portArea === undefined) {
        fail(
          collector,
          "TERRAIN-UNKNOWN-PORT",
          `terrain area '${area.areaId}' places unknown port '${base.portId}'`,
          "Use a port id from ports.ts",
        );
      } else if (portArea !== area.areaId) {
        fail(
          collector,
          "TERRAIN-PORT-AREA-MISMATCH",
          `port '${base.portId}' belongs to area '${portArea}', not '${area.areaId}'`,
          "Place the base in its own area's record",
        );
      }
    }
    validatePolygons(area, rules, collector);
    validateOverlap(area, collector);
    decoded.push(area);
  }
  return { rules, areas: decoded };
}
