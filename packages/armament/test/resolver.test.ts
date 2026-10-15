import { describe, it, expect } from "vite-plus/test";
import {
  armamentTechnologyId,
  resolveArmament,
  type ArmamentResolutionResult,
} from "../src/index.js";
import { accessContext, ammunition, gunModel, mount, technologyContext } from "./fixtures.js";

const codes = (r: ArmamentResolutionResult): string[] => r.findings.map((f) => f.code);

describe("resolveArmament — valid resolution", () => {
  it("resolves a compatible gun, mount and ammunition with grounded values", () => {
    const r = resolveArmament(
      gunModel(),
      mount(),
      ammunition(),
      technologyContext(),
      accessContext(),
    );
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
    const resolved = r.resolved!;
    expect(resolved.gunModelId).toBe("test_gun");
    expect(resolved.gunFamilyId).toBe("test_family");
    expect(resolved.mountId).toBe("test_mount");
    expect(resolved.ammunitionId).toBe("test_ap");
    expect(resolved.gunCount).toBe(2);
    expect(resolved.caliberUm).toBe(152_000);
    expect(resolved.shellMassG).toBe(45_000);
    // charge 4800 bp of shell mass -> one round weighs 45000 * 1.48 = 66600 g.
    expect(resolved.ammunitionUnitMassG).toBe(66_600);
    expect(resolved.mechanicalRateOfFireRoundsPerMinuteX100).toBe(400);
    // 2 guns x 5000 kg + (1800 base + 7600/gun x 2) = 10000 + 17000 = 27000 kg.
    expect(resolved.mountInstallationMassKg).toBe(17_000);
    expect(resolved.totalInstallationMassKg).toBe(27_000);
    expect(resolved.accessStatus).toBe("DOMESTIC");
    expect(resolved.resolvedRateOfFireModifierBp).toBe(10_000);
    expect(resolved.appliedModifiers).toEqual([]);
  });

  it("retains the provenance of every input entity", () => {
    const r = resolveArmament(
      gunModel(),
      mount(),
      ammunition(),
      technologyContext(),
      accessContext(),
    );
    expect(r.resolved!.provenance.gunModel.sources[0]!.title).toBe("test source");
    expect(r.resolved!.provenance.mount.sources[0]!.title).toBe("test source");
    expect(r.resolved!.provenance.ammunition.sources[0]!.title).toBe("test source");
  });

  it("defaults an unspecified component access to DOMESTIC", () => {
    const r = resolveArmament(
      gunModel(),
      mount(),
      ammunition(),
      technologyContext(),
      accessContext({ componentAccess: {} }),
    );
    expect(r.ok).toBe(true);
    expect(r.resolved!.accessStatus).toBe("DOMESTIC");
  });
});

