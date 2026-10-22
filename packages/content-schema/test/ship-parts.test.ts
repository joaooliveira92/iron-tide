import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";

import {
  APPLICATION_BASES,
  type ContentSchema,
  DEFAULT_MOUNT_COUNT,
  FlattenedPartSchema,
  LoadoutEntrySchema,
  LoadoutSchema,
  PART_INTERFACES,
  PartSchema,
  PlatformSchema,
  SlotTemplateSchema,
  decodeStrict,
  resolvePartRevision,
  validateAgainstSchema,
} from "../src/index.js";
import { decodeIssue, decodeOk } from "./decode-helpers.js";

const provenance = {
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test source" }],
};

const PARTS = {
  gun: {
    id: "bl_12in_25",
    family: "gun",
    provides: "gun",
    name: "BL 12-inch 25-ton",
    lifecycle: { availableFrom: "1885-01", requires: ["gun_breech_rifled"] },
    spec: { calibreUm: 305_000, gunMassKg: 44_500 },
    quantities: [{ id: "gun_mass", kind: "massKg", value: 44_500, basis: "PER_PART_UNIT" }],
    provenance,
  },
  gun_mount: {
    id: "bl_12in_barbette_twin",
    family: "gun_mount",
    provides: "gun_mount",
    name: "12-inch twin barbette",
    lifecycle: { availableFrom: "1885-01" },
    spec: { mountType: "BARBETTE", gunsPerMount: 2, firingArcDeg: 120 },
    quantities: [
      { id: "fixed_installation", kind: "massKg", value: 20_000, basis: "PER_LOADOUT_ENTRY" },
      { id: "per_gun_installation", kind: "massKg", value: 30_000, basis: "PER_CONTAINED_UNIT" },
    ],
    slots: [
      { id: "guns", accepts: ["gun"], sameParts: true },
      { id: "ammunition", accepts: ["ammunition"], mountCount: { min: 1, max: 2 } },
    ],
    provenance,
  },
  ammunition: {
    id: "uk_ap_palliser",
    family: "ammunition",
    provides: "ammunition",
    name: "Palliser AP",
    nation: "uk",
    lifecycle: { availableFrom: "1880-01" },
    spec: { shellType: "AP", penetrationBiasBp: 9000 },
    provenance,
  },
  torpedo_launcher: {
    id: "tube_14in_above_water",
    family: "torpedo_launcher",
    provides: "torpedo_launcher",
    name: "14-inch above-water tube",
    lifecycle: { availableFrom: "1880-01" },
    spec: { launchType: "ABOVE_WATER_TRAINABLE", boreDiameterUm: 356_000, reloadsPerTube: 3 },
    quantities: [{ id: "launcher_mass", kind: "massKg", value: 1400, basis: "PER_PART_UNIT" }],
    slots: [{ id: "torpedo", accepts: ["torpedo"], constraints: { diameterUmEqualsBore: true } }],
    provenance,
  },
  torpedo: {
    id: "whitehead_14in",
    family: "torpedo",
    provides: "torpedo",
    name: "Whitehead 14-inch",
    lifecycle: { availableFrom: "1880-01" },
    spec: {
      diameterUm: 356_000,
      massKg: 300,
      warheadType: "WET_GUNCOTTON",
      warheadExplosiveMassKg: 12,
      warheadExplosiveEquivalentMassKg: 12,
      propulsionType: "COMPRESSED_AIR",
      speedSettings: [{ settingId: "s1", speedMilliKnots: 25_000, rangeM: 550 }],
      minimumArmingDistanceM: 25,
      reliabilityBp: 88_000,
      guidanceCapability: "none",
      launchTypes: ["ABOVE_WATER_FIXED", "ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED"],
      technologyPrerequisiteIds: [],
      tubeHitHazardPolicy: "ORDINARY",
    },
    revisions: [
      {
        from: "1884-01",
        spec: { warheadExplosiveMassKg: 26, warheadExplosiveEquivalentMassKg: 26 },
        provenance,
      },
    ],
    provenance,
  },
  propulsion_plant: {
    id: "triple_expansion_cylindrical",
    family: "propulsion_plant",
    provides: "propulsion_plant",
    name: "Triple expansion, cylindrical boilers",
    lifecycle: { availableFrom: "1885-01", supersedes: ["compound_cylindrical"] },
    parameters: { installedKw: { min: 500, max: 14_000, step: 50 } },
    spec: {
      fuelType: "COAL",
      weightMilliKgPerKw: 170_000,
      volumeLitrePerKw: 150,
      sfcGramPerKwh: { points: [[1000, 900]] },
      reliabilityBp: 9000,
    },
    provenance,
  },
  armour_material: {
    id: "nickel_steel",
    family: "armour_material",
    provides: "armour_material",
    name: "Nickel steel",
    lifecycle: { availableFrom: "1889-01", supersedes: ["compound"] },
    parameters: { thicknessUm: { min: 25_000, max: 610_000, step: 5000 } },
    spec: { efficiencyBp: 13_500 },
    provenance,
  },
  sensor: {
    id: "rangefinder_optical",
    family: "sensor",
    provides: "sensor",
    name: "Optical rangefinder",
    lifecycle: { availableFrom: "1893-01" },
    spec: { accuracyBonusBp: 800, gunCapacity: 8 },
    quantities: [{ id: "mass", kind: "massKg", value: 300, basis: "PER_PART_UNIT" }],
    provenance,
  },
  fitting: {
    id: "magazine_heavy",
    family: "fitting",
    provides: "magazine",
    name: "Heavy magazine",
    lifecycle: { availableFrom: "1880-01" },
    spec: { magazineLitre: 120_000, critical: true },
    quantities: [{ id: "volume", kind: "volumeLitre", value: 130_000, basis: "PER_PART_UNIT" }],
    provenance,
  },
} as const;

