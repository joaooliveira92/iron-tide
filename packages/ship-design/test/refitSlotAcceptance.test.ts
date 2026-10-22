import {
  CompiledPartModelSchema,
  FlattenedPartSchema,
  LoadoutSchema,
  PlatformSchema,
  SlotTemplateSchema,
  decodeStrict,
  type CompiledPartModel,
  type FlattenedPart,
} from "@bluewave/content-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  SEVERITY_ORDER,
  evaluateRefit,
  validateLoadoutFit,
  type ComponentDef,
  type FitResult,
  type RefitPlan,
  type ShipContext,
  type ShipState,
} from "../src/index.js";
import { ctx as baseCtx, costBalance, draft, refitBalance } from "./fixtures/gunboat.js";

const PROVENANCE = {
  sourceStatus: "PLACEHOLDER",
  confidence: "LOW",
  kind: "game_conversion",
  sources: [],
  note: "ticket 14 fixture",
} as const;

const mountPart = (id: string, mountType: string, supersedes?: readonly string[]): FlattenedPart =>
  decodeStrict(FlattenedPartSchema, {
    id,
    family: "gun_mount",
    provides: "gun_mount",
    name: id,
    lifecycle: {
      availableFrom: "1880-01",
      ...(supersedes === undefined ? {} : { supersedes: [...supersedes] }),
    },
    spec: { mountType, gunsPerMount: 1 },
    quantities: [],
    revisions: [],
    origin: { sourceFile: "fixture.yaml" },
    provenance: PROVENANCE,
  });

const TEMPLATE = decodeStrict(SlotTemplateSchema, {
  id: "fixture_slots",
  slots: [{ id: "fwd_main", accepts: ["gun_mount"], constraints: { mountTypes: ["TURRET"] } }],
});
const PLATFORM = decodeStrict(PlatformSchema, {
  id: "fixture_hull",
  hullForm: "fixture_hull",
  slotTemplates: ["fixture_slots"],
});

function fitPart(part: FlattenedPart): FitResult {
  return validateLoadoutFit({
    catalogue: { parts: [part], slotTemplates: [TEMPLATE], platforms: [PLATFORM] },
    loadout: decodeStrict(LoadoutSchema, {
      platform: "fixture_hull",
      entries: [{ slot: "fwd_main", part: part.id }],
    }),
    month: "1890-01",
  });
}

describe("refit compatibility is slot acceptance, never succession (SPM-R18, I-7)", () => {
  it("rejects a successor whose resolved spec violates the slot's constraint", () => {
    const successor = mountPart("mount_successor", "CASEMATE", ["mount_old"]);
    expect(successor.lifecycle.supersedes).toEqual(["mount_old"]);
    const r = fitPart(successor);
    expect(r.status).toBe("REJECTED");
    expect(r.findings.map((f) => [f.code, f.detail["constraint"]])).toEqual([
      ["FIT_CONSTRAINT_VIOLATED", "mountTypes"],
    ]);
  });

  it("allows a non-successor whose spec the slot accepts", () => {
    const plain = mountPart("mount_plain", "TURRET");
    expect(plain.lifecycle.supersedes).toBeUndefined();
    expect(fitPart(plain).status).toBe("ACCEPTED");
  });

  it("neither helps nor blocks a successor that the slot actually accepts", () => {
    expect(fitPart(mountPart("mount_ok", "TURRET", ["mount_old"])).status).toBe("ACCEPTED");
  });
});

const sensorPart = (id: string, massKg: number, supersedes?: readonly string[]): FlattenedPart =>
  decodeStrict(FlattenedPartSchema, {
    id,
    family: "sensor",
    provides: "sensor",
    name: id,
    lifecycle: {
      availableFrom: "1880-01",
      ...(supersedes === undefined ? {} : { supersedes: [...supersedes] }),
    },
    spec: {},
    quantities: [{ id: "sensor_mass", kind: "massKg", value: massKg, basis: "PER_PART_UNIT" }],
    revisions: [],
    origin: { sourceFile: "fixture.yaml" },
    provenance: PROVENANCE,
  });

const sensorOld = sensorPart("sensor_old", 1_000);
const sensorNext = sensorPart("sensor_next", 50_000, ["sensor_old"]);

const gunPart = (id: string, family: string, calibreUm: number): FlattenedPart =>
  decodeStrict(FlattenedPartSchema, {
    id,
    family: "gun",
    provides: "gun",
    name: id,
    lifecycle: { availableFrom: "1880-01" },
    spec: { calibreUm, gunFamily: family },
    quantities: [],
    revisions: [],
    origin: { sourceFile: "ship-building/components.yaml" },
    provenance: PROVENANCE,
  });
const gun6pdr = gunPart("standard_qf_6pdr", "qf_6pdr", 57_000);
const gun47in = gunPart("standard_qf_47in", "qf_47in", 119_380);