describe("resolveArmament — expected errors return findings, never throw", () => {
  it("blocks an incompatible gun family and mount", () => {
    const r = resolveArmament(
      gunModel(),
      mount({ compatibleGunFamilies: ["other_family" as never] }),
      ammunition(),
      technologyContext(),
      accessContext(),
    );
    expect(r.ok).toBe(false);
    expect(r.resolved).toBeNull();
    expect(codes(r)).toContain("ARMAMENT_GUN_FAMILY_MISMATCH");
  });

  it("blocks a mount type the gun model does not support", () => {
    const r = resolveArmament(
      gunModel({ supportedMountTypes: ["BARBETTE"] }),
      mount({ mountType: "TURRET" }),
      ammunition(),
      technologyContext(),
      accessContext(),
    );
    expect(codes(r)).toContain("ARMAMENT_MOUNT_NOT_SUPPORTED");
  });

  it("blocks incompatible ammunition", () => {
    const r = resolveArmament(
      gunModel(),
      mount(),
      ammunition({ compatibleGunFamilies: ["other_family" as never] }),
      technologyContext(),
      accessContext(),
    );
    expect(codes(r)).toContain("ARMAMENT_AMMUNITION_INCOMPATIBLE");
  });

  it("blocks an unavailable national component", () => {
    const r = resolveArmament(
      gunModel(),
      mount(),
      ammunition(),
      technologyContext(),
      accessContext({ componentAccess: { test_family: "UNAVAILABLE" } }),
    );
    expect(codes(r)).toContain("ARMAMENT_ACCESS_UNAVAILABLE");
  });

  it("warns (does not block) a foreign component", () => {
    const r = resolveArmament(
      gunModel(),
      mount(),
      ammunition(),
      technologyContext(),
      accessContext({ componentAccess: { test_family: "IMPORTED" } }),
    );
    expect(r.ok).toBe(true);
    expect(r.findings.map((f) => f.severity)).toEqual(["WARNING"]);
    expect(codes(r)).toContain("ARMAMENT_ACCESS_FOREIGN");
    expect(r.resolved!.accessStatus).toBe("IMPORTED");
  });

  it("blocks a missing required technology", () => {
    const r = resolveArmament(
      gunModel(),
      mount(),
      ammunition(),
      technologyContext({ unlockedTechnologyIds: new Set() }),
      accessContext(),
    );
    expect(codes(r)).toContain("ARMAMENT_TECHNOLOGY_MISSING");
    expect(r.findings.find((f) => f.code === "ARMAMENT_TECHNOLOGY_MISSING")!.parameters).toEqual({
      technologyId: "gun_breech_rifled",
    });
  });

  it("blocks before introduction and after retirement", () => {
    const before = resolveArmament(
      gunModel({ introductionMonth: "1890-01" }),
      mount(),
      ammunition(),
      technologyContext({ month: "1885-01" }),
      accessContext(),
    );
    expect(codes(before)).toContain("ARMAMENT_BEFORE_INTRODUCTION");
    const after = resolveArmament(
      gunModel({ retirementMonth: "1884-01" }),
      mount(),
      ammunition(),
      technologyContext({ month: "1885-01" }),
      accessContext(),
    );
    expect(codes(after)).toContain("ARMAMENT_AFTER_RETIREMENT");
  });

  it("blocks an invalid numeric range and an invalid gun count", () => {
    const r = resolveArmament(
      gunModel({ caliberUm: 0, mechanicalRateOfFireRoundsPerMinuteX100: -1 }),
      mount({ gunCount: 0 }),
      ammunition({ penetrationBiasBp: 20_000 }),
      technologyContext(),
      accessContext(),
    );
    const rangeFindings = r.findings.filter((f) => f.code === "ARMAMENT_VALUE_OUT_OF_RANGE");
    expect(rangeFindings.map((f) => f.field).sort()).toEqual([
      "caliberUm",
      "gunCount",
      "mechanicalRateOfFireRoundsPerMinuteX100",
      "penetrationBiasBp",
    ]);
  });

  it("blocks a malformed canonical id and an invalid month", () => {
    const r = resolveArmament(
      gunModel({ id: "Bad ID" as never }),
      mount(),
      ammunition(),
      technologyContext({ month: "1885-13" }),
      accessContext(),
    );
    expect(codes(r)).toContain("ARMAMENT_ID_INVALID");
    expect(codes(r)).toContain("ARMAMENT_MONTH_INVALID");
    // A malformed month must not produce spurious date-band findings.
    expect(codes(r)).not.toContain("ARMAMENT_BEFORE_INTRODUCTION");
  });

  it("advises on PLACEHOLDER provenance without blocking", () => {
    const r = resolveArmament(
      gunModel({ provenance: { ...gunModel().provenance, sourceStatus: "PLACEHOLDER" } }),
      mount(),
      ammunition(),
      technologyContext(),
      accessContext(),
    );
    expect(r.ok).toBe(true);
    expect(codes(r)).toContain("ARMAMENT_PROVENANCE_PLACEHOLDER");
  });
});

