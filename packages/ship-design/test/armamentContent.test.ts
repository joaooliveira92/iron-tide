import { describe, it, expect } from "vite-plus/test";
import type { ArmamentResolutionFinding } from "@bluewave/armament";
import {
  armamentAmmunitionFor,
  armamentContentLintOk,
  armamentFindingKey,
  armamentModelFor,
  armamentMountFor,
  buildArmamentCatalogue,
  buildArmamentUsageManifest,
  lintArmamentContent,
  type AuthoredArmamentContent,
} from "../src/index.js";
import {
  armamentContent,
  armamentCoverageInput,
  armamentProfiles,
  armamentStarters,
  OPENING_MONTH,
} from "./helpers/armamentContext.js";

const blocking = (findings: readonly ArmamentResolutionFinding[]) =>
  findings.filter((f) => f.severity === "BLOCKING");

const withFirstModel = (
  patch: Partial<AuthoredArmamentContent["gunModels"][number]>,
): AuthoredArmamentContent => ({
  ...armamentContent,
  gunModels: [
    { ...armamentContent.gunModels[0]!, ...patch },
    ...armamentContent.gunModels.slice(1),
  ],
});

describe("armament content — the release gate", () => {
  it("passes with no blocking findings at release", () => {
    const findings = lintArmamentContent(armamentCoverageInput);
    expect(blocking(findings).map((f) => armamentFindingKey(f))).toEqual([]);
    expect(armamentContentLintOk(findings)).toBe(true);
  });

  it("keeps non-blocking findings visible without promoting them", () => {
    const findings = lintArmamentContent(armamentCoverageInput);
    // German Nordenfelt is IMPORTED: a WARNING, not a blocker.
    expect(findings.some((f) => f.severity === "WARNING")).toBe(true);
    expect(blocking(findings)).toEqual([]);
  });

  it("surfaces a PLACEHOLDER as an ADVISORY (not a blocker) outside release", () => {
    const placeholder = withFirstModel({
      provenance: { ...armamentContent.gunModels[0]!.provenance, sourceStatus: "PLACEHOLDER" },
    });
    const findings = lintArmamentContent({
      ...armamentCoverageInput,
      content: placeholder,
      release: false,
    });
    expect(findings.some((f) => f.severity === "ADVISORY")).toBe(true);
    expect(blocking(findings)).toEqual([]);
  });

  it("contains no PLACEHOLDER provenance in release content", () => {
    const findings = lintArmamentContent(armamentCoverageInput);
    expect(findings.some((f) => f.code === "ARMAMENT_PROVENANCE_PLACEHOLDER")).toBe(false);
  });

  it("is deterministic and does not mutate the loaded content", () => {
    const before = JSON.stringify(armamentContent);
    const a = lintArmamentContent(armamentCoverageInput);
    const b = lintArmamentContent(armamentCoverageInput);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(armamentContent)).toBe(before);
  });
});

describe("armament content — the 18 opening reference designs", () => {
  it("covers six starters for each of UK, France and Germany", () => {
    expect(armamentStarters).toHaveLength(18);
    for (const nation of ["uk", "france", "germany"]) {
      expect(armamentStarters.filter((s) => s.nationId === nation)).toHaveLength(6);
    }
  });

  it("resolves every mounted weapon without a blocking finding", () => {
    const usages = buildArmamentUsageManifest(armamentCoverageInput);
    expect(usages.length).toBeGreaterThan(0);
    const unresolved = usages
      .filter((u) => !u.result.ok)
      .map(
        (u) => `${u.starterId}/${u.instanceId}: ${u.result.findings.map((f) => f.code).join(",")}`,
      );
    expect(unresolved).toEqual([]);
  });

  it("proves each mounted weapon references an existing family, model, mount and ammunition", () => {
    const usages = buildArmamentUsageManifest(armamentCoverageInput);
    const familyIds = new Set(armamentContent.gunFamilies.map((f) => f.id));
    const mountIds = new Set(armamentContent.gunMounts.map((m) => m.id));
    const ammunitionIds = new Set(armamentContent.ammunition.map((a) => a.id));
    for (const u of usages) {
      expect(familyIds.has(u.familyId), `${u.familyId} family`).toBe(true);
      expect(u.modelId.length, `${u.modelId} model`).toBeGreaterThan(0);
      expect(mountIds.has(u.mountId), `${u.mountId} mount`).toBe(true);
      expect(ammunitionIds.has(u.ammunitionId), `${u.ammunitionId} ammunition`).toBe(true);
    }
  });

  it("uses a representative UK, French and German combination", () => {
    const usages = buildArmamentUsageManifest(armamentCoverageInput);
    for (const nation of ["uk", "france", "germany"]) {
      const usage = usages.find((u) => u.nationId === nation);
      expect(usage, nation).toBeDefined();
      expect(usage!.result.ok, nation).toBe(true);
      expect(usage!.result.resolved!.caliberUm, nation).toBeGreaterThan(0);
    }
  });
});

