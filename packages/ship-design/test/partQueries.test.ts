import {
  FlattenedPartSchema,
  LoadoutSchema,
  PlatformSchema,
  SlotTemplateSchema,
  decodeStrict,
  type FlattenedPart,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import { partCatalogue, validateLoadoutFit, type PartCatalogue } from "../src/index.js";

const PROVENANCE = {
  sourceStatus: "PLACEHOLDER",
  confidence: "LOW",
  kind: "game_conversion",
  sources: [],
  note: "ticket 07 fixture",
} as const;

const part = (value: Record<string, unknown>): FlattenedPart =>
  decodeStrict(FlattenedPartSchema, {
    quantities: [],
    revisions: [],
    origin: { sourceFile: "fixture.yaml" },
    provenance: PROVENANCE,
    name: value["id"],
    ...value,
  });

const q = (id: string, kind: string, value: number, basis: string) => ({ id, kind, value, basis });

const torpedoSpec = (diameterUm: number, warheadKg: number) => ({
  diameterUm,
  massKg: 300,
  warheadType: "WET_GUNCOTTON" as const,
  warheadExplosiveMassKg: warheadKg,
  warheadExplosiveEquivalentMassKg: warheadKg,
  propulsionType: "COMPRESSED_AIR" as const,
  speedSettings: [{ settingId: "s1", speedMilliKnots: 24000, rangeM: 550 }],
  minimumArmingDistanceM: 25,
  reliabilityBp: 88000,
  guidanceCapability: "none",
  launchTypes: ["ABOVE_WATER_TRAINABLE" as const],
  technologyPrerequisiteIds: [],
  tubeHitHazardPolicy: "ORDINARY" as const,
});

const WHITEHEAD = part({
  id: "whitehead_14in",
  family: "torpedo",
  provides: "torpedo",
  lifecycle: { availableFrom: "1880-01", availableUntil: "1890-01" },
  spec: torpedoSpec(355_600, 12),
  quantities: [q("torpedo_mass", "massKg", 300, "PER_PART_UNIT")],
  revisions: [
    {
      from: "1884-01",
      spec: { warheadExplosiveMassKg: 26, warheadExplosiveEquivalentMassKg: 26 },
      provenance: PROVENANCE,
    },
  ],
});
const MK2 = part({
  id: "whitehead_mk2",
  family: "torpedo",
  provides: "torpedo",
  lifecycle: {
    availableFrom: "1890-01",
    availableUntil: "1900-01",
    supersedes: ["whitehead_14in"],
    requires: ["torpedo_heater"],
  },
  spec: torpedoSpec(355_600, 40),
});
const MK3 = part({
  id: "whitehead_mk3",
  family: "torpedo",
  provides: "torpedo",
  lifecycle: { availableFrom: "1900-01", supersedes: ["whitehead_mk2"] },
  spec: torpedoSpec(355_600, 60),
});
const BIG = part({
  id: "torpedo_18in",
  family: "torpedo",
  provides: "torpedo",
  lifecycle: { availableFrom: "1880-01" },
  spec: torpedoSpec(457_200, 100),
});
const FIUME = part({
  id: "whitehead_fiume",
  family: "torpedo",
  provides: "torpedo",
  nation: "austria_hungary",
  lifecycle: { availableFrom: "1881-01" },
  spec: torpedoSpec(355_600, 12),
  origin: {
    sourceFile: "austria.yaml",
    prototype: {
      id: "whitehead_14in",
      sourceFile: "fixture.yaml",
      inheritedSpec: ["diameterUm"],
      inheritedQuantities: [],
    },
  },
});
const LAUNCHER = part({
  id: "launcher_14in",
  family: "torpedo_launcher",
  provides: "torpedo_launcher",
  lifecycle: { availableFrom: "1880-01" },
  slots: [{ id: "torpedo", accepts: ["torpedo"], constraints: { diameterUmEqualsBore: true } }],
  spec: { launchType: "ABOVE_WATER_FIXED", boreDiameterUm: 355_600 },
});

const mount = (id: string, mountType: string, quantities: unknown[] = []) =>
  part({
    id,
    family: "gun_mount",
    provides: "gun_mount",
    lifecycle: { availableFrom: "1880-01" },
    slots: [{ id: "guns", accepts: ["gun"], mountCount: { min: 2, max: 2 } }],
    spec: { mountType, gunsPerMount: 2 },
    quantities,
  });
const MOUNT_TURRET = mount("m_turret", "TURRET", [
  q("mass", "massKg", 20_000, "PER_PART_UNIT"),
  q("cost", "costMicro", 300, "PER_CONTAINED_UNIT"),
]);
const MOUNT_CASEMATE = mount("m_casemate", "CASEMATE");
const GUN = part({
  id: "g12",
  family: "gun",
  provides: "gun",
  lifecycle: { availableFrom: "1880-01" },
  spec: { calibreUm: 304_800 },
  quantities: [q("mass", "massKg", 5000, "PER_PART_UNIT")],
});
const MAGAZINE = part({
  id: "mag_a",
  family: "fitting",
  provides: "magazine",
  lifecycle: { availableFrom: "1880-01" },
  spec: {},
  quantities: [q("mass", "massKg", 1000, "PER_LOADOUT_ENTRY")],
});

const TEMPLATE = decodeStrict(SlotTemplateSchema, {
  id: "fixture_slots",
  slots: [
    {
      id: "fwd_main",
      accepts: ["gun_mount"],
      mountCount: { min: 0, max: 3 },
      constraints: { mountTypes: ["TURRET", "BARBETTE"] },
    },
    { id: "side_port", accepts: ["gun_mount"], side: "PORT" },
    { id: "side_stbd", mirrors: "side_port" },
    { id: "calibre_capped", accepts: ["gun_mount"], constraints: { calibreInchesMax: 12 } },
    { id: "magazine", accepts: ["magazine"] },
    { id: "tubes", accepts: ["torpedo_launcher"] },
  ],
});
const PLATFORM = decodeStrict(PlatformSchema, {
  id: "fixture_hull",
  hullForm: "fixture_hull",
  slotTemplates: ["fixture_slots"],
});

const BASE_PARTS = [
  WHITEHEAD,
  MK2,
  MK3,
  BIG,
  FIUME,
  LAUNCHER,
  MOUNT_TURRET,
  MOUNT_CASEMATE,
  GUN,
  MAGAZINE,
];
const catalogue = (parts: readonly FlattenedPart[] = BASE_PARTS): PartCatalogue =>
  partCatalogue({ parts, slotTemplates: [TEMPLATE], platforms: [PLATFORM] });

describe("resolvePart", () => {
  it("applies the 1884 revision from its month and not before", () => {
    const before = catalogue().resolve("whitehead_14in", "1883-12");
    const after = catalogue().resolve("whitehead_14in", "1884-01");
    expect(before).toMatchObject({ revision: "base", status: "AVAILABLE" });
    expect(before?.spec["warheadExplosiveMassKg"]).toBe(12);
    expect(after).toMatchObject({ revision: "1884-01", status: "AVAILABLE" });
    expect(after?.spec["warheadExplosiveMassKg"]).toBe(26);
  });

  it("reports lifecycle status and successors", () => {
    expect(catalogue().resolve("whitehead_14in", "1879-12")?.status).toBe("NOT_YET_AVAILABLE");
    const retired = catalogue().resolve("whitehead_14in", "1890-01");
    expect(retired?.status).toBe("UNAVAILABLE");
    expect(retired?.supersededBy).toEqual(["whitehead_mk2"]);
  });

  it("returns null for an unknown part and throws for a malformed month", () => {
    expect(catalogue().resolve("nope", "1884-01")).toBeNull();
    expect(() => catalogue().resolve("g12", "1884")).toThrow();
  });
});

describe("availableParts", () => {
  const at = (month: string, extra = {}) => catalogue().available({ month, ...extra });

  it("reports the 1884 Whitehead revision as a change in that month only", () => {
    expect(at("1884-01").changes).toEqual([
      { part: "whitehead_14in", kind: "REVISED", month: "1884-01" },
    ]);
    expect(at("1884-02").changes).toEqual([]);
    expect(at("1883-12").changes).toEqual([]);
  });

  it("reports introductions and retirements, id-ordered", () => {
    const r = at("1890-01");
    expect(r.changes).toEqual([
      { part: "whitehead_14in", kind: "RETIRED", month: "1890-01" },
      { part: "whitehead_mk2", kind: "INTRODUCED", month: "1890-01" },
    ]);
    expect(r.available).not.toContain("whitehead_14in");
    expect(r.available).toContain("whitehead_mk2");
    expect(r.newlyFittable).toEqual(["whitehead_mk2"]);
    expect([...r.available]).toEqual([...r.available].sort());
  });

  it("lists first-month parts as newly fittable", () => {
    expect(at("1880-01").newlyFittable).toEqual([
      "g12",
      "launcher_14in",
      "m_casemate",
      "m_turret",
      "mag_a",
      "torpedo_18in",
      "whitehead_14in",
    ]);
    expect(at("1880-02").newlyFittable).toEqual([]);
  });

  it("hides a national part from other nations and shows it to its own", () => {
    const own = at("1881-01", { nation: { nationId: "austria_hungary" } });
    const other = at("1881-01", { nation: { nationId: "italy" } });
    expect(own.available).toContain("whitehead_fiume");
    expect(other.available).not.toContain("whitehead_fiume");
    expect(other.changes.map((c) => c.part)).not.toContain("whitehead_fiume");
  });

  it("evaluates the unlocked-technology input when given", () => {
    expect(at("1890-01").available).toContain("whitehead_mk2");
    expect(at("1890-01", { unlockedTechnologies: [] }).available).not.toContain("whitehead_mk2");
    const unlockedNow = at("1890-01", {
      unlockedTechnologies: ["torpedo_heater"],
      previouslyUnlockedTechnologies: [],
    });
    expect(unlockedNow.newlyFittable).toEqual(["whitehead_mk2"]);
    const unlockedLater = at("1890-06", {
      unlockedTechnologies: ["torpedo_heater"],
      previouslyUnlockedTechnologies: [],
    });
    expect(unlockedLater.newlyFittable).toEqual(["whitehead_mk2"]);
  });
});

describe("partsForSlot", () => {
  const forSlot = (
    parts: readonly FlattenedPart[],
    slot: string,
    owner = { platform: "fixture_hull" },
  ) => catalogue(parts).forSlot({ owner, slot, month: "1890-01" });

  it("returns exactly the parts whose interface and constraints the slot accepts", () => {
    expect(forSlot(BASE_PARTS, "fwd_main").parts).toEqual(["m_turret"]);
    expect(forSlot(BASE_PARTS, "side_port").parts).toEqual(["m_casemate", "m_turret"]);
    expect(forSlot(BASE_PARTS, "magazine").parts).toEqual(["mag_a"]);
  });

  it("evaluates a mirrored slot as its sibling", () => {
    expect(forSlot(BASE_PARTS, "side_stbd").parts).toEqual(forSlot(BASE_PARTS, "side_port").parts);
  });

  it("matches a part-owned slot by the bore constraint", () => {
    const r = forSlot(BASE_PARTS, "torpedo", { part: "launcher_14in" } as never);
    expect(r.parts).toEqual([
      "whitehead_14in",
      "whitehead_fiume",
      "whitehead_mk2",
      "whitehead_mk3",
    ]);
  });

  it("makes a new part appear in every matching slot and no other", () => {
    const added = part({
      id: "m_barbette",
      family: "gun_mount",
      provides: "gun_mount",
      lifecycle: { availableFrom: "1880-01" },
      spec: { mountType: "BARBETTE", gunsPerMount: 1 },
    });
    const slots = ["fwd_main", "side_port", "side_stbd", "calibre_capped", "magazine", "tubes"];
    const where = (parts: readonly FlattenedPart[]) =>
      slots.filter((s) => {
        const r = forSlot(parts, s);
        return [...r.parts, ...r.undecided.map((u) => u.part)].includes("m_barbette");
      });
    expect(where(BASE_PARTS)).toEqual([]);
    expect(where([...BASE_PARTS, added])).toEqual([
      "fwd_main",
      "side_port",
      "side_stbd",
      "calibre_capped",
    ]);
  });

  it("leaves a constraint a lone part cannot answer undecided, not accepted", () => {
    const r = forSlot(BASE_PARTS, "calibre_capped");
    expect(r.parts).toEqual([]);
    expect(r.undecided).toEqual([
      { part: "m_casemate", constraints: ["calibreInches"] },
      { part: "m_turret", constraints: ["calibreInches"] },
    ]);
  });

  it("reports an unknown owner or slot", () => {
    expect(forSlot(BASE_PARTS, "nope").status).toBe("UNKNOWN_SLOT");
    expect(forSlot(BASE_PARTS, "fwd_main", { platform: "nope" }).status).toBe("UNKNOWN_OWNER");
  });
});

describe("lineage", () => {
  it("walks supersession ancestry and successors transitively", () => {
    expect(catalogue().lineage("whitehead_mk2")).toEqual({
      part: "whitehead_mk2",
      prototype: null,
      variants: [],
      supersedes: ["whitehead_14in"],
      supersededBy: ["whitehead_mk3"],
      ancestors: ["whitehead_14in"],
      successors: ["whitehead_mk3"],
    });
    expect(catalogue().lineage("whitehead_14in")?.successors).toEqual([
      "whitehead_mk2",
      "whitehead_mk3",
    ]);
    expect(catalogue().lineage("whitehead_mk3")?.ancestors).toEqual([
      "whitehead_mk2",
      "whitehead_14in",
    ]);
  });

  it("reports variants and prototype, and null for an unknown part", () => {
    expect(catalogue().lineage("whitehead_14in")?.variants).toEqual(["whitehead_fiume"]);
    expect(catalogue().lineage("whitehead_fiume")?.prototype).toBe("whitehead_14in");
    expect(catalogue().lineage("nope")).toBeNull();
  });
});

const loadout = (entries: unknown[]) =>
  decodeStrict(LoadoutSchema, { platform: "fixture_hull", entries });

describe("validateLoadout", () => {
  const entries = [
    {
      slot: "fwd_main",
      part: "m_turret",
      mountCount: 1,
      entries: { guns: [{ part: "g12", mountCount: 2 }] },
    },
  ];

  it("is validateLoadoutFit over the catalogue", () => {
    const cat = catalogue();
    expect(cat.validate({ loadout: loadout(entries), month: "1890-01" })).toEqual(
      validateLoadoutFit({
        catalogue: cat,
        loadout: loadout(entries),
        month: "1890-01",
      }),
    );
  });

  it("flags a part whose technology is not unlocked, and only when the input is given", () => {
    const tubes = [
      {
        slot: "tubes",
        part: "launcher_14in",
        entries: { torpedo: [{ part: "whitehead_mk2" }] },
      },
    ];
    const base = { loadout: loadout(tubes), month: "1895-01" };
    const validate = catalogue().validate;
    expect(validate(base).status).toBe("ACCEPTED");
    const locked = validate({ ...base, conditions: { unlockedTechnologies: [] } });
    expect(locked.status).toBe("REJECTED");
    expect(locked.findings.map((f) => [f.code, f.part, f.detail])).toEqual([
      ["FIT_TECHNOLOGY_LOCKED", "whitehead_mk2", { missing: ["torpedo_heater"] }],
    ]);
    expect(
      validate({
        ...base,
        conditions: { unlockedTechnologies: ["torpedo_heater"] },
      }).status,
    ).toBe("ACCEPTED");
  });
});

describe("loadoutCost", () => {
  const entries = [
    { slot: "magazine", part: "mag_a" },
    {
      slot: "fwd_main",
      part: "m_turret",
      mountCount: 2,
      entries: { guns: [{ part: "g12", mountCount: 2 }] },
    },
  ];
  const cost = catalogue().cost({ loadout: loadout(entries), month: "1890-01" });

  it("lists each component's value, basis, multiplier and contribution", () => {
    expect(
      cost.lines.map((l) => [l.path, l.id, l.value, l.basis, l.multiplier, l.contribution]),
    ).toEqual([
      ["entries/fwd_main/m_turret#1", "cost", 300, "PER_CONTAINED_UNIT", 4, 1200],
      ["entries/fwd_main/m_turret#1", "mass", 20000, "PER_PART_UNIT", 2, 40000],
      ["entries/fwd_main/m_turret#1/entries/guns/g12#1", "mass", 5000, "PER_PART_UNIT", 4, 20000],
      ["entries/magazine/mag_a#1", "mass", 1000, "PER_LOADOUT_ENTRY", 1, 1000],
    ]);
  });

  it("totals by kind", () => {
    expect(cost.totals).toEqual({ costMicro: 1200, massKg: 61000 });
    expect(cost.dataIssues).toEqual([]);
  });

  it("is independent of entry order, and reports an unknown part as a data issue", () => {
    const shuffled = catalogue().cost({
      loadout: loadout([...entries].reverse()),
      month: "1890-01",
    });
    expect(shuffled).toEqual(cost);
    const unknown = catalogue().cost({
      loadout: loadout([{ slot: "magazine", part: "ghost" }]),
      month: "1890-01",
    });
    expect(unknown.dataIssues.map((d) => d.code)).toEqual(["FIT_DATA_UNKNOWN_PART"]);
    expect(unknown.lines).toEqual([]);
  });
});

describe("determinism", () => {
  it("returns identical results for permuted catalogues", () => {
    const reversed = [...BASE_PARTS].reverse();
    const run = (parts: readonly FlattenedPart[]) => ({
      avail: catalogue(parts).available({ month: "1890-01" }),
      slot: catalogue(parts).forSlot({
        owner: { platform: "fixture_hull" },
        slot: "side_port",
        month: "1890-01",
      }),
      lineage: catalogue(parts).lineage("whitehead_mk3"),
    });
    expect(run(reversed)).toEqual(run(BASE_PARTS));
  });
});