const SLOT_TEMPLATE = {
  id: "capital_ship_1880s",
  slots: [
    {
      id: "fwd_main",
      accepts: ["gun_mount"],
      constraints: { calibreInchesMin: 9, calibreInchesMax: 13 },
      mountCount: { min: 0, max: 3 },
      stationPermille: { from: 80, to: 280 },
      side: "CENTRE",
      arcDeg: { centre: 0, width: 270 },
    },
    {
      id: "secondary_port",
      accepts: ["gun_mount"],
      mountCount: { min: 0, max: 8 },
      side: "PORT",
    },
    { id: "secondary_stbd", mirrors: "secondary_port" },
    {
      id: "armour.belt_main",
      accepts: ["armour_material"],
      mountCount: { min: 0, max: 1 },
      region: "BELT_MAIN",
    },
  ],
};

const PLATFORM = {
  id: "pre_dreadnought_form",
  hullForm: "battleship_1880",
  slotTemplates: ["capital_ship_1880s"],
};

const LOADOUT = {
  platform: "pre_dreadnought_form",
  entries: [
    {
      slot: "fwd_main",
      part: "bl_12in_barbette_twin",
      mountCount: 1,
      stationPermille: 210,
      entries: {
        guns: [{ part: "bl_12in_25" }],
        ammunition: [{ part: "uk_ap_palliser" }],
      },
    },
    {
      slot: "armour.belt_main",
      part: "nickel_steel",
      shape: { thicknessUm: 229_000, lengthMm: 60_000, heightMm: 2400, cosObliquityBp: 10_000 },
    },
  ],
};

function expectAccepted(schema: ContentSchema, data: unknown): void {
  expect(decodeOk(schema, data), decodeIssue(schema, data)).toBe(true);
}

function expectRejected(schema: ContentSchema, data: unknown): void {
  expect(decodeOk(schema, data)).toBe(false);
}

function diagnose(schema: ContentSchema, data: unknown, sourcePath: string) {
  const collector = new DiagnosticCollector();
  const result = validateAgainstSchema(data, schema, "Part", sourcePath, collector);
  return { result, errors: collector.errors };
}

describe("valid new-shape records decode", () => {
  it.each(Object.entries(PARTS))("a minimal %s part decodes", (_family, part) => {
    expectAccepted(PartSchema, part);
  });

  it("a slot template, a platform and a loadout with nested entries decode", () => {
    expectAccepted(SlotTemplateSchema, SLOT_TEMPLATE);
    expectAccepted(PlatformSchema, PLATFORM);
    expectAccepted(LoadoutSchema, LOADOUT);
  });

  it("every interfaces/1 token is accepted by a slot", () => {
    for (const token of PART_INTERFACES) {
      expectAccepted(SlotTemplateSchema, { id: "t", slots: [{ id: "s", accepts: [token] }] });
    }
  });

  it("a fitting provides each ship-system interface", () => {
    for (const provides of [
      "magazine",
      "funnel",
      "electrical_plant",
      "accommodation",
      "damage_control",
      "ventilation",
    ]) {
      expectAccepted(PartSchema, { ...PARTS.fitting, provides });
    }
  });
});