describe("armament content — compatibility drift", () => {
  it("blocks a mount mass that drifts from the legacy component constant", () => {
    const drifted: AuthoredArmamentContent = {
      ...armamentContent,
      gunMounts: armamentContent.gunMounts.map((m, i) =>
        i === 0 ? { ...m, baseInstallationMassKg: (m.baseInstallationMassKg ?? 0) + 1 } : m,
      ),
    };
    const findings = lintArmamentContent({ ...armamentCoverageInput, content: drifted });
    expect(findings.map((f) => f.code)).toContain("ARMAMENT_COMPAT_DRIFT");
    expect(armamentContentLintOk(findings)).toBe(false);
  });

  it("blocks a model shell mass that drifts from the national overlay", () => {
    const drifted = withFirstModel({ shellMassG: 123 });
    const findings = lintArmamentContent({ ...armamentCoverageInput, content: drifted });
    expect(findings.map((f) => f.code)).toContain("ARMAMENT_COMPAT_DRIFT");
  });
});

describe("armament content — provenance and references", () => {
  it("blocks a PLACEHOLDER provenance at release", () => {
    const placeholder = withFirstModel({
      provenance: { ...armamentContent.gunModels[0]!.provenance, sourceStatus: "PLACEHOLDER" },
    });
    const findings = lintArmamentContent({ ...armamentCoverageInput, content: placeholder });
    expect(findings.map((f) => f.code)).toContain("ARMAMENT_PROVENANCE_PLACEHOLDER");
    expect(armamentContentLintOk(findings)).toBe(false);
  });

  it("blocks a model referencing an unknown family", () => {
    const broken = withFirstModel({ familyId: "gun_missing_family" });
    const findings = lintArmamentContent({ ...armamentCoverageInput, content: broken });
    expect(findings.map((f) => f.code)).toContain("ARMAMENT_REFERENCE_MISSING");
  });

  it("blocks a retirement before introduction", () => {
    const broken = withFirstModel({ introductionMonth: "1890-01", retirementMonth: "1880-01" });
    const findings = lintArmamentContent({ ...armamentCoverageInput, content: broken });
    expect(findings.map((f) => f.code)).toContain("ARMAMENT_DATE_ORDER");
  });

  it("blocks a national model for a family the nation marks UNAVAILABLE", () => {
    const contradiction = withFirstModel({
      familyId: "gun_bl_274mm_m1875",
      nationId: "uk",
    });
    const findings = lintArmamentContent({ ...armamentCoverageInput, content: contradiction });
    expect(findings.map((f) => f.code)).toContain("ARMAMENT_ACCESS_CONTRADICTION");
    expect(armamentContentLintOk(findings)).toBe(false);
  });
});

describe("armament content — catalogue construction", () => {
  it("builds the domain catalogue with branded ids and no mutation", () => {
    const catalogue = buildArmamentCatalogue(armamentContent);
    expect(catalogue.families.length).toBe(armamentContent.gunFamilies.length);
    expect(catalogue.models.length).toBe(armamentContent.gunModels.length);
    expect(catalogue.mounts.length).toBe(armamentContent.gunMounts.length);
    expect(catalogue.ammunition.length).toBe(armamentContent.ammunition.length);
    expect(String(catalogue.families[0]!.id)).toBe(armamentContent.gunFamilies[0]!.id);
  });

  it("resolves a national model, its mount and its ammunition for a representative family", () => {
    const model = armamentModelFor(
      armamentContent,
      armamentCoverageInput.components,
      "france",
      "gun_bl_274mm_m1875",
    );
    expect(model).not.toBeNull();
    const mount = armamentMountFor(
      armamentContent,
      armamentCoverageInput.components,
      "gun_bl_274mm_m1875",
      model!.supportedMountTypes![0]!,
      2,
    );
    expect(mount).not.toBeNull();
    const ammunition = armamentAmmunitionFor(armamentContent, "france", "gun_bl_274mm_m1875");
    expect(ammunition).not.toBeNull();
    expect(String(ammunition!.id)).toBe("fr_melinite_he");
  });

  it("exposes a stable finding key", () => {
    const findings = lintArmamentContent(armamentCoverageInput);
    for (const f of findings) expect(armamentFindingKey(f)).toContain(f.code);
  });

  it("has one naval profile per opening nation", () => {
    for (const nation of ["uk", "france", "germany"])
      expect(armamentProfiles.some((p) => p.nationId === nation)).toBe(true);
    expect(OPENING_MONTH).toBe("1880-01");
  });
});
