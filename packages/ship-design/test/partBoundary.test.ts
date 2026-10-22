import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PlatformSchema, SlotTemplateSchema, decodeStrict } from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  availableUntilFromRetirementMonth,
  retirementMonthFromAvailableUntil,
} from "../src/partLifecycle.js";
import { basisMultiplier, quantityLines, totalOf } from "../src/partQuantities.js";
import { buildCompatibilitySlots, type ZoneId } from "../src/index.js";
import { platformSlots } from "../src/partCompatibility.js";
import { hullRecords } from "./helpers/earlyContext.js";

describe("availability boundary (retirementMonth inclusive, availableUntil exclusive)", () => {
  it("shifts by exactly one month, across a year boundary, and keeps null", () => {
    expect(availableUntilFromRetirementMonth("1885-06")).toBe("1885-07");
    expect(availableUntilFromRetirementMonth("1885-12")).toBe("1886-01");
    expect(retirementMonthFromAvailableUntil("1886-01")).toBe("1885-12");
    expect(retirementMonthFromAvailableUntil("1885-07")).toBe("1885-06");
    expect(availableUntilFromRetirementMonth(null)).toBeNull();
    expect(availableUntilFromRetirementMonth(undefined)).toBeNull();
    expect(retirementMonthFromAvailableUntil(null)).toBeNull();
  });

  it("round-trips every month of a span", () => {
    for (let year = 1879; year <= 1881; year += 1) {
      for (let m = 1; m <= 12; m += 1) {
        const month = `${year}-${String(m).padStart(2, "0")}`;
        expect(retirementMonthFromAvailableUntil(availableUntilFromRetirementMonth(month))).toBe(
          month,
        );
      }
    }
  });

  it("rejects a malformed month instead of guessing", () => {
    expect(() => availableUntilFromRetirementMonth("1885-13")).toThrow(/YYYY-MM/);
    expect(() => retirementMonthFromAvailableUntil("1885-6")).toThrow(/YYYY-MM/);
  });
});

describe("basis-driven quantities", () => {
  it("multiplies by 1, mountCount and mountCount × contained units, by basis alone", () => {
    expect(basisMultiplier("PER_LOADOUT_ENTRY", 3, 2)).toBe(1);
    expect(basisMultiplier("PER_PART_UNIT", 3, 2)).toBe(3);
    expect(basisMultiplier("PER_CONTAINED_UNIT", 3, 2)).toBe(6);
  });

  it("hand-works mass and cost for 3 mounts of 2 guns", () => {
    const lines = quantityLines(
      [
        { id: "fixed", kind: "massKg", value: 9000, basis: "PER_LOADOUT_ENTRY" },
        { id: "per_gun", kind: "massKg", value: 15000, basis: "PER_CONTAINED_UNIT" },
        { id: "per_mount", kind: "massKg", value: 500, basis: "PER_PART_UNIT" },
        { id: "fixed_cost", kind: "costMicro", value: 1_000, basis: "PER_LOADOUT_ENTRY" },
        { id: "cost_per_gun", kind: "costMicro", value: 3_000, basis: "PER_CONTAINED_UNIT" },
      ],
      "mount",
      "m",
      3,
      2,
    );
    expect(lines.map((l) => [l.id, l.multiplier, l.contribution])).toEqual([
      ["fixed", 1, 9000],
      ["per_gun", 6, 90000],
      ["per_mount", 3, 1500],
      ["fixed_cost", 1, 1_000],
      ["cost_per_gun", 6, 18_000],
    ]);
    expect(totalOf(lines, "massKg")).toBe(9000 + 90000 + 1500);
    expect(totalOf(lines, "costMicro")).toBe(19_000);
    expect(totalOf(lines, "crew")).toBe(0);
  });

  it("an unusual basis on a gun scales as declared, not as the gun family usually does", () => {
    expect(
      quantityLines(
        [
          { id: "gun_mass", kind: "massKg", value: 100, basis: "PER_LOADOUT_ENTRY" },
          { id: "gun_cost", kind: "costMicro", value: 7, basis: "PER_CONTAINED_UNIT" },
        ],
        "gun",
        "g",
        5,
        4,
      ),
    ).toEqual([
      {
        id: "gun_mass",
        kind: "massKg",
        scope: "gun",
        part: "g",
        value: 100,
        basis: "PER_LOADOUT_ENTRY",
        multiplier: 1,
        contribution: 100,
      },
      {
        id: "gun_cost",
        kind: "costMicro",
        scope: "gun",
        part: "g",
        value: 7,
        basis: "PER_CONTAINED_UNIT",
        multiplier: 20,
        contribution: 140,
      },
    ]);
  });
});

