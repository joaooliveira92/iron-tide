// The canonical-part → legacy `ComponentCategory` adapter (ship-part-model ticket 17a-2,
// ADR-0163 §2). Reads the activated 1880 parts and asserts every supported mapping and every
// failure mode, so the transitional boundary is pinned before the derive starts reading it.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FlattenedPartSchema,
  decodeStrict,
  parseYamlSafe,
  type FlattenedPart,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import { partCategory, partCategoryOrThrow } from "../src/index.js";

const root = join(import.meta.dirname, "..", "..", "..", "content", "production", "1880");
const shipBuilding = join(root, "ship-building");

function readYaml(path: string): Record<string, unknown> {
  const collector = { addError: () => undefined, hasErrors: false } as never;
  const parsed = parseYamlSafe(readFileSync(path, "utf8"), path, collector);
  if (!parsed.success) throw new Error(`bad YAML: ${path}`);
  return parsed.data as Record<string, unknown>;
}

const parts: FlattenedPart[] = readdirSync(join(shipBuilding, "parts"))
  .filter((name) => name.endsWith(".yaml"))
  .flatMap((name) =>
    (readYaml(join(shipBuilding, "parts", name))["parts"] as unknown[]).map((record) =>
      decodeStrict(FlattenedPartSchema, record),
    ),
  );
const byId = new Map(parts.map((p) => [p.id, p] as const));
const first = (family: FlattenedPart["family"]): FlattenedPart => {
  const part = parts.find((p) => p.family === family);
  if (part === undefined) throw new Error(`no part of family '${family}'`);
  return part;
};
const provides = (iface: string): FlattenedPart => {
  const part = parts.find((p) => p.family === "fitting" && p.provides === iface);
  if (part === undefined) throw new Error(`no fitting providing '${iface}'`);
  return part;
};

describe("part → ComponentCategory adapter", () => {
  it("maps a gun to its authored weapon category, never a display label", () => {
    const gun = first("gun");
    expect(gun.family).toBe("gun");
    const category = partCategoryOrThrow(gun);
    expect(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]).toContain(category);
    if (gun.family === "gun") expect(category).toBe(gun.spec.weaponCategory);
  });

  it.each([
    ["torpedo_launcher", "TORPEDO_TUBE"],
    ["ammunition", "AMMUNITION"],
    ["sensor", "RANGEFINDER"],
    ["propulsion_plant", "ENGINE"],
    ["armour_material", "ARMOUR_SCHEME"],
  ] as const)("maps family %s to %s", (family, category) => {
    expect(partCategoryOrThrow(first(family))).toBe(category);
  });

  it.each([
    ["magazine", "MAGAZINE"],
    ["electrical_plant", "GENERATOR"],
    ["accommodation", "ACCOMMODATION"],
    ["damage_control", "DAMAGE_CONTROL"],
    ["funnel", "SPECIAL_EQUIPMENT"],
    ["ventilation", "SPECIAL_EQUIPMENT"],
  ] as const)("maps the %s fitting interface to %s", (iface, category) => {
    expect(partCategoryOrThrow(provides(iface))).toBe(category);
  });

  it("fails loudly for a gun_mount and a torpedo (no category of their own)", () => {
    for (const family of ["gun_mount", "torpedo"] as const) {
      const result = partCategory(byId.get(first(family).id)!);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.code).toBe("PART_CATEGORY_UNSUPPORTED_FAMILY");
    }
  });

  it("fails loudly for a gun with no weaponCategory", () => {
    const gun = first("gun");
    if (gun.family !== "gun") throw new Error("expected a gun");
    const { weaponCategory: _drop, ...spec } = gun.spec;
    const result = partCategory({ ...gun, spec } as FlattenedPart);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe("PART_CATEGORY_NO_WEAPON_CATEGORY");
  });
});