describe("resolveArmament — modifier composition and exact rounding", () => {
  it("composes mount and ammunition modifiers as an exact product", () => {
    const r = resolveArmament(
      gunModel(),
      mount({ rateOfFireModifierBp: 11_000, ammunitionHandlingModifierBp: 9_000 }),
      ammunition({ rateOfFireModifierBp: 8_000 }),
      technologyContext(),
      accessContext(),
    );
    // 11000 * 9000 * 8000 / 10000^2 = 7920 exactly.
    expect(r.resolved!.resolvedRateOfFireModifierBp).toBe(7_920);
    expect(r.resolved!.appliedModifiers).toEqual([
      { source: "mount.rateOfFireModifierBp", valueBp: 11_000 },
      { source: "mount.ammunitionHandlingModifierBp", valueBp: 9_000 },
      { source: "ammunition.rateOfFireModifierBp", valueBp: 8_000 },
    ]);
  });

  it("rounds the composed product once, half up", () => {
    const r = resolveArmament(
      gunModel(),
      mount({ rateOfFireModifierBp: 3_333 }),
      ammunition({ rateOfFireModifierBp: 3_333 }),
      technologyContext(),
      accessContext(),
    );
    // 3333 * 3333 / 10000 = 1110.8889 -> 1111.
    expect(r.resolved!.resolvedRateOfFireModifierBp).toBe(1_111);
  });
});

describe("resolveArmament — determinism and purity", () => {
  it("orders findings deterministically by severity then code", () => {
    const r = resolveArmament(
      gunModel({ id: "Bad ID" as never, introductionMonth: "1890-01" }),
      mount(),
      ammunition(),
      technologyContext({ unlockedTechnologyIds: new Set(), month: "1885-01" }),
      accessContext(),
    );
    const codeOrder = r.findings.map((f) => f.code);
    expect(r.findings.every((f) => f.severity === "BLOCKING")).toBe(true);
    expect(codeOrder).toEqual([...codeOrder].sort());
  });

  it("produces byte-equivalent output across repeated resolutions", () => {
    const args = [
      gunModel(),
      mount({ rateOfFireModifierBp: 12_000 }),
      ammunition(),
      technologyContext(),
      accessContext(),
    ] as const;
    const a = JSON.stringify(resolveArmament(...args));
    const b = JSON.stringify(resolveArmament(...args));
    expect(b).toBe(a);
  });

  it("does not mutate its inputs", () => {
    const gm = Object.freeze(gunModel());
    const m = Object.freeze(mount());
    const ammo = Object.freeze(ammunition());
    const tech = Object.freeze(technologyContext());
    const access = Object.freeze(accessContext());
    expect(() => resolveArmament(gm, m, ammo, tech, access)).not.toThrow();
    expect(gm).toEqual(gunModel());
    expect(m).toEqual(mount());
    expect(ammo).toEqual(ammunition());
  });

  it("resolves identically regardless of nation id (no nation-id branch in shared logic)", () => {
    const forUk = resolveArmament(
      gunModel(),
      mount(),
      ammunition(),
      technologyContext(),
      accessContext(),
    );
    const forFrance = resolveArmament(
      gunModel(),
      mount(),
      ammunition(),
      technologyContext(),
      accessContext({ nationId: "france" as never }),
    );
    expect(JSON.stringify(forFrance.resolved)).toBe(JSON.stringify(forUk.resolved));
  });
});

describe("resolveArmament — required-technology attribution", () => {
  it("attributes a mount-only technology requirement to the mount", () => {
    const r = resolveArmament(
      gunModel(),
      mount({ requiredTechnologyIds: [armamentTechnologyId("mount_tech")] }),
      ammunition(),
      technologyContext(),
      accessContext(),
    );
    const f = r.findings.find((x) => x.code === "ARMAMENT_TECHNOLOGY_MISSING")!;
    expect(f.entity.kind).toBe("gunMount");
    expect(f.parameters.technologyId).toBe("mount_tech");
  });
});
