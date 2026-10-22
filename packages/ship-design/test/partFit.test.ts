import {
  FlattenedPartSchema,
  LoadoutSchema,
  PlatformSchema,
  SlotTemplateSchema,
  decodeStrict,
  decodeStrictResult,
  type FlattenedPart,
  type LoadoutEntryData,
  type PlatformData,
  type ShipTypeRequirement,
  type SlotData,
  type SlotTemplateData,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import { FIT_FINDING_CODES, type FitResult } from "../src/partFitTypes.js";
import {
  deriveAfterFit,
  validateLoadoutFit,
  type FitConditions,
  type FitInput,
} from "../src/partFit.js";

const PROVENANCE = {
  sourceStatus: "PLACEHOLDER",
  confidence: "LOW",
  kind: "game_conversion",
  sources: [],
  note: "ticket 06 fixture",
} as const;

const lifecycle = (availableFrom = "1880-01", availableUntil: string | null = null) => ({
  availableFrom,
  availableUntil,
});

const base = (id: string, name = id) => ({
  id,
  name,
  quantities: [],
  revisions: [],
  origin: { sourceFile: "fixture.yaml" },
  provenance: PROVENANCE,
});

function decodePart(value: unknown): FlattenedPart {
  return decodeStrict(FlattenedPartSchema, value);
}

const gun = (id: string, calibreUm: number, extra: Record<string, unknown> = {}) =>
  decodePart({
    ...base(id),
    family: "gun",
    provides: "gun",
    lifecycle: lifecycle(),
    spec: { calibreUm },
    ...extra,
  });

const mount = (
  id: string,
  gunsPerMount: number,
  options: {
    mountType?: string;
    ammunition?: { min: number; max: number };
    extra?: Record<string, unknown>;
  } = {},
) =>
  decodePart({
    ...base(id),
    family: "gun_mount",
    provides: "gun_mount",
    lifecycle: lifecycle(),
    slots: [
      { id: "guns", accepts: ["gun"], mountCount: { min: gunsPerMount, max: gunsPerMount } },
      ...(options.ammunition === undefined
        ? []
        : [{ id: "ammunition", accepts: ["ammunition"], mountCount: options.ammunition }]),
    ],
    spec: { mountType: options.mountType ?? "TURRET", gunsPerMount },
    ...options.extra,
  });

const ammunition = (id: string, from = "1880-01", until: string | null = null, extra = {}) =>
  decodePart({
    ...base(id),
    family: "ammunition",
    provides: "ammunition",
    lifecycle: { ...lifecycle(from, until), ...extra },
    spec: { shellType: "AP" },
  });

const launcher = (
  id: string,
  boreDiameterUm: number,
  exceptions: readonly { forPart: string }[] = [],
) =>
  decodePart({
    ...base(id),
    family: "torpedo_launcher",
    provides: "torpedo_launcher",
    lifecycle: lifecycle(),
    slots: [{ id: "torpedo", accepts: ["torpedo"], constraints: { diameterUmEqualsBore: true } }],
    spec: { launchType: "ABOVE_WATER_FIXED", boreDiameterUm },
    ...(exceptions.length === 0
      ? {}
      : {
          legacyExceptions: exceptions.map((e) => ({
            code: "DQ-TORPEDO-001",
            waives: "diameterUmEqualsBore",
            forPart: e.forPart,
            note: "fixture waiver",
          })),
        }),
  });

const torpedo = (id: string, diameterUm: number) =>
  decodePart({
    ...base(id),
    family: "torpedo",
    provides: "torpedo",
    lifecycle: lifecycle(),
    spec: {
      diameterUm,
      massKg: 300,
      warheadType: "WET_GUNCOTTON",
      warheadExplosiveMassKg: 20,
      warheadExplosiveEquivalentMassKg: 20,
      propulsionType: "COMPRESSED_AIR",
      speedSettings: [{ settingId: "s1", speedMilliKnots: 20_000, rangeM: 550 }],
      minimumArmingDistanceM: 25,
      reliabilityBp: 88_000,
      guidanceCapability: "none",
      launchTypes: ["ABOVE_WATER_TRAINABLE"],
      technologyPrerequisiteIds: [],
      tubeHitHazardPolicy: "ORDINARY",
    },
  });

const plant = (id: string, min: number, max: number) =>
  decodePart({
    ...base(id),
    family: "propulsion_plant",
    provides: "propulsion_plant",
    lifecycle: lifecycle(),
    parameters: { installedKw: { min, max, step: 1 } },
    spec: {
      fuelType: "COAL",
      weightMilliKgPerKw: 1000,
      volumeLitrePerKw: 10,
      sfcGramPerKwh: { points: [[1000, 900]] },
      reliabilityBp: 9000,
    },
  });

const armourMaterial = (id: string, from = "1880-01", until: string | null = null) =>
  decodePart({
    ...base(id),
    family: "armour_material",
    provides: "armour_material",
    lifecycle: lifecycle(from, until),
    spec: { efficiencyBp: 10000 },
  });

const fitting = (id: string, provides = "magazine") =>
  decodePart({
    ...base(id),
    family: "fitting",
    provides,
    lifecycle: lifecycle(),
    spec: {},
  });

const slot = (value: SlotData): SlotData => value;

const TEMPLATE: SlotTemplateData = decodeStrict(SlotTemplateSchema, {
  id: "fixture_slots",
  slots: [
    {
      id: "fwd_main",
      accepts: ["gun_mount"],
      mountCount: { min: 0, max: 3 },
      zone: "FWD_SERVICE",
      stationPermille: { from: 100, to: 400 },
      constraints: { mountTypes: ["TURRET", "BARBETTE"], calibreInchesMax: 12 },
    },
    { id: "fwd_magazine", accepts: ["magazine"], zone: "FWD_SERVICE" },
    { id: "side_port", accepts: ["gun_mount"], side: "PORT", mountCount: { min: 0, max: 1 } },
    { id: "side_stbd", mirrors: "side_port" },
    { id: "tubes", accepts: ["torpedo_launcher"] },
    { id: "engine", accepts: ["propulsion_plant"], mountCount: { min: 0, max: 1 } },
    {
      id: "armour.belt_main",
      accepts: ["armour_material"],
      region: "BELT_MAIN",
      mountCount: { min: 0, max: 1 },
    },
    { id: "armour.deck", accepts: ["armour_material"], region: "DECK_MAIN" },
    { id: "sub_only", accepts: ["gun"], sameParts: true },
  ],
});

const PLATFORM: PlatformData = decodeStrict(PlatformSchema, {
  id: "fixture_hull",
  hullForm: "fixture_hull",
  slotTemplates: ["fixture_slots"],
});

const PARTS: readonly FlattenedPart[] = [
  gun("g12", 304_800),
  gun("g13", 330_200),
  gun("g6", 152_400),
  mount("m_twin", 2),
  mount("m_single", 1),
  mount("m_casemate", 1, { mountType: "CASEMATE" }),
  mount("m_with_ammo", 2, { ammunition: { min: 1, max: 1 } }),
  ammunition("ap"),
  ammunition("ap_future", "1890-01"),
  ammunition("ap_old", "1880-01", "1885-01"),
  launcher("l14", 355_600),
  launcher("l14_waived", 355_600, [{ forPart: "t18" }]),
  torpedo("t14", 355_600),
  torpedo("t18", 457_200),
  torpedo("t_other", 400_000),
  plant("p_triple", 1000, 5000),
  armourMaterial("iron"),
  armourMaterial("steel", "1890-01"),
  armourMaterial("wrought", "1880-01", "1888-06"),
  fitting("mag_a"),
  fitting("mag_b"),
  fitting("quarters", "accommodation"),
];

const entry = (value: LoadoutEntryData): LoadoutEntryData => value;
const gunsOf = (id: string, n: number) => ({ guns: [{ part: id, mountCount: n }] });

type FitOptions = FitConditions & {
  readonly parts?: readonly FlattenedPart[];
  readonly slotTemplates?: FitInput["catalogue"]["slotTemplates"];
  readonly platforms?: FitInput["catalogue"]["platforms"];
  readonly month?: string;
};

function fit(entries: readonly LoadoutEntryData[], options: FitOptions = {}): FitResult {
  const { parts, slotTemplates, platforms, month, ...conditions } = options;
  return validateLoadoutFit({
    catalogue: {
      parts: parts ?? PARTS,
      slotTemplates: slotTemplates ?? [TEMPLATE],
      platforms: platforms ?? [PLATFORM],
    },
    loadout: decodeStrict(LoadoutSchema, { platform: "fixture_hull", entries }),
    month: month ?? "1890-01",
    conditions,
  });
}

const codes = (r: FitResult) => r.findings.map((f) => f.code);
const dataCodes = (r: FitResult) => r.dataIssues.map((d) => d.code);

const goodMount = (extra: Partial<LoadoutEntryData> = {}): LoadoutEntryData =>
  entry({
    slot: "fwd_main",
    part: "m_twin",
    mountCount: 1,
    stationPermille: 200,
    entries: gunsOf("g12", 2),
    ...extra,
  });

describe("ticket 06 fixtures", () => {
  it("are accepted by the strict schemas, and an undeclared field fails", () => {
    expect(PARTS.length).toBeGreaterThan(10);
    expect(decodeStrictResult(FlattenedPartSchema, { ...gun("x", 1), barrels: 2 })._tag).toBe(
      "Failure",
    );
  });
});

describe("fit: a loadout that fits", () => {
  it("is ACCEPTED with no findings, data issues or waivers", () => {
    const r = fit([goodMount()]);
    expect(r).toMatchObject({ status: "ACCEPTED", findings: [], dataIssues: [], waivers: [] });
  });

  it("accepts a valid repeated use where multiplicity permits it (0..3 forward mounts)", () => {
    for (const n of [0, 1, 2, 3]) {
      const entries = Array.from({ length: n }, () => goodMount());
      expect(fit(entries).status, `${n} entries`).toBe("ACCEPTED");
    }
    expect(fit([goodMount({ mountCount: 3, entries: gunsOf("g12", 6) })]).status).toBe("ACCEPTED");
  });
});

describe("fit: stage 1, the slot exists", () => {
  it("reports an entry in a slot the platform does not have", () => {
    const r = fit([entry({ slot: "aft_secondary", part: "m_single" })]);
    expect(codes(r)).toEqual(["FIT_UNKNOWN_SLOT"]);
    expect(r.findings[0]).toMatchObject({ slot: "aft_secondary", part: "m_single" });
    expect(r.status).toBe("REJECTED");
  });

  it("reports a nested entry in a slot the part does not declare", () => {
    const r = fit([goodMount({ entries: { ...gunsOf("g12", 2), shells: [{ part: "ap" }] } })]);
    expect(r.findings.map((f) => [f.code, f.slot])).toEqual([["FIT_UNKNOWN_SLOT", "shells"]]);
  });

  it("reports feedsFrom naming a slot the platform lacks", () => {
    const r = fit([goodMount({ feedsFrom: "nowhere_magazine" })]);
    expect(codes(r)).toEqual(["FIT_UNKNOWN_SLOT"]);
    expect(r.findings[0]?.detail).toMatchObject({ feedsFrom: "nowhere_magazine" });
  });
});

describe("fit: stage 2, interface and constraints", () => {
  it("rejects a part whose interface the slot does not accept", () => {
    const r = fit([entry({ slot: "fwd_main", part: "p_triple", params: { installedKw: 2000 } })]);
    expect(codes(r)).toEqual(["FIT_INTERFACE_MISMATCH"]);
    expect(r.findings[0]?.detail).toEqual({
      provides: "propulsion_plant",
      accepts: ["gun_mount"],
    });
  });

  it("does not run constraints on a mismatched part", () => {
    const r = fit([entry({ slot: "fwd_main", part: "iron", shape: undefined })]);
    expect(codes(r)).toEqual(["FIT_INTERFACE_MISMATCH"]);
  });

  it("checks a mount type constraint on the resolved spec", () => {
    const r = fit([goodMount({ part: "m_casemate", entries: gunsOf("g12", 1) })]);
    expect(r.findings.map((f) => [f.code, f.detail["constraint"]])).toEqual([
      ["FIT_CONSTRAINT_VIOLATED", "mountTypes"],
    ]);
  });

  it("checks the calibre cap through the mount's nested guns", () => {
    const r = fit([goodMount({ entries: gunsOf("g13", 2) })]);
    expect(r.findings.map((f) => f.detail["constraint"])).toEqual(["calibreInches"]);
    expect(r.findings[0]?.detail).toMatchObject({ value: 330_200, max: 12 * 25_400 });
  });

  it("reports an undeterminable calibre as a data issue, not as incompatibility", () => {
    const r = fit([goodMount({ entries: {} })]);
    expect(dataCodes(r)).toEqual(["FIT_DATA_CONSTRAINT_UNEVALUABLE"]);
    expect(r.status).toBe("NOT_EVALUABLE");
    expect(codes(r)).toEqual(["FIT_COUNT_BELOW_MINIMUM"]);
  });

  it("applies a revision's spec at the design month", () => {
    const withRevision = decodePart({
      ...base("m_revised"),
      family: "gun_mount",
      provides: "gun_mount",
      lifecycle: lifecycle(),
      slots: [{ id: "guns", accepts: ["gun"], mountCount: { min: 2, max: 2 } }],
      spec: { mountType: "TURRET", gunsPerMount: 2 },
      revisions: [
        {
          from: "1885-01",
          spec: { mountType: "CASEMATE" },
          provenance: PROVENANCE,
        },
      ],
    });
    const parts = [...PARTS, withRevision];
    const entries = [goodMount({ part: "m_revised" })];
    expect(fit(entries, { parts, month: "1884-12" }).status).toBe("ACCEPTED");
    expect(codes(fit(entries, { parts, month: "1885-01" }))).toEqual(["FIT_CONSTRAINT_VIOLATED"]);
  });
});

describe("fit: stage 3, mountCount bounds", () => {
  it("rejects a fourth forward mount", () => {
    const r = fit([goodMount({ mountCount: 4, entries: gunsOf("g12", 8) })]);
    expect(r.findings.map((f) => [f.code, f.path])).toEqual([
      ["FIT_COUNT_EXCEEDED", "slots/fwd_main"],
    ]);
    expect(r.findings[0]?.detail).toMatchObject({ total: 4, max: 3 });
  });

  it("sums several entries in one slot", () => {
    const r = fit([goodMount({ mountCount: 2 }), goodMount({ mountCount: 2 })].map((e) => e));
    expect(codes(r)).toContain("FIT_COUNT_EXCEEDED");
  });

  it("rejects an over-full nested guns slot", () => {
    const r = fit([goodMount({ entries: gunsOf("g12", 3) })]);
    expect(r.findings.map((f) => [f.code, f.slot])).toEqual([["FIT_COUNT_EXCEEDED", "guns"]]);
    expect(r.findings[0]?.detail).toMatchObject({ total: 3, min: 2, max: 2 });
  });

  it("scales a nested bound by the parent's installed units", () => {
    const ok = fit([goodMount({ mountCount: 2, entries: gunsOf("g12", 4) })]);
    expect(ok.status).toBe("ACCEPTED");
    const bad = fit([goodMount({ mountCount: 2, entries: gunsOf("g12", 3) })]);
    expect(codes(bad)).toEqual(["FIT_COUNT_BELOW_MINIMUM"]);
  });

  it("rejects duplicate use of a non-repeatable slot", () => {
    const r = fit([
      entry({ slot: "engine", part: "p_triple", params: { installedKw: 2000 } }),
      entry({ slot: "engine", part: "p_triple", params: { installedKw: 2000 } }),
    ]);
    expect(codes(r)).toEqual(["FIT_COUNT_EXCEEDED"]);
  });

  it("reports a required slot left empty", () => {
    const required = decodeStrict(SlotTemplateSchema, {
      id: "fixture_slots",
      slots: [{ id: "engine", accepts: ["propulsion_plant"], mountCount: { min: 1, max: 1 } }],
    });
    const r = fit([], { slotTemplates: [required] });
    expect(r.findings.map((f) => [f.code, f.slot])).toEqual([
      ["FIT_COUNT_BELOW_MINIMUM", "engine"],
    ]);
  });

  it("resolves a mirroring slot to its sibling's definition", () => {
    const stbd = fit([
      entry({ slot: "side_stbd", part: "m_single", mountCount: 2, entries: gunsOf("g6", 2) }),
    ]);
    expect(stbd.findings.map((f) => [f.code, f.slot])).toEqual([
      ["FIT_COUNT_EXCEEDED", "side_stbd"],
    ]);
  });
});

describe("fit: stage 4, lifecycle at the design month", () => {
  const ammoMount = (part: string): LoadoutEntryData =>
    goodMount({
      part: "m_with_ammo",
      entries: { ...gunsOf("g12", 2), ammunition: [{ part }] },
    });

  it("reports a part not yet available, with its date", () => {
    const r = fit([ammoMount("ap_future")], { month: "1889-12" });
    expect(r.findings.map((f) => [f.code, f.detail["availableFrom"]])).toEqual([
      ["FIT_NOT_YET_AVAILABLE", "1890-01"],
    ]);
    expect(fit([ammoMount("ap_future")], { month: "1890-01" }).status).toBe("ACCEPTED");
  });

  it("reports a retired part at the exclusive boundary, with supersededBy", () => {
    expect(fit([ammoMount("ap_old")], { month: "1884-12" }).status).toBe("ACCEPTED");
    const r = fit([ammoMount("ap_old")], { month: "1885-01" });
    expect(r.findings.map((f) => [f.code, f.detail["availableUntil"]])).toEqual([
      ["FIT_UNAVAILABLE", "1885-01"],
    ]);
    const superseded = fit([ammoMount("ap_future")], { month: "1890-01" });
    expect(superseded.status).toBe("ACCEPTED");
    const ap = fit([ammoMount("ap_future")], {
      month: "1895-01",
      parts: [
        ...PARTS.filter((p) => p.id !== "ap_future"),
        ammunition("ap_future", "1890-01", "1895-01"),
        ammunition("ap_next", "1894-01", null, { supersedes: ["ap_future"] }),
      ],
    });
    expect(ap.findings[0]?.detail["supersededBy"]).toEqual(["ap_next"]);
  });

  it("reports a malformed design month as a data issue", () => {
    const r = fit([goodMount()], { month: "1890-13" });
    expect(dataCodes(r)).toEqual(["FIT_DATA_BAD_MONTH"]);
    expect(r.status).toBe("NOT_EVALUABLE");
  });
});

describe("fit: stage 5, national access (the stricter limit wins)", () => {
  const caps = (maxGunCalibreUm: number) => ({ nationId: "uk", maxGunCalibreUm });

  it("a national cap stricter than the platform's wins", () => {
    const r = fit([goodMount()], { nation: caps(254_000) });
    expect(r.findings.map((f) => [f.code, f.detail["reason"]])).toEqual([
      ["FIT_NATION_ACCESS", "calibre_cap"],
    ]);
  });

  it("a platform cap stricter than the national one still wins", () => {
    const r = fit([goodMount({ entries: gunsOf("g13", 2) })], { nation: caps(400_000) });
    expect(codes(r)).toEqual(["FIT_CONSTRAINT_VIOLATED"]);
  });

  it("both limits are reported when both are exceeded", () => {
    const r = fit([goodMount({ entries: gunsOf("g13", 2) })], { nation: caps(254_000) });
    expect(codes(r)).toEqual(["FIT_CONSTRAINT_VIOLATED", "FIT_NATION_ACCESS"]);
  });

  it("a national part is unavailable to another nation, and denial is explicit", () => {
    const national = decodePart({
      ...base("g_fr", "g_fr"),
      family: "gun",
      provides: "gun",
      nation: "france",
      lifecycle: lifecycle(),
      spec: { calibreUm: 152_400 },
    });
    const parts = [...PARTS, national];
    const entries = [entry({ slot: "side_port", part: "m_single", entries: gunsOf("g_fr", 1) })];
    expect(fit(entries, { parts, nation: { nationId: "france" } }).status).toBe("ACCEPTED");
    const r = fit(entries, { parts, nation: { nationId: "uk" } });
    expect(r.findings.map((f) => [f.code, f.detail["reason"]])).toEqual([
      ["FIT_NATION_ACCESS", "part_is_national"],
    ]);
    const denied = fit([goodMount()], { nation: { nationId: "uk", deniedParts: ["m_twin"] } });
    expect(denied.findings.map((f) => f.detail["reason"])).toEqual(["access_denied"]);
  });

  it("applies no national rule when no nation is supplied", () => {
    expect(fit([goodMount()]).status).toBe("ACCEPTED");
  });
});

describe("fit: stage 6, placement", () => {
  it("rejects a station outside the slot's range", () => {
    const r = fit([goodMount({ stationPermille: 500 })]);
    expect(r.findings.map((f) => [f.code, f.detail["from"], f.detail["to"]])).toEqual([
      ["FIT_PLACEMENT", 100, 400],
    ]);
  });

  it("rejects a side the slot does not declare, and accepts the declared one", () => {
    const wrong = fit([
      entry({ slot: "side_port", part: "m_single", side: "STBD", entries: gunsOf("g6", 1) }),
    ]);
    expect(codes(wrong)).toEqual(["FIT_PLACEMENT"]);
    const right = fit([
      entry({ slot: "side_port", part: "m_single", side: "PORT", entries: gunsOf("g6", 1) }),
    ]);
    expect(right.status).toBe("ACCEPTED");
  });
});

describe("fit: data that cannot be evaluated is not an incompatibility", () => {
  it("an unknown part is a data issue", () => {
    const r = fit([entry({ slot: "fwd_main", part: "ghost" })]);
    expect(r.status).toBe("NOT_EVALUABLE");
    expect(dataCodes(r)).toEqual(["FIT_DATA_UNKNOWN_PART"]);
    expect(r.findings).toEqual([]);
  });

  it("an unknown platform, template and duplicate part or slot are data issues", () => {
    const loadout = decodeStrict(LoadoutSchema, { platform: "missing", entries: [] });
    const r = validateLoadoutFit({
      catalogue: { parts: PARTS, slotTemplates: [TEMPLATE], platforms: [PLATFORM] },
      loadout,
      month: "1890-01",
    });
    expect(dataCodes(r)).toEqual(["FIT_DATA_UNKNOWN_PLATFORM"]);

    const dup = validateLoadoutFit({
      catalogue: {
        parts: [...PARTS, gun("g12", 1)],
        slotTemplates: [],
        platforms: [
          { ...PLATFORM, slotTemplates: ["nope"], slots: [slot({ id: "a", accepts: ["gun"] })] },
        ],
      },
      loadout: decodeStrict(LoadoutSchema, { platform: "fixture_hull", entries: [] }),
      month: "1890-01",
    });
    expect(dataCodes(dup)).toEqual(["FIT_DATA_DUPLICATE_PART", "FIT_DATA_UNKNOWN_TEMPLATE"]);
  });

  it("a mirror of a missing or mirroring slot is a data issue", () => {
    const template = decodeStrict(SlotTemplateSchema, {
      id: "fixture_slots",
      slots: [
        { id: "a", accepts: ["gun"] },
        { id: "b", mirrors: "missing" },
        { id: "c", mirrors: "d" },
        { id: "d", mirrors: "a" },
      ],
    });
    const r = fit([], { slotTemplates: [template] });
    expect(dataCodes(r)).toEqual(["FIT_DATA_BAD_MIRROR", "FIT_DATA_BAD_MIRROR"]);
  });

  it("a zero-slot template list cannot be a platform: the schema refuses it first", () => {
    expect(
      decodeStrictResult(PlatformSchema, { id: "p", hullForm: "p", slotTemplates: [] })._tag,
    ).toBe("Failure");
  });

  it("an entry id is decoded, and a malformed one is rejected (ticket 11a)", () => {
    expect(
      decodeStrictResult(LoadoutSchema, {
        platform: "p",
        entries: [{ slot: "s", part: "x", id: "e1" }],
      })._tag,
    ).toBe("Success");
    expect(
      decodeStrictResult(LoadoutSchema, {
        platform: "p",
        entries: [{ slot: "s", part: "x", id: "E 1" }],
      })._tag,
    ).toBe("Failure");
  });
});

describe("fit: plant power range", () => {
  const engine = (kw: number | undefined) =>
    entry({
      slot: "engine",
      part: "p_triple",
      ...(kw === undefined ? {} : { params: { installedKw: kw } }),
    });

  it.each([1000, 3000, 5000])("accepts %i kW inside the declared range", (kw) => {
    expect(fit([engine(kw)]).status).toBe("ACCEPTED");
  });

  it.each([999, 5001])("reports %i kW outside the declared range", (kw) => {
    const r = fit([engine(kw)]);
    expect(r.findings.map((f) => [f.code, f.detail["constraint"], f.detail["value"]])).toEqual([
      ["FIT_CONSTRAINT_VIOLATED", "parameter:installedKw", kw],
    ]);
    expect(r.findings[0]?.detail).toMatchObject({ min: 1000, max: 5000 });
  });

  it("treats an absent installedKw as unevaluable", () => {
    const r = fit([engine(undefined)]);
    expect(dataCodes(r)).toEqual(["FIT_DATA_PARAMETER_MISSING"]);
    expect(r.status).toBe("NOT_EVALUABLE");
  });

  it("treats an undeclared parameter as unevaluable", () => {
    const r = fit([
      entry({ slot: "engine", part: "p_triple", params: { installedKw: 2000, thicknessUm: 5 } }),
    ]);
    expect(dataCodes(r)).toEqual(["FIT_DATA_PARAMETER_UNDECLARED"]);
  });

  it("rejects a value off the declared step", () => {
    const stepped = decodePart({
      ...base("p_step"),
      family: "propulsion_plant",
      provides: "propulsion_plant",
      lifecycle: lifecycle(),
      parameters: { installedKw: { min: 1000, max: 5000, step: 500 } },
      spec: {
        fuelType: "COAL",
        weightMilliKgPerKw: 1,
        volumeLitrePerKw: 1,
        sfcGramPerKwh: { points: [[1, 1]] },
        reliabilityBp: 1,
      },
    });
    const parts = [...PARTS, stepped];
    const at = (kw: number) =>
      fit([entry({ slot: "engine", part: "p_step", params: { installedKw: kw } })], { parts });
    expect(at(1500).status).toBe("ACCEPTED");
    expect(codes(at(1600))).toEqual(["FIT_CONSTRAINT_VIOLATED"]);
  });
});

describe("fit: armour regions", () => {
  const plate = { thicknessUm: 200_000, lengthMm: 40_000, heightMm: 2_000, cosObliquityBp: 10_000 };

  it("fits a material in its region with a plate shape", () => {
    expect(fit([entry({ slot: "armour.belt_main", part: "iron", shape: plate })]).status).toBe(
      "ACCEPTED",
    );
  });

  it("rejects a non-armour part in an armour region", () => {
    const r = fit([entry({ slot: "armour.belt_main", part: "mag_a", shape: plate })]);
    expect(codes(r)).toEqual(["FIT_INTERFACE_MISMATCH"]);
  });

  it("rejects an armour material in a weapon slot", () => {
    expect(codes(fit([entry({ slot: "fwd_main", part: "iron" })]))).toEqual([
      "FIT_INTERFACE_MISMATCH",
    ]);
  });

  it("requires a plate shape in a region, and refuses one elsewhere", () => {
    expect(dataCodes(fit([entry({ slot: "armour.deck", part: "iron" })]))).toEqual([
      "FIT_DATA_SHAPE_MISSING",
    ]);
    expect(dataCodes(fit([goodMount({ shape: plate })]))).toEqual(["FIT_DATA_SHAPE_UNEXPECTED"]);
  });

  it("rejects a malformed plate shape at the schema, not at fit", () => {
    for (const shape of [
      { ...plate, thicknessUm: 0 },
      { ...plate, cosObliquityBp: 10_001 },
      { ...plate, lengthMm: 1.5 },
    ]) {
      expect(
        decodeStrictResult(LoadoutSchema, {
          platform: "p",
          entries: [{ slot: "armour.deck", part: "iron", shape }],
        })._tag,
      ).toBe("Failure");
    }
  });

  it("holds several regions at once, and rejects a prohibited duplicate region entry", () => {
    const both = fit([
      entry({ slot: "armour.belt_main", part: "iron", shape: plate }),
      entry({ slot: "armour.deck", part: "iron", shape: plate }),
      entry({ slot: "armour.deck", part: "steel", shape: plate }),
    ]);
    expect(both.status).toBe("ACCEPTED");
    const dup = fit([
      entry({ slot: "armour.belt_main", part: "iron", shape: plate }),
      entry({ slot: "armour.belt_main", part: "iron", shape: plate }),
    ]);
    expect(codes(dup)).toEqual(["FIT_COUNT_EXCEEDED"]);
  });

  it("checks material availability on both sides of an exclusive boundary", () => {
    const at = (month: string, part: string) =>
      fit([entry({ slot: "armour.belt_main", part, shape: plate })], { month });
    expect(at("1888-05", "wrought").status).toBe("ACCEPTED");
    expect(codes(at("1888-06", "wrought"))).toEqual(["FIT_UNAVAILABLE"]);
    expect(codes(at("1889-12", "steel"))).toEqual(["FIT_NOT_YET_AVAILABLE"]);
    expect(at("1890-01", "steel").status).toBe("ACCEPTED");
  });
});

describe("fit: torpedo launchers (synthetic)", () => {
  const tube = (launcherId: string, torpedoId: string): LoadoutEntryData =>
    entry({
      slot: "tubes",
      part: launcherId,
      mountCount: 2,
      entries: { torpedo: [{ part: torpedoId }] },
    });

  it("accepts a matching bore", () => {
    expect(fit([tube("l14", "t14")]).status).toBe("ACCEPTED");
  });

  it("rejects a mismatch on diameterUmEqualsBore with the diameters", () => {
    const r = fit([tube("l14", "t18")]);
    expect(r.findings.map((f) => [f.code, f.slot, f.detail["constraint"]])).toEqual([
      ["FIT_CONSTRAINT_VIOLATED", "torpedo", "diameterUmEqualsBore"],
    ]);
    expect(r.findings[0]?.detail).toMatchObject({
      boreDiameterUm: 355_600,
      torpedoDiameterUm: 457_200,
    });
  });

  it("a waiver permits exactly the named torpedo, and is reported", () => {
    const r = fit([tube("l14_waived", "t18")]);
    expect(r.status).toBe("ACCEPTED");
    expect(r.waivers).toHaveLength(1);
    expect(r.waivers[0]).toMatchObject({
      launcher: "l14_waived",
      torpedo: "t18",
      code: "DQ-TORPEDO-001",
      waives: "diameterUmEqualsBore",
    });
    expect(codes(fit([tube("l14_waived", "t_other")]))).toEqual(["FIT_CONSTRAINT_VIOLATED"]);
  });

  it("a waiver does not disable unrelated rules", () => {
    const r = fit([
      entry({
        slot: "tubes",
        part: "l14_waived",
        entries: { torpedo: [{ part: "t18" }, { part: "mag_a" }] },
      }),
    ]);
    expect(r.waivers).toHaveLength(1);
    expect(codes(r)).toEqual(["FIT_INTERFACE_MISMATCH"]);
    expect(codes(fit([entry({ slot: "nope", part: "l14_waived" })]))).toEqual(["FIT_UNKNOWN_SLOT"]);
  });

  it("a waiver on a record that is not a launcher is never honoured", () => {
    const forged: FlattenedPart = {
      ...mount("m_forged", 1),
      legacyExceptions: [
        { code: "DQ-TORPEDO-001", waives: "diameterUmEqualsBore", forPart: "t18", note: "forged" },
      ],
    };
    expect(decodeStrictResult(FlattenedPartSchema, forged)._tag).toBe("Failure");
    const slotted: FlattenedPart = {
      ...forged,
      slots: [{ id: "torpedo", accepts: ["torpedo"], constraints: { diameterUmEqualsBore: true } }],
    };
    const r = fit(
      [
        entry({
          slot: "fwd_main",
          part: "m_forged",
          stationPermille: 200,
          entries: { torpedo: [{ part: "t18" }] },
        }),
      ],
      { parts: [...PARTS, slotted] },
    );
    expect(r.waivers).toEqual([]);
    expect(r.dataIssues.map((d) => d.code)).toContain("FIT_DATA_CONSTRAINT_UNEVALUABLE");
  });
});

describe("fit: nested ammunition", () => {
  const ammoCarrier = (nested: readonly { part: string; mountCount?: number }[]) =>
    goodMount({
      part: "m_with_ammo",
      entries: { ...gunsOf("g12", 2), ammunition: nested },
    });

  it("nests compatible ammunition under an explicitly constructed ammunition slot", () => {
    const r = fit([ammoCarrier([{ part: "ap" }])], { ammunitionCompatibility: { ap: ["g12"] } });
    expect(r.status).toBe("ACCEPTED");
    expect(PARTS.find((p) => p.id === "m_with_ammo")?.slots?.map((s) => s.id)).toEqual([
      "guns",
      "ammunition",
    ]);
  });

  it("rejects ammunition that does not feed the nested gun", () => {
    const r = fit([ammoCarrier([{ part: "ap" }])], { ammunitionCompatibility: { ap: ["g6"] } });
    expect(r.findings.map((f) => [f.code, f.detail["constraint"], f.detail["guns"]])).toEqual([
      ["FIT_CONSTRAINT_VIOLATED", "ammunitionCompatibleGun", ["g12"]],
    ]);
  });

  it("rejects a non-ammunition part in the ammunition slot", () => {
    expect(codes(fit([ammoCarrier([{ part: "mag_a" }])]))).toEqual(["FIT_INTERFACE_MISMATCH"]);
  });

  it("reports unavailable ammunition", () => {
    expect(codes(fit([ammoCarrier([{ part: "ap_future" }])], { month: "1889-12" }))).toEqual([
      "FIT_NOT_YET_AVAILABLE",
    ]);
  });

  it("reports missing and excess ammunition against the declared bounds", () => {
    expect(codes(fit([ammoCarrier([])]))).toEqual(["FIT_COUNT_BELOW_MINIMUM"]);
    expect(codes(fit([ammoCarrier([{ part: "ap" }, { part: "ap" }])]))).toEqual([
      "FIT_COUNT_EXCEEDED",
    ]);
  });

  it("does not require ammunition where the mount declares no ammunition slot", () => {
    expect(fit([goodMount()]).status).toBe("ACCEPTED");
  });

  it("returns a structured diagnostic, not a guess, when two magazines could feed it", () => {
    const entries = [
      ammoCarrier([{ part: "ap" }]),
      entry({ slot: "fwd_magazine", part: "mag_a" }),
      entry({ slot: "fwd_magazine", part: "mag_b" }),
    ];
    const r = fit(entries);
    expect(r.status).toBe("ACCEPTED");
    expect(r.unresolved.map((u) => [u.code, u.candidates])).toEqual([
      ["FIT_MAGAZINE_AMBIGUOUS", ["entries/fwd_magazine/mag_a#1", "entries/fwd_magazine/mag_b#1"]],
    ]);
  });

  it("is unique with one magazine, and undetermined with none", () => {
    const one = fit([
      ammoCarrier([{ part: "ap" }]),
      entry({ slot: "fwd_magazine", part: "mag_a" }),
    ]);
    expect(one.unresolved).toEqual([]);
    const none = fit([ammoCarrier([{ part: "ap" }])]);
    expect(none.unresolved.map((u) => u.code)).toEqual(["FIT_MAGAZINE_UNDETERMINED"]);
  });

  it("never invents rounds or a magazine reference on the entries it reads", () => {
    const e = ammoCarrier([{ part: "ap" }]);
    fit([e]);
    expect(Object.keys(e)).not.toContain("rounds");
    expect(Object.keys(e)).not.toContain("magazineRef");
    expect(e.entries?.["ammunition"]?.[0]).toEqual({ part: "ap" });
  });
});

function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

describe("fit: deterministic ordering", () => {
  const failing: readonly LoadoutEntryData[] = [
    goodMount({ mountCount: 4, entries: gunsOf("g13", 8), stationPermille: 900 }),
    entry({ slot: "engine", part: "p_triple", params: { installedKw: 10 } }),
    entry({ slot: "engine", part: "mag_a" }),
    entry({ slot: "missing_slot", part: "m_single" }),
    entry({ slot: "tubes", part: "l14", entries: { torpedo: [{ part: "t18" }] } }),
    entry({
      slot: "armour.deck",
      part: "wrought",
      shape: {
        thicknessUm: 1,
        lengthMm: 1,
        heightMm: 1,
        cosObliquityBp: 1,
      },
    }),
    entry({ slot: "fwd_magazine", part: "mag_b" }),
    entry({ slot: "fwd_magazine", part: "mag_a" }),
  ];

  it("returns findings in the contractual code order, then path", () => {
    const r = fit(failing, {
      month: "1890-01",
      nation: { nationId: "uk", maxGunCalibreUm: 200_000 },
    });
    const rank = (c: string) => FIT_FINDING_CODES.indexOf(c as (typeof FIT_FINDING_CODES)[number]);
    const ranks = r.findings.map((f) => rank(f.code));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(codes(r)).size).toBeGreaterThanOrEqual(5);
    expect(r.status).toBe("REJECTED");
  });

  it("is identical across runs and across shuffled entries, parts, slots and templates", () => {
    const reference = fit(failing, { nation: { nationId: "uk", maxGunCalibreUm: 200_000 } });
    for (let seed = 1; seed <= 12; seed++) {
      const template = decodeStrict(SlotTemplateSchema, {
        ...TEMPLATE,
        slots: shuffle(TEMPLATE.slots, seed),
      });
      const shuffled = fit(shuffle(failing, seed), {
        parts: shuffle(PARTS, seed),
        slotTemplates: [template],
        nation: { nationId: "uk", maxGunCalibreUm: 200_000 },
      });
      expect(shuffled, `seed ${seed}`).toEqual(reference);
    }
  });

  it("addresses duplicate identical entries with a stable ordinal", () => {
    const r = fit([
      goodMount({ mountCount: 1 }),
      goodMount({ mountCount: 1 }),
      goodMount({ mountCount: 1 }),
      goodMount({ mountCount: 1, stationPermille: 900 }),
    ]);
    expect(r.findings.map((f) => f.path)).toEqual(["slots/fwd_main", "entries/fwd_main/m_twin#4"]);
  });
});