const partModel: CompiledPartModel = decodeStrict(CompiledPartModelSchema, {
  partIndex: {
    byId: {
      sensor_old: sensorOld,
      sensor_next: sensorNext,
      standard_qf_6pdr: gun6pdr,
      standard_qf_47in: gun47in,
    },
    byInterface: {
      sensor: ["sensor_next", "sensor_old"],
      gun: ["standard_qf_47in", "standard_qf_6pdr"],
    },
    byFamily: {
      sensor: ["sensor_next", "sensor_old"],
      gun: ["standard_qf_47in", "standard_qf_6pdr"],
    },
    lineage: {},
    shipTypes: [],
  },
  slotTemplates: [],
  platforms: [
    {
      id: "fine_light",
      hullForm: "fine_light",
      slotTemplates: [],
      slots: [
        {
          id: "superstructure.sensor",
          accepts: ["sensor"],
          constraints: { massKgMax: 40_000 },
        },
      ],
    },
  ],
});

const director: ComponentDef = {
  id: "sensor_old",
  displayName: "Sensor Old",
  category: "DIRECTOR",
  introduction: { fromMonth: "1890-01", obsoleteMonth: null },
  requires: [],
  parameters: {},
  constants: {},
  weightKg: "500",
  volumeLitre: "800",
  costMicro: "400000000",
  crew: "3",
  powerKw: "6",
  upgradePath: [],
  tags: [],
  deckFootprintMm2: "900000",
  heightMm: "1800",
  zCgMm: "7500",
  fcClasses: ["light"],
  attributes: { accuracyBonusBp: "2500", capacity: "6" },
};
const next: ComponentDef = { ...director, id: "sensor_next", displayName: "Sensor Next" };
const aviation: ComponentDef = {
  ...director,
  id: "aviation_fixture",
  displayName: "Aviation Facility",
  category: "AIRCRAFT_FACILITY",
  fcClasses: [],
  attributes: {},
};

const refitCtx: ShipContext = {
  ...baseCtx,
  catalogue: [...baseCtx.catalogue, director, next, aviation],
  partModel,
};

const sensorShip: ShipState = {
  design: draft,
  growthBudgetKg: 200_000,
  hullFatigueBp: 1_000,
  remainingServiceMonths: 180,
  refitCount: 0,
};

const addSensor = (componentId: string): RefitPlan => ({
  kind: "SENSOR_FC_UPDATE",
  removeInstanceIds: [],
  add: [{ instanceId: "new_sensor", componentId, zoneId: "SUPERSTRUCTURE", stationPermille: 520 }],
});

const run = (
  plan: RefitPlan,
  ctx: ShipContext = refitCtx,
  ship: ShipState = sensorShip,
): ReturnType<typeof evaluateRefit> =>
  evaluateRefit(
    ship,
    plan,
    ctx,
    refitBalance,
    costBalance,
    { maturityBpByTech: {}, firstOfClass: false },
    2_000_000,
  );

const ids = (r: ReturnType<typeof run>) => r.findings.map((f) => f.id);
const mismatchCount = (r: ReturnType<typeof run>) =>
  r.findings.filter((f) => f.id === "REFIT_KIND_MISMATCH").length;
const slotRejectionCount = (r: ReturnType<typeof run>) =>
  r.findings.filter((f) => f.id === "REFIT_SLOT_REJECTED").length;

describe("refit slot acceptance against the compiled part model (SPM-R18)", () => {
  it("rejects a successor the slot's constraint rejects, and blocks the refit", () => {
    const r = run(addSensor("sensor_next"));
    expect(r.legal).toBe(false);
    expect(ids(r)).toContain("REFIT_SLOT_REJECTED");
    expect(r.nextState).toBe(sensorShip);
  });

  it("allows a non-successor the slot accepts", () => {
    const r = run(addSensor("sensor_old"));
    expect(ids(r)).not.toContain("REFIT_SLOT_REJECTED");
    expect(r.legal).toBe(true);
  });

  it("keeps the interface rule: a part outside the kind is REFIT_KIND_MISMATCH", () => {
    const r = run({
      kind: "SENSOR_FC_UPDATE",
      removeInstanceIds: [],
      add: [
        {
          instanceId: "gun",
          componentId: "qf_47in",
          zoneId: "FORECASTLE",
          stationPermille: 40,
          params: { barrels: 1, rounds: 100 },
        },
      ],
    });
    expect(ids(r)).toContain("REFIT_KIND_MISMATCH");
  });
});

const gunPlan = (kind: RefitPlan["kind"]): RefitPlan => ({
  kind,
  removeInstanceIds: [],
  add: [
    {
      instanceId: "gun",
      componentId: "qf_6pdr",
      zoneId: "FORECASTLE",
      stationPermille: 40,
      params: { barrels: 1, rounds: 50 },
    },
  ],
});