describe("unknown interface identifiers fail", () => {
  const UNKNOWN = [
    "gun_mounts",
    "Gun",
    "GUN_MOUNT",
    "gun_12in",
    "*",
    "misc",
    "general_fitting",
    "",
  ];

  it.each(UNKNOWN)("provides %j fails", (token) => {
    expectRejected(PartSchema, { ...PARTS.gun, provides: token });
  });

  it.each(UNKNOWN)("slot accepts %j fails", (token) => {
    expectRejected(SlotTemplateSchema, { id: "t", slots: [{ id: "s", accepts: [token] }] });
  });

  it("a family cannot provide another family's interface", () => {
    expectRejected(PartSchema, { ...PARTS.gun, provides: "gun_mount" });
    expectRejected(PartSchema, { ...PARTS.fitting, provides: "sensor" });
    expectRejected(PartSchema, { ...PARTS.sensor, provides: "magazine" });
  });

  it("an unknown part family fails", () => {
    expectRejected(PartSchema, { ...PARTS.gun, family: "turret" });
  });
});

describe("unknown quantity bases fail", () => {
  const quantity = (basis: unknown) => ({
    ...PARTS.gun,
    quantities: [{ id: "gun_mass", kind: "massKg", value: 1, basis }],
  });

  it("the three bases are accepted", () => {
    for (const basis of APPLICATION_BASES) expectAccepted(PartSchema, quantity(basis));
  });

  it.each(["PER_FIT", "PER_MOUNT", "PER_SLOT", "PER_SHIP", "per_part_unit", ""])(
    "basis %j fails",
    (basis) => {
      expectRejected(PartSchema, quantity(basis));
    },
  );

  it("a quantity component without a basis fails", () => {
    expectRejected(PartSchema, {
      ...PARTS.gun,
      quantities: [{ id: "gun_mass", kind: "massKg", value: 1 }],
    });
  });

  it("an unknown quantity kind fails", () => {
    expectRejected(PartSchema, {
      ...PARTS.gun,
      quantities: [{ id: "gun_mass", kind: "weight", value: 1, basis: "PER_PART_UNIT" }],
    });
  });
});

describe("unknown fields are rejected, never discarded", () => {
  it("an unknown slot-constraint key fails", () => {
    expectRejected(SlotTemplateSchema, {
      id: "t",
      slots: [{ id: "s", accepts: ["gun_mount"], constraints: { calibreMmMin: 200 } }],
    });
  });

  it("an unknown field fails on the envelope, spec, slot, loadout entry and visual block", () => {
    expectRejected(PartSchema, { ...PARTS.gun, weight: 1 });
    expectRejected(PartSchema, { ...PARTS.gun, spec: { ...PARTS.gun.spec, caliberUm: 1 } });
    expectRejected(SlotTemplateSchema, {
      id: "t",
      slots: [{ id: "s", accepts: ["gun"], size: "large" }],
    });
    expectRejected(LoadoutEntrySchema, { slot: "s", part: "p", note: "x" });
    expectRejected(PartSchema, { ...PARTS.gun, visual: { override: "asset", style: "x" } });
  });

  it("a visual-trait override is a value plus a reason (D16)", () => {
    expectAccepted(PartSchema, { ...PARTS.gun, visual: { override: "gun_asset", traits: {} } });
    expectAccepted(PartSchema, {
      ...PARTS.gun,
      visual: { traits: { presentation_form: { value: "barbette", reason: "hooded variant" } } },
    });
    expectRejected(PartSchema, { ...PARTS.gun, visual: { traits: { enclosure: "open" } } });
    expectRejected(PartSchema, { ...PARTS.gun, visual: { traits: { presentation_form: "x" } } });
  });

  it("an unknown field in a revision's spec delta fails", () => {
    expectRejected(PartSchema, {
      ...PARTS.torpedo,
      revisions: [{ from: "1884-01", spec: { warheadLb: 57 }, provenance }],
    });
  });
});