describe("fit: ship-type requirements (SPM-R12, ticket 12b)", () => {
  it("emits no TYPE_REQUIRES_* finding when the type declares none", () => {
    expect(fit([goodMount()], { shipTypeRequirements: [] }).status).toBe("ACCEPTED");
  });

  it("reports a required slot the loadout does not fill", () => {
    const r = fit([], {
      shipTypeRequirements: [
        { slot: "fwd_main", interface: "gun_mount", constraints: {}, mountCountMin: 1 },
      ],
    });
    expect(codes(r)).toEqual(["TYPE_REQUIRES_SLOT_MISSING"]);
    expect(r.findings[0]).toMatchObject({ slot: "fwd_main", part: null });
    expect(r.status).toBe("REJECTED");
  });

  it("reports an entry that does not provide the required interface", () => {
    const r = fit([goodMount()], {
      shipTypeRequirements: [{ slot: "fwd_main", interface: "magazine", constraints: {} }],
    });
    expect(codes(r)).toEqual(["TYPE_REQUIRES_INTERFACE_MISMATCH"]);
  });

  it("reports a constraint no candidate in the slot satisfies", () => {
    const r = fit([goodMount()], {
      shipTypeRequirements: [
        { slot: "fwd_main", interface: "gun_mount", constraints: { calibreInchesMin: 13 } },
      ],
    });
    expect(codes(r)).toEqual(["TYPE_REQUIRES_CONSTRAINT_VIOLATED"]);
    expect(r.findings[0]?.part).toBe("m_twin");
  });

  it("reports a mount count below the required minimum", () => {
    const r = fit([goodMount()], {
      shipTypeRequirements: [
        { slot: "fwd_main", interface: "gun_mount", constraints: {}, mountCountMin: 2 },
      ],
    });
    expect(codes(r)).toEqual(["TYPE_REQUIRES_MOUNT_COUNT"]);
    expect(r.findings[0]?.detail).toMatchObject({ total: 1, min: 2 });
  });

  it("accepts a requirement met by a multi-unit entry", () => {
    const r = fit([goodMount({ mountCount: 2, entries: gunsOf("g12", 4) })], {
      shipTypeRequirements: [
        { slot: "fwd_main", interface: "gun_mount", constraints: {}, mountCountMin: 2 },
      ],
    });
    expect(r.status).toBe("ACCEPTED");
  });

  it("sorts them in the contractual code order and is stable across runs", () => {
    const requirements = [
      { slot: "fwd_main", interface: "gun_mount", constraints: {}, mountCountMin: 2 },
      { slot: "fwd_main", interface: "magazine", constraints: {} },
    ] as const;
    const r = fit([goodMount()], { shipTypeRequirements: requirements });
    expect(codes(r)).toEqual(["TYPE_REQUIRES_INTERFACE_MISMATCH", "TYPE_REQUIRES_MOUNT_COUNT"]);
    const rank = (c: string) => FIT_FINDING_CODES.indexOf(c as (typeof FIT_FINDING_CODES)[number]);
    const ranks = r.findings.map((f) => rank(f.code));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(fit([goodMount()], { shipTypeRequirements: requirements })).toEqual(r);
  });
});