describe("hull zones to compatibility slots", () => {
  const hull = (id: string, zones: readonly ZoneId[]) => ({
    id,
    zones: zones.map((z) => ({ id: z })),
  });
  const ZONE_INTERFACES = [
    "gun_mount",
    "torpedo_launcher",
    "propulsion_plant",
    "sensor",
    "magazine",
    "funnel",
    "electrical_plant",
    "accommodation",
    "damage_control",
    "ventilation",
  ];
  const REGIONS = [
    "BELT_MAIN",
    "BELT_UPPER",
    "BELT_ENDS",
    "DECK_MAIN",
    "DECK_SLOPE",
    "DECK_EXTENDED",
    "TURRET",
    "TURRET_TOP",
    "SECONDARY_GUN",
    "CONNING_TOWER",
    "MAGAZINE_BOX",
    "SPLINTER_PLATING",
    "TORPEDO_BULKHEAD",
    "TORPEDO_BELT",
  ];

  it("gives every production hull one slot per zone and interface, and every armour region", () => {
    const model = buildCompatibilitySlots({ hullForms: hullRecords });
    expect(model.platforms.map((p) => p.id)).toEqual(
      hullRecords.map((h) => h.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
    for (const record of hullRecords) {
      const slots = platformSlots(model, record.id) ?? [];
      const expected: { id: string; zone?: string; region?: string; accepts: string[] }[] = [
        ...record.zones.flatMap((z) =>
          ZONE_INTERFACES.map((iface) => ({
            id: `${z.id.toLowerCase()}.${iface}`,
            zone: z.id,
            accepts: [iface],
          })),
        ),
        ...REGIONS.map((region) => ({
          id: `armour.${region.toLowerCase()}`,
          region,
          accepts: ["armour_material"],
        })),
      ];
      const key = (s: { readonly id: string }) => s.id;
      expect([...slots].map(key).sort()).toEqual(expected.map(key).sort());
      for (const slot of slots) {
        expect(expected).toContainEqual({
          id: slot.id,
          ...(slot.zone !== undefined ? { zone: slot.zone } : {}),
          ...(slot.region !== undefined ? { region: slot.region } : {}),
          accepts: slot.accepts,
        });
      }
    }
  });

  it("armour regions are armour-material slots only, never mount points", () => {
    const model = buildCompatibilitySlots({ hullForms: hullRecords });
    const armour = model.slotTemplates.filter((t) => t.slots.some((s) => s.region !== undefined));
    expect(armour.map((t) => t.id)).toEqual(["compatibility_armour_material"]);
    for (const slot of armour.flatMap((t) => t.slots)) {
      expect(slot.accepts).toEqual(["armour_material"]);
      expect(slot.zone).toBeUndefined();
    }
    const zoneSlots = model.slotTemplates
      .flatMap((t) => t.slots)
      .filter((slot) => slot.region === undefined);
    for (const slot of zoneSlots) expect(slot.accepts).not.toContain("armour_material");
    const ids = model.slotTemplates.map((t) => t.id);
    expect(ids).toEqual([...ids].sort(compareCodePoints));
  });

  it("offers a zone only on the platforms that have it", () => {
    const model = buildCompatibilitySlots({
      hullForms: [
        hull("wide_form", ["FORECASTLE", "SUPERSTRUCTURE", "QUARTERDECK"]),
        hull("narrow_form", ["FORECASTLE", "QUARTERDECK"]),
      ],
    });
    for (const template of model.slotTemplates) {
      expect(decodeStrict(SlotTemplateSchema, template)).toEqual(template);
    }
    const zoneTemplates = model.slotTemplates.filter(
      (t) => t.id !== "compatibility_armour_material",
    );
    expect(zoneTemplates.length).toBe(10);
    for (const template of zoneTemplates) {
      expect(template.slots.map((s) => s.zone)).toEqual(["FORECASTLE", "QUARTERDECK"]);
    }
    for (const platform of model.platforms) {
      expect(decodeStrict(PlatformSchema, platform)).toEqual(platform);
    }
    const ids = (id: string) => (platformSlots(model, id) ?? []).map((s) => s.id);
    expect(ids("wide_form")).toContain("superstructure.gun_mount");
    expect(ids("wide_form")).toContain("superstructure.torpedo_launcher");
    expect(ids("narrow_form").some((id) => id.startsWith("superstructure."))).toBe(false);
    expect(platformSlots(model, "missing_form")).toBeNull();
  });

  it("fails on a zone outside the closed zone list instead of inventing a slot", () => {
    expect(() =>
      buildCompatibilitySlots({ hullForms: [{ id: "odd_form", zones: [{ id: "BILGE" }] }] }),
    ).toThrow(/unknown zone 'BILGE'/);
  });

  it("does not depend on the hull or zone input order", () => {
    const forward = buildCompatibilitySlots({ hullForms: hullRecords });
    const reversed = buildCompatibilitySlots({
      hullForms: [...hullRecords].reverse().map((h) => ({ ...h, zones: [...h.zones].reverse() })),
    });
    expect(canonicalSerialize(reversed)).toBe(canonicalSerialize(forward));
  });
});

describe("the content-schema dependency is type-only", () => {
  it("no ship-design source value-imports @bluewave/content-schema (no Effect in the renderer)", () => {
    const src = join(__dirname, "..", "src");
    const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter((f) =>
      f.endsWith(".ts"),
    );
    const offenders = files.filter((file) =>
      /^import\s+(?!type\b)[^;]*from\s+"@bluewave\/content-schema"/m.test(
        readFileSync(join(src, file), "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
    expect(
      files.some((f) => readFileSync(join(src, f), "utf8").includes("@bluewave/content-schema")),
    ).toBe(true);
  });
});