describe("migration-only aliases are rejected by the canonical decoder", () => {
  it("barrels and tubes do not exist on a loadout entry, at any depth", () => {
    expectRejected(LoadoutEntrySchema, { slot: "s", part: "p", barrels: 2 });
    expectRejected(LoadoutEntrySchema, { slot: "s", part: "p", tubes: 2 });
    expectRejected(LoadoutEntrySchema, {
      slot: "s",
      part: "p",
      entries: { guns: [{ part: "g", barrels: 2 }] },
    });
  });

  it("a legacy exception on any family but torpedo_launcher fails at legacyExceptions", () => {
    const exception = {
      code: "DQ-TORPEDO-001",
      waives: "diameterUmEqualsBore",
      forPart: "whitehead_14in",
      note: "inherited",
    };
    for (const [family, part] of Object.entries(PARTS)) {
      const record = { ...part, legacyExceptions: [exception] };
      if (family === "torpedo_launcher") {
        expectAccepted(PartSchema, record);
        continue;
      }
      expectRejected(PartSchema, record);
      const flattened = { ...record, quantities: [], revisions: [], origin: { sourceFile: "x" } };
      expectRejected(FlattenedPartSchema, flattened);
      expectAccepted(FlattenedPartSchema, { ...flattened, legacyExceptions: undefined });
    }
    const { errors } = diagnose(
      PartSchema,
      { ...PARTS.torpedo, legacyExceptions: [exception] },
      "ship-building/parts/torpedoes.yaml",
    );
    expect(errors.map((e) => e.message)).toContainEqual(
      expect.stringContaining("Part.legacyExceptions"),
    );
    expect(
      errors.every((e) => e.sourceLocation?.path === "ship-building/parts/torpedoes.yaml"),
    ).toBe(true);
  });

  it("an unknown legacy-exception code or waived constraint fails", () => {
    const exception = {
      code: "DQ-TORPEDO-001",
      waives: "diameterUmEqualsBore",
      forPart: "whitehead_14in",
      note: "inherited",
    };
    expectAccepted(PartSchema, { ...PARTS.torpedo_launcher, legacyExceptions: [exception] });
    for (const bad of [
      { ...exception, code: "DQ-TORPEDO-002" },
      { ...exception, code: "DQ-ARMAMENT-001" },
      { ...exception, waives: "diameterUmMax" },
    ]) {
      expectRejected(PartSchema, { ...PARTS.torpedo_launcher, legacyExceptions: [bad] });
    }
  });

  it("a legacy exception names exactly one constraint and one counterpart, with a note", () => {
    const { note: _note, ...withoutNote } = {
      code: "DQ-TORPEDO-001",
      waives: "diameterUmEqualsBore",
      forPart: "whitehead_14in",
      note: "inherited",
    };
    expectRejected(PartSchema, { ...PARTS.torpedo_launcher, legacyExceptions: [withoutNote] });
    expectRejected(PartSchema, {
      ...PARTS.torpedo_launcher,
      legacyExceptions: [{ ...withoutNote, note: "" }],
    });
    expectRejected(PartSchema, {
      ...PARTS.torpedo_launcher,
      legacyExceptions: [{ ...withoutNote, forPart: undefined, note: "x" }],
    });
    expectRejected(PartSchema, {
      ...PARTS.torpedo_launcher,
      legacyExceptions: [{ ...withoutNote, waives: ["diameterUmEqualsBore"], note: "x" }],
    });
  });
});

describe("mountCount is the only quantity on a loadout entry", () => {
  it("is optional at every depth, and an absent count means one unit", () => {
    const decoded = decodeStrict(LoadoutSchema, LOADOUT);
    expect(decoded.entries[1]?.mountCount).toBeUndefined();
    expect(decoded.entries[0]?.entries?.["guns"]?.[0]?.mountCount).toBeUndefined();
    expect(DEFAULT_MOUNT_COUNT).toBe(1);
  });

  it("a positive integer count decodes unchanged", () => {
    const decoded = decodeStrict(LoadoutEntrySchema, { slot: "s", part: "p", mountCount: 6 });
    expect(decoded.mountCount).toBe(6);
  });

  it.each([0, -1, 1.5, "2"])("mountCount %j fails", (mountCount) => {
    expectRejected(LoadoutEntrySchema, { slot: "s", part: "p", mountCount });
  });
});

