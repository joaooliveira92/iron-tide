import { describe, it, expect } from "vite-plus/test";
import {
  ammunitionId,
  armamentNationId,
  armamentTechnologyId,
  gunFamilyId,
  gunModelId,
  gunMountId,
  lintArmament,
  type AmmunitionPattern,
  type ArmamentCatalogue,
  type ArmamentProvenance,
  type GunFamily,
  type GunModel,
  type GunMountDef,
} from "../src/index.js";

const provenance = (overrides: Partial<ArmamentProvenance> = {}): ArmamentProvenance => ({
  sourceStatus: "VERIFIED",
  confidence: "HIGH",
  kind: "historical_fact",
  sources: [{ title: "test source" }],
  ...overrides,
});

const family = (overrides: Partial<GunFamily> = {}): GunFamily => ({
  id: gunFamilyId("gun_test"),
  designation: "Test family",
  category: "MAIN_GUN",
  provenance: provenance(),
  ...overrides,
});

const model = (overrides: Partial<GunModel> = {}): GunModel => ({
  id: gunModelId("uk_gun_test_mk1"),
  familyId: gunFamilyId("gun_test"),
  designation: "Test model",
  caliberUm: 152_000,
  gunMassKg: 5_000,
  shellMassG: 45_000,
  propellantChargeBp: 4_800,
  roundVolumeMl: 30_000,
  mechanicalRateOfFireRoundsPerMinuteX100: 400,
  reliabilityBp: 9_000,
  introductionMonth: "1880-01",
  retirementMonth: null,
  supportedMountTypes: ["TURRET"],
  requiredTechnologyIds: [armamentTechnologyId("gun_breech_rifled")],
  provenance: provenance(),
  ...overrides,
});

const mount = (overrides: Partial<GunMountDef> = {}): GunMountDef => ({
  id: gunMountId("gun_test_turret"),
  mountType: "TURRET",
  compatibleGunFamilies: [gunFamilyId("gun_test")],
  gunCount: 2,
  baseInstallationMassKg: 1_800,
  perGunInstallationMassKg: 7_600,
  firingArcDeg: 150,
  introductionMonth: "1880-01",
  retirementMonth: null,
  requiredTechnologyIds: [],
  provenance: provenance(),
  ...overrides,
});

const ammunition = (overrides: Partial<AmmunitionPattern> = {}): AmmunitionPattern => ({
  id: ammunitionId("uk_ap"),
  shellType: "AP",
  compatibleGunFamilies: [gunFamilyId("gun_test")],
  penetrationBiasBp: 9_000,
  introductionMonth: "1880-01",
  retirementMonth: null,
  provenance: provenance(),
  ...overrides,
});

const catalogue = (overrides: Partial<ArmamentCatalogue> = {}): ArmamentCatalogue => ({
  families: [family()],
  models: [model()],
  mounts: [mount()],
  ammunition: [ammunition()],
  ...overrides,
});

const options = (overrides: Partial<Parameters<typeof lintArmament>[1]> = {}) => ({
  release: true,
  knownTechnologyIds: new Set([armamentTechnologyId("gun_breech_rifled")]),
  knownNationIds: new Set([armamentNationId("uk")]),
  nationOfModel: { uk_gun_test_mk1: "uk" },
  nationOfAmmunition: { uk_ap: "uk" },
  ...overrides,
});

const codes = (findings: readonly { code: string }[]) => findings.map((f) => f.code);
const severities = (findings: readonly { severity: string }[]) => findings.map((f) => f.severity);