describe("fit: ship-type requirements name real dotted platform slots (ticket 12b)", () => {
  const plate = {
    thicknessUm: 200_000,
    lengthMm: 40_000,
    heightMm: 2_000,
    cosObliquityBp: 10_000,
  };
  const beltEntry = entry({ slot: "armour.belt_main", part: "iron", shape: plate });
  const beltRequirement = (extra: Partial<ShipTypeRequirement> = {}): ShipTypeRequirement => ({
    slot: "armour.belt_main",
    interface: "armour_material",
    constraints: {},
    ...extra,
  });

  it("accepts a loadout that fills the dotted slot the type requires", () => {
    const r = fit([beltEntry], { shipTypeRequirements: [beltRequirement({ mountCountMin: 1 })] });
    expect(r.status).toBe("ACCEPTED");
  });

  it("reports the dotted slot missing when the loadout does not fill it", () => {
    const r = fit([], { shipTypeRequirements: [beltRequirement()] });
    expect(codes(r)).toEqual(["TYPE_REQUIRES_SLOT_MISSING"]);
    expect(r.findings[0]).toMatchObject({ slot: "armour.belt_main", part: null });
  });

  it("reports an interface mismatch for the dotted slot", () => {
    const r = fit([beltEntry], {
      shipTypeRequirements: [beltRequirement({ interface: "gun_mount" })],
    });
    expect(codes(r)).toEqual(["TYPE_REQUIRES_INTERFACE_MISMATCH"]);
  });

  it("reports a mount count below the dotted slot's required minimum", () => {
    const r = fit([beltEntry], { shipTypeRequirements: [beltRequirement({ mountCountMin: 2 })] });
    expect(codes(r)).toEqual(["TYPE_REQUIRES_MOUNT_COUNT"]);
    expect(r.findings[0]?.detail).toMatchObject({ total: 1, min: 2 });
  });
});

describe("fit: the derivation barrier", () => {
  it("derives only from an accepted fit", () => {
    let calls = 0;
    const derive = () => {
      calls += 1;
      return 42;
    };
    const ok = deriveAfterFit(fit([goodMount()]), derive);
    expect(ok).toMatchObject({ derived: true, value: 42 });
    const rejected = deriveAfterFit(fit([goodMount({ mountCount: 9 })]), derive);
    expect(rejected.derived).toBe(false);
    expect(rejected.fit.findings.length).toBeGreaterThan(0);
    const unevaluable = deriveAfterFit(fit([entry({ slot: "fwd_main", part: "ghost" })]), derive);
    expect(unevaluable.derived).toBe(false);
    expect(calls).toBe(1);
  });
});