describe("record keys are closed", () => {
  it.each(["Guns", "*", "guns slot"])("nested entry key %j fails", (key) => {
    expectRejected(LoadoutEntrySchema, {
      slot: "s",
      part: "p",
      entries: { [key]: [{ part: "g" }] },
    });
  });

  it.each(["InstalledKw", "*", "installed kw"])("parameter name %j fails", (key) => {
    expectRejected(LoadoutEntrySchema, { slot: "s", part: "p", params: { [key]: 1 } });
    expectRejected(PartSchema, {
      ...PARTS.armour_material,
      parameters: { [key]: { min: 1, max: 2, step: 1 } },
    });
  });

  it("nested entries are always arrays", () => {
    expectRejected(LoadoutEntrySchema, { slot: "s", part: "p", entries: { guns: { part: "g" } } });
  });
});

describe("slot shape rules", () => {
  it("a mirroring slot declares only id and mirrors", () => {
    expectRejected(SlotTemplateSchema, {
      id: "t",
      slots: [{ id: "s", mirrors: "p", accepts: ["gun_mount"] }],
    });
  });

  it("a slot without accepts or mirrors fails", () => {
    expectRejected(SlotTemplateSchema, { id: "t", slots: [{ id: "s" }] });
  });

  it("inverted mountCount bounds fail", () => {
    expectRejected(SlotTemplateSchema, {
      id: "t",
      slots: [{ id: "s", accepts: ["gun_mount"], mountCount: { min: 3, max: 1 } }],
    });
  });

  it("a platform with no slot source fails", () => {
    expectRejected(PlatformSchema, { ...PLATFORM, slotTemplates: [] });
  });
});

describe("strict failure diagnostics identify the source file and field path", () => {
  const FILE = "ship-building/parts/guns.yaml";

  it.each([
    ["an unknown interface", { ...PARTS.gun, provides: "gun_12in" }, "Part.provides"],
    [
      "an unknown basis",
      { ...PARTS.gun, quantities: [{ id: "m", kind: "massKg", value: 1, basis: "PER_FIT" }] },
      "Part.quantities.0.basis",
    ],
    [
      "an unknown spec field",
      { ...PARTS.gun, spec: { calibreUm: 1, caliberUm: 1 } },
      "Part.spec.caliberUm",
    ],
    [
      "an unknown constraint key",
      {
        ...PARTS.gun_mount,
        slots: [{ id: "guns", accepts: ["gun"], constraints: { calibreMmMin: 1 } }],
      },
      "Part.slots.0.constraints.calibreMmMin",
    ],
    [
      "a visual trait",
      { ...PARTS.gun, visual: { traits: { enclosure: "open" } } },
      "Part.visual.traits.enclosure",
    ],
  ])("%s is reported at its file and path", (_case, record, path) => {
    const { result, errors } = diagnose(PartSchema, record, FILE);
    expect(result).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(error.code).toBe("SCHEMA");
      expect(error.sourceLocation?.path).toBe(FILE);
    }
    expect(errors.map((error) => error.message).join("\n")).toContain(`${path}:`);
  });

  it("a nested alias is reported at its nested path", () => {
    const collector = new DiagnosticCollector();
    validateAgainstSchema(
      {
        platform: "p",
        entries: [{ slot: "s", part: "m", entries: { guns: [{ part: "g", barrels: 2 }] } }],
      },
      LoadoutSchema,
      "Loadout",
      FILE,
      collector,
    );
    expect(collector.errors.map((error) => error.message).join("\n")).toContain(
      "Loadout.entries.0.entries.guns.0.barrels:",
    );
  });

  it("an unknown family names the closed family list", () => {
    const { errors } = diagnose(PartSchema, { ...PARTS.gun, family: "turret" }, FILE);
    expect(errors[0]?.sourceLocation?.path).toBe(FILE);
    expect(errors[0]?.message).toContain("Part.(root):");
    expect(errors[0]?.message).toContain("family is one of");
    expect(errors[0]?.message).toContain("gun_mount");
  });
});