describe("lintArmament — a clean release catalogue", () => {
  it("produces no findings for a fully sourced, consistent catalogue", () => {
    expect(lintArmament(catalogue(), options())).toEqual([]);
  });

  it("does not mutate its input", () => {
    const c = catalogue();
    const snapshot = JSON.stringify(c);
    lintArmament(c, options());
    expect(JSON.stringify(c)).toBe(snapshot);
  });

  it("orders findings deterministically by severity then code", () => {
    const a = lintArmament(
      catalogue({ models: [model({ id: gunModelId("bad id" as never), caliberUm: 0 })] }),
      options(),
    );
    const b = lintArmament(
      catalogue({ models: [model({ id: gunModelId("bad id" as never), caliberUm: 0 })] }),
      options(),
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(severities(a).every((s) => s === "BLOCKING")).toBe(true);
  });
});

describe("lintArmament — ids and references", () => {
  it("blocks a non-canonical id", () => {
    expect(
      codes(
        lintArmament(
          catalogue({ families: [family({ id: gunFamilyId("Bad" as never) })] }),
          options(),
        ),
      ),
    ).toContain("ARMAMENT_ID_INVALID");
  });

  it("blocks duplicate ids in a collection", () => {
    const findings = lintArmament(catalogue({ mounts: [mount(), mount()] }), options());
    expect(codes(findings)).toContain("ARMAMENT_ID_DUPLICATE");
  });

  it("blocks an id reused across collections", () => {
    const findings = lintArmament(
      catalogue({ ammunition: [ammunition({ id: ammunitionId("gun_test") })] }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_ID_DUPLICATE");
  });

  it("blocks a model referencing an unknown family", () => {
    const findings = lintArmament(
      catalogue({ models: [model({ familyId: gunFamilyId("missing") })] }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_REFERENCE_MISSING");
  });

  it("blocks a mount and ammunition referencing an unknown family", () => {
    const findings = lintArmament(
      catalogue({
        mounts: [mount({ compatibleGunFamilies: [gunFamilyId("missing")] })],
        ammunition: [ammunition({ compatibleGunFamilies: [gunFamilyId("missing")] })],
      }),
      options(),
    );
    expect(
      findings.filter((f) => f.code === "ARMAMENT_REFERENCE_MISSING").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("blocks an unknown required technology", () => {
    const findings = lintArmament(
      catalogue({ models: [model({ requiredTechnologyIds: [armamentTechnologyId("ghost")] })] }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_REFERENCE_MISSING");
  });

  it("blocks an unknown nation", () => {
    const findings = lintArmament(catalogue(), options({ knownNationIds: new Set(["france"]) }));
    expect(codes(findings)).toContain("ARMAMENT_NATION_UNKNOWN");
  });
});

describe("lintArmament — dates and numeric ranges", () => {
  it("blocks a retirement before introduction", () => {
    const findings = lintArmament(
      catalogue({ models: [model({ introductionMonth: "1890-01", retirementMonth: "1885-01" })] }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_DATE_ORDER");
  });

  it("blocks an invalid month and an out-of-range value", () => {
    const findings = lintArmament(
      catalogue({
        models: [
          model({
            introductionMonth: "1880-13",
            caliberUm: 0,
            reliabilityBp: 20_000,
            supportedMountTypes: [],
          }),
        ],
      }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_MONTH_INVALID");
    const range = findings.filter((f) => f.code === "ARMAMENT_VALUE_OUT_OF_RANGE");
    expect(range.map((f) => f.field).sort()).toEqual([
      "caliberUm",
      "reliabilityBp",
      "supportedMountTypes",
    ]);
  });

  it("blocks an out-of-range ammunition penetration bias", () => {
    const findings = lintArmament(
      catalogue({ ammunition: [ammunition({ penetrationBiasBp: 20_000 })] }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_VALUE_OUT_OF_RANGE");
  });
});

describe("lintArmament — provenance", () => {
  it("blocks a PLACEHOLDER provenance at release but only advises otherwise", () => {
    const c = catalogue({
      families: [family({ provenance: provenance({ sourceStatus: "PLACEHOLDER" }) })],
    });
    expect(codes(lintArmament(c, options({ release: true })))).toContain(
      "ARMAMENT_PROVENANCE_PLACEHOLDER",
    );
    const advisory = lintArmament(c, options({ release: false }));
    expect(codes(advisory)).toContain("ARMAMENT_PROVENANCE_PLACEHOLDER");
    expect(severities(advisory)).toContain("ADVISORY");
  });

  it("blocks a missing source reference", () => {
    const findings = lintArmament(
      catalogue({ models: [model({ provenance: provenance({ sources: [] }) })] }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_PROVENANCE_MISSING");
  });

  it("blocks a historical claim that is only a BALANCE_TARGET", () => {
    const findings = lintArmament(
      catalogue({
        models: [model({ provenance: provenance({ sourceStatus: "BALANCE_TARGET" }) })],
      }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_PROVENANCE_INCONSISTENT");
  });

  it("blocks a balance adjustment claiming VERIFIED status", () => {
    const findings = lintArmament(
      catalogue({
        models: [model({ provenance: provenance({ kind: "balance_adjustment" }) })],
      }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_PROVENANCE_INCONSISTENT");
  });
});

describe("lintArmament — duplicate contradictory values", () => {
  it("blocks two national models for the same family", () => {
    const findings = lintArmament(
      catalogue({
        models: [model({ id: gunModelId("uk_a") }), model({ id: gunModelId("uk_b") })],
      }),
      options({ nationOfModel: { uk_a: "uk", uk_b: "uk" } }),
    );
    expect(codes(findings)).toContain("ARMAMENT_DUPLICATE_CONTRADICTORY");
  });

  it("blocks two mounts sharing a family set and mount type", () => {
    const findings = lintArmament(
      catalogue({
        mounts: [mount({ id: gunMountId("m1") }), mount({ id: gunMountId("m2") })],
      }),
      options(),
    );
    expect(codes(findings)).toContain("ARMAMENT_DUPLICATE_CONTRADICTORY");
  });
});