describe("a gun's refit-kind decision is the same with and without a part model (HIGH-1)", () => {
  for (const kind of ["REARMAMENT", "AA_UPGRADE", "MACHINERY_REFIT"] as const) {
    it(`${kind}: the two contexts agree`, () => {
      expect(mismatchCount(run(gunPlan(kind), refitCtx))).toBe(
        mismatchCount(run(gunPlan(kind), baseCtx)),
      );
    });
  }

  it("allows an AA gun in AA_UPGRADE and REARMAMENT, and rejects it in MACHINERY_REFIT", () => {
    for (const ctx of [baseCtx, refitCtx]) {
      expect(mismatchCount(run(gunPlan("AA_UPGRADE"), ctx))).toBe(0);
      expect(mismatchCount(run(gunPlan("REARMAMENT"), ctx))).toBe(0);
      expect(mismatchCount(run(gunPlan("MACHINERY_REFIT"), ctx))).toBe(1);
    }
  });
});

describe("AVIATION_CONVERSION (deferred: no aircraft-facility interface yet)", () => {
  const legacyAviationCtx: ShipContext = {
    ...baseCtx,
    catalogue: [...baseCtx.catalogue, aviation],
  };
  const plan: RefitPlan = {
    kind: "AVIATION_CONVERSION",
    removeInstanceIds: [],
    add: [
      {
        instanceId: "av",
        componentId: "aviation_fixture",
        zoneId: "MISSION",
        stationPermille: 500,
      },
    ],
  };

  it("rejects an aviation-facility touch with REFIT_KIND_MISMATCH in both contexts", () => {
    for (const ctx of [legacyAviationCtx, refitCtx]) {
      const r = run(plan, ctx);
      expect(ids(r)).toContain("REFIT_KIND_MISMATCH");
      expect(r.legal).toBe(false);
    }
  });
});

describe("slot acceptance applies to incoming additions only (ticket 14 follow-up)", () => {
  const installedSensorShip = (componentId: string): ShipState => ({
    ...sensorShip,
    design: {
      ...draft,
      placements: draft.placements.map((p) => (p.instanceId === "rf" ? { ...p, componentId } : p)),
    },
  });

  const removeSensor: RefitPlan = {
    kind: "SENSOR_FC_UPDATE",
    removeInstanceIds: ["rf"],
    add: [],
  };

  it("does not emit REFIT_SLOT_REJECTED when only removing an installed part the slot would reject", () => {
    const r = run(removeSensor, refitCtx, installedSensorShip("sensor_next"));
    expect(ids(r)).not.toContain("REFIT_SLOT_REJECTED");
    expect(r.legal).toBe(true);
  });

  it("still emits blocking REFIT_SLOT_REJECTED for an incompatible incoming part in that slot", () => {
    const r = run(addSensor("sensor_next"));
    expect(slotRejectionCount(r)).toBe(1);
    expect(r.legal).toBe(false);
  });

  it("ignores the removed part when a mixed plan is valid: removal-heavy, addition-accepted", () => {
    const plan: RefitPlan = {
      kind: "SENSOR_FC_UPDATE",
      removeInstanceIds: ["rf"],
      add: [
        {
          instanceId: "new_sensor",
          componentId: "sensor_old",
          zoneId: "SUPERSTRUCTURE",
          stationPermille: 520,
        },
      ],
    };
    const r = run(plan, refitCtx, installedSensorShip("sensor_next"));
    expect(ids(r)).not.toContain("REFIT_SLOT_REJECTED");
    expect(r.legal).toBe(true);
  });

  it("validates the addition while ignoring the removed part: a mixed plan rejects only the addition", () => {
    const plan: RefitPlan = {
      kind: "SENSOR_FC_UPDATE",
      removeInstanceIds: ["rf"],
      add: [
        {
          instanceId: "new_sensor",
          componentId: "sensor_next",
          zoneId: "SUPERSTRUCTURE",
          stationPermille: 520,
        },
      ],
    };
    const r = run(plan, refitCtx, installedSensorShip("sensor_next"));
    expect(slotRejectionCount(r)).toBe(1);
    expect(r.legal).toBe(false);
  });

  it("keeps diagnostic ordering deterministic across repeated mixed evaluations", () => {
    const plan: RefitPlan = {
      kind: "SENSOR_FC_UPDATE",
      removeInstanceIds: ["rf"],
      add: [
        {
          instanceId: "new_sensor",
          componentId: "sensor_next",
          zoneId: "SUPERSTRUCTURE",
          stationPermille: 520,
        },
      ],
    };
    const first = run(plan, refitCtx, installedSensorShip("sensor_next"));
    const second = run(plan, refitCtx, installedSensorShip("sensor_next"));
    expect(ids(first)).toEqual(ids(second));
    const rank = (s: string) => SEVERITY_ORDER.indexOf(s as (typeof SEVERITY_ORDER)[number]);
    const keys = first.findings.map((x) => [rank(x.severity), x.id, x.evidence.formulaId] as const);
    const le = (a: (typeof keys)[number], b: (typeof keys)[number]): boolean =>
      a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] <= b[2];
    for (let i = 1; i < keys.length; i++) {
      expect(le(keys[i - 1]!, keys[i]!)).toBe(true);
    }
  });
});