describe("a variant writes its spec as a delta over its prototype", () => {
  const FILE = "ship-building/parts/torpedoes.yaml";

  it("a standalone part missing a required spec field fails at that field", () => {
    const { result, errors } = diagnose(
      PartSchema,
      { ...PARTS.torpedo, spec: { diameterUm: 356_000, massKg: 300 } },
      FILE,
    );
    expect(result).toBeUndefined();
    expect(errors.map((error) => error.message).join("\n")).toContain("Part.spec.warheadType:");
    expect(errors.every((error) => error.sourceLocation?.path === FILE)).toBe(true);
  });

  it("a variant may omit every spec field it inherits", () => {
    expectAccepted(PartSchema, {
      ...PARTS.torpedo,
      id: "whitehead_14in_de",
      extends: "whitehead_14in",
      spec: { warheadExplosiveMassKg: 20 },
    });
  });

  it("a variant's spec delta still rejects an unknown field", () => {
    expectRejected(PartSchema, {
      ...PARTS.torpedo,
      id: "whitehead_14in_de",
      extends: "whitehead_14in",
      spec: { warheadLb: 44 },
    });
  });
});

describe("derive-input homes decode and reject invalid values (17a-2)", () => {
  const gun = () => structuredClone(PARTS.gun);

  it("accepts each typed derive-input home", () => {
    const part = {
      ...gun(),
      allowedZones: ["FORECASTLE", "SUPERSTRUCTURE"],
      forbidsCoLocation: ["magazine", "electrical_plant"],
      buildWorkMicro: 123_456,
      productionLine: "heavy_gun",
      engineering: { flammability: { indexBp: 250 } },
    };
    expectAccepted(PartSchema, part);
  });

  it("rejects duplicate allowedZones and forbidsCoLocation entries", () => {
    expectRejected(PartSchema, { ...gun(), allowedZones: ["FORECASTLE", "FORECASTLE"] });
    expectRejected(PartSchema, { ...gun(), forbidsCoLocation: ["magazine", "magazine"] });
  });

  it("rejects an unknown zone, interface or production line", () => {
    expectRejected(PartSchema, { ...gun(), allowedZones: ["BRIDGE"] });
    expectRejected(PartSchema, { ...gun(), forbidsCoLocation: ["ENGINE"] });
    expectRejected(PartSchema, { ...gun(), productionLine: "walkway" });
  });

  it("rejects a negative or fractional buildWorkMicro", () => {
    expectRejected(PartSchema, { ...gun(), buildWorkMicro: -1 });
    expectRejected(PartSchema, { ...gun(), buildWorkMicro: 1.5 });
  });

  it("rejects an out-of-range flammability index", () => {
    expectRejected(PartSchema, { ...gun(), engineering: { flammability: { indexBp: 10_001 } } });
    expectRejected(PartSchema, { ...gun(), engineering: { flammability: { indexBp: -1 } } });
  });
});

describe("resolvePartRevision applies dated deltas cumulatively", () => {
  const baseSpec = PARTS.torpedo.spec;
  const flattened = {
    ...PARTS.torpedo,
    spec: { ...baseSpec, warheadExplosiveMassKg: 12, warheadExplosiveEquivalentMassKg: 12 },
    quantities: [],
    revisions: [
      {
        from: "1884-01",
        spec: { warheadExplosiveMassKg: 26, warheadExplosiveEquivalentMassKg: 26 },
        provenance,
      },
      {
        from: "1888-06",
        spec: { speedSettings: [{ settingId: "s2", speedMilliKnots: 27_000, rangeM: 600 }] },
        provenance,
      },
    ],
    origin: { sourceFile: "ship-building/parts/torpedoes.yaml" },
  };

  it("decodes as a flattened part", () => {
    expectAccepted(FlattenedPartSchema, flattened);
  });

  it.each([
    ["1883-12", "base", 12, [{ settingId: "s1", speedMilliKnots: 25_000, rangeM: 550 }]],
    ["1884-01", "1884-01", 26, [{ settingId: "s1", speedMilliKnots: 25_000, rangeM: 550 }]],
    ["1890-01", "1888-06", 26, [{ settingId: "s2", speedMilliKnots: 27_000, rangeM: 600 }]],
  ])("at %s the effective revision is %s", (month, revision, warheadKg, speeds) => {
    const decoded = decodeStrict(FlattenedPartSchema, flattened);
    const resolved = resolvePartRevision(decoded, month);
    expect(resolved.revision).toBe(revision);
    expect(resolved.spec).toMatchObject({
      warheadExplosiveMassKg: warheadKg,
      speedSettings: speeds,
    });
  });
});
