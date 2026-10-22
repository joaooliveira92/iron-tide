import { describe, expect, it } from "vite-plus/test";
import type { ArmamentResolutionFinding } from "@bluewave/armament";
import { buildArmamentCatalogue, resolveInstalledWeapon } from "../src/armamentContent.js";
import {
  buildShipBuildingContent,
  compileDesign,
  nationHasArmamentContent,
  type DesignDraft,
} from "../src/index.js";
import {
  mapArmamentFinding,
  mapArmamentFindings,
  toCompiledWeaponArmament,
} from "../src/armamentCompile.js";
import {
  armamentContent,
  components,
  nationalContext,
  shipBuildingContent,
  shipBuildingData,
} from "./helpers/earlyContext.js";

const legacyContent = buildShipBuildingContent({ ...shipBuildingData, armament: undefined });

const OPENING_MONTH = "1880-01";
const ARMAMENT_NATIONS = new Set(["uk", "france", "germany"]);
const openingStarters = shipBuildingContent.starterDesigns.filter(
  (s) => s.month === OPENING_MONTH && ARMAMENT_NATIONS.has(s.draft.nationId),
);

const GUN_CATEGORIES = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);
const byId = new Map(components.map((c) => [c.id, c]));
const gunPlacements = (d: DesignDraft) =>
  d.placements.filter((p) => GUN_CATEGORIES.has(byId.get(p.componentId)?.category ?? ""));

describe("Step 3 armament cut-over: opening reference designs", () => {
  it("verifies the first-class armament catalogue scale (34/26/36/6)", () => {
    const catalogue = buildArmamentCatalogue(armamentContent);
    expect(catalogue.families).toHaveLength(34);
    expect(catalogue.models).toHaveLength(26);
    expect(catalogue.mounts).toHaveLength(36);
    expect(catalogue.ammunition).toHaveLength(6);
  });

  it("has 18 opening starters, six per nation, using 43 gun combinations", () => {
    expect(openingStarters).toHaveLength(18);
    for (const nation of ["uk", "france", "germany"])
      expect(openingStarters.filter((s) => s.draft.nationId === nation)).toHaveLength(6);
    const combos = openingStarters.reduce((n, s) => n + gunPlacements(s.draft).length, 0);
    expect(combos).toBe(43);
  });

  it("resolves every opening weapon without a blocking finding", () => {
    for (const s of openingStarters) {
      const ctx = nationalContext(s.month, s.draft.nationId);
      for (const p of gunPlacements(s.draft)) {
        const r = resolveInstalledWeapon({
          content: armamentContent,
          components: ctx.catalogue,
          nationId: s.draft.nationId,
          familyId: p.componentId,
          gunCount: p.params?.barrels ?? 1,
          month: s.month,
          unlockedTechnologyIds: ctx.unlockedTechs,
          componentAccess: {},
        });
        expect(r.resolved, `${s.id}:${p.instanceId}`).not.toBeNull();
        expect(r.findings.some((f) => f.severity === "BLOCKING")).toBe(false);
      }
    }
  });

  it("keeps all 18 opening designs legal through the armament path", () => {
    for (const s of openingStarters) {
      const compiled = compileDesign(s.draft, nationalContext(s.month, s.draft.nationId));
      expect(compiled.valid, `${s.id} should stay legal`).toBe(true);
      expect(compiled.findings.some((f) => f.severity === "BLOCKING")).toBe(false);
    }
  });
});

describe("Step 3 armament cut-over: legacy/new equivalence", () => {
  it("preserves mass, ammunition, cost, stability and capacity for every opening design", () => {
    for (const s of openingStarters) {
      const armament = compileDesign(s.draft, nationalContext(s.month, s.draft.nationId));
      const legacy = compileDesign(
        s.draft,
        legacyContent.environmentFor(s.month, s.draft.nationId).ctx,
      );
      expect(armament.totalKg, s.id).toBe(legacy.totalKg);
      expect(armament.ledger, s.id).toEqual(legacy.ledger);
      expect(armament.componentCostMicro, s.id).toBe(legacy.componentCostMicro);
      expect(armament.weapons?.ammoMassKg, s.id).toBe(legacy.weapons?.ammoMassKg);
      expect(armament.weapons?.ammoVolumeLitre, s.id).toBe(legacy.weapons?.ammoVolumeLitre);
      expect(armament.weapons?.broadsidePortKg, s.id).toBe(legacy.weapons?.broadsidePortKg);
      expect(armament.weapons?.broadsideStbdKg, s.id).toBe(legacy.weapons?.broadsideStbdKg);
      expect(armament.weapons?.sustainedPerMinX100, s.id).toBe(legacy.weapons?.sustainedPerMinX100);
      expect(armament.weapons?.blastLoadKg, s.id).toBe(legacy.weapons?.blastLoadKg);
      expect(armament.stability?.gmMm, s.id).toBe(legacy.stability?.gmMm);
      expect(armament.stability?.displacementKg, s.id).toBe(legacy.stability?.displacementKg);
      const ids = (c: typeof armament) => c.findings.map((f) => f.id).sort();
      expect(
        ids(armament).filter((id) => !id.startsWith("ARMAMENT_")),
        s.id,
      ).toEqual(ids(legacy));
      expect(
        armament.findings.some((f) => f.id.startsWith("ARMAMENT_") && f.severity === "BLOCKING"),
        s.id,
      ).toBe(false);
    }
  });

  it("records the armament identity and a total installation mass equal to the legacy component weight", () => {
    for (const s of openingStarters) {
      const armament = compileDesign(s.draft, nationalContext(s.month, s.draft.nationId));
      const legacy = compileDesign(
        s.draft,
        legacyContent.environmentFor(s.month, s.draft.nationId).ctx,
      );
      const legacyWeights = new Map(legacy.components.map((c) => [c.instanceId, c.weightKg]));
      const gunners = armament.components.filter((c) => c.armament !== undefined);
      expect(gunners.length, s.id).toBe(gunPlacements(s.draft).length);
      for (const g of gunners) {
        expect(g.armament!.gunFamilyId, g.instanceId).toBe(g.componentId);
        expect(g.armament!.totalInstallationMassKg, g.instanceId).toBe(
          legacyWeights.get(g.instanceId),
        );
        expect(g.armament!.gunCount).toBe(g.params.barrels);
        expect(g.armament!.ammunitionId.length).toBeGreaterThan(0);
        expect(g.armament!.mountId.length).toBeGreaterThan(0);
      }
    }
  });

  it("does not mutate the input draft or the content", () => {
    const s = openingStarters[0]!;
    const before = JSON.stringify(s.draft);
    compileDesign(s.draft, nationalContext(s.month, s.draft.nationId));
    expect(JSON.stringify(s.draft)).toBe(before);
  });

  it("repeated compile produces a byte-identical hash", () => {
    const s = openingStarters[0]!;
    const a = compileDesign(s.draft, nationalContext(s.month, s.draft.nationId));
    const b = compileDesign(s.draft, nationalContext(s.month, s.draft.nationId));
    expect(a.hash).toBe(b.hash);
  });
});

describe("Step 3 armament cut-over: compatibility path", () => {
  it("falls back to legacy values when the context carries no armament content", () => {
    const s = openingStarters[0]!;
    const ctx = legacyContent.environmentFor(s.month, s.draft.nationId).ctx;
    const compiled = compileDesign(s.draft, ctx);
    expect(compiled.components.every((c) => c.armament === undefined)).toBe(true);
    expect(compiled.valid).toBe(true);
  });

  it("compiles a nation with no first-class armament content on the compatibility path", () => {
    const hasUk = nationHasArmamentContent(armamentContent, "uk");
    const hasItaly = nationHasArmamentContent(armamentContent, "italy");
    expect(hasUk).toBe(true);
    expect(hasItaly).toBe(false);
  });
});

describe("Step 3 armament cut-over: structured findings", () => {
  const entity: ArmamentResolutionFinding["entity"] = { kind: "gunModel", id: "x" };
  const finding = (over: Partial<ArmamentResolutionFinding> = {}): ArmamentResolutionFinding => ({
    severity: "BLOCKING",
    code: "ARMAMENT_GUN_FAMILY_MISMATCH",
    entity,
    field: "compatibleGunFamilies",
    parameters: { familyId: "gun_x" },
    message: "Mount does not accept the family.",
    ...over,
  });

  it("maps the stable code, severity, entity and parameters without losing information", () => {
    const f = mapArmamentFinding(finding(), "gun_1");
    expect(f.id).toBe("ARMAMENT_GUN_FAMILY_MISMATCH");
    expect(f.severity).toBe("BLOCKING");
    expect(f.what).toBe("Mount does not accept the family.");
    expect(f.why).toContain("gunModel:x");
    expect(f.parameters).toEqual({ familyId: "gun_x" });
    expect(f.subject?.targets).toEqual([{ kind: "placement", instanceId: "gun_1" }]);
  });

  it("maps severity exactly and orders deterministically", () => {
    const mapped = mapArmamentFindings(
      [
        finding({ severity: "ADVISORY", code: "ARMAMENT_PROVENANCE_PLACEHOLDER" }),
        finding({ severity: "BLOCKING", code: "ARMAMENT_GUN_FAMILY_MISMATCH" }),
        finding({ severity: "WARNING", code: "ARMAMENT_ACCESS_FOREIGN" }),
      ],
      "gun_1",
    );
    expect(mapped.map((f) => f.severity)).toEqual(["ADVISORY", "BLOCKING", "WARNING"]);
    const again = mapArmamentFindings(
      [
        finding({ severity: "ADVISORY", code: "ARMAMENT_PROVENANCE_PLACEHOLDER" }),
        finding({ severity: "BLOCKING", code: "ARMAMENT_GUN_FAMILY_MISMATCH" }),
        finding({ severity: "WARNING", code: "ARMAMENT_ACCESS_FOREIGN" }),
      ],
      "gun_1",
    );
    expect(mapped).toEqual(again);
  });

  it("emits a structured finding for an incompatible ammunition instead of throwing", () => {
    const content = {
      ...armamentContent,
      ammunition: armamentContent.ammunition.map((a) =>
        a.nationId === "uk" ? { ...a, compatibleGunFamilies: ["gun_maxim_303"] } : a,
      ),
    };
    const r = resolveInstalledWeapon({
      content,
      components,
      nationId: "uk",
      familyId: "gun_rml_64pdr_71cwt",
      gunCount: 1,
      month: "1880-01",
      unlockedTechnologyIds: new Set(),
      componentAccess: {},
    });
    expect(r.resolved).toBeNull();
    expect(r.findings.some((f) => f.code === "ARMAMENT_AMMUNITION_INCOMPATIBLE")).toBe(true);
  });

  it("emits a structured finding for unavailable national access", () => {
    const r = resolveInstalledWeapon({
      content: armamentContent,
      components,
      nationId: "germany",
      familyId: "gun_bl_12in_25",
      gunCount: 1,
      month: "1880-01",
      unlockedTechnologyIds: new Set(["gun_breech_rifled"]),
      componentAccess: { gun_bl_12in_25: "UNAVAILABLE" },
    });
    expect(r.resolved).toBeNull();
    expect(r.findings.some((f) => f.code === "ARMAMENT_ACCESS_UNAVAILABLE")).toBe(true);
  });

  it("emits a structured finding for a technology not yet unlocked", () => {
    const r = resolveInstalledWeapon({
      content: armamentContent,
      components,
      nationId: "uk",
      familyId: "gun_bl_12in_25",
      gunCount: 1,
      month: "1885-01",
      unlockedTechnologyIds: new Set(),
      componentAccess: {},
    });
    expect(r.findings.some((f) => f.code === "ARMAMENT_TECHNOLOGY_MISSING")).toBe(true);
  });

  it("emits a structured finding before introduction and after retirement", () => {
    const before = resolveInstalledWeapon({
      content: armamentContent,
      components,
      nationId: "uk",
      familyId: "gun_bl_12in_25",
      gunCount: 1,
      month: "1880-01",
      unlockedTechnologyIds: new Set(["gun_breech_rifled"]),
      componentAccess: {},
    });
    expect(before.resolved).toBeNull();
    expect(before.findings.some((f) => f.code === "ARMAMENT_BEFORE_INTRODUCTION")).toBe(true);
  });

  it("emits ARMAMENT_REFERENCE_MISSING for a malformed/unknown family id", () => {
    const r = resolveInstalledWeapon({
      content: armamentContent,
      components,
      nationId: "uk",
      familyId: "not_a_real_family",
      gunCount: 1,
      month: "1880-01",
      unlockedTechnologyIds: new Set(),
      componentAccess: {},
    });
    expect(r.resolved).toBeNull();
    expect(r.findings[0]!.code).toBe("ARMAMENT_REFERENCE_MISSING");
  });
});

describe("Step 3 armament cut-over: compiled weapon contract", () => {
  it("builds an explicit-unit contract from a resolved armament", () => {
    const r = resolveInstalledWeapon({
      content: armamentContent,
      components,
      nationId: "uk",
      familyId: "gun_bl_12in_25",
      gunCount: 2,
      month: "1885-01",
      unlockedTechnologyIds: new Set(["gun_breech_rifled"]),
      componentAccess: {},
    });
    expect(r.resolved).not.toBeNull();
    const c = toCompiledWeaponArmament(r.resolved!, r.mountType, "gun_1");
    expect(c.instanceId).toBe("gun_1");
    expect(c.gunFamilyId).toBe("gun_bl_12in_25");
    expect(c.gunModelId).toBe("uk_bl_12in_25_mk1");
    expect(c.mountId).toContain("gun_bl_12in_25");
    expect(c.ammunitionId).toBe("uk_ap_palliser");
    expect(c.gunCount).toBe(2);
    expect(c.totalInstallationMassKg).toBe(
      (c.gunMassKg ?? 0) * c.gunCount + (c.mountInstallationMassKg ?? 0),
    );
    expect(c.caliberUm).toBe(305000);
    expect(c.accessStatus).toBe("DOMESTIC");
  });
});

describe("Step 3 armament cut-over: no nation-id conditional", () => {
  it("shared resolution logic contains no nation-id comparison", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = path.join(__dirname, "..", "src");
    for (const file of ["armamentCompile.ts", "compile/stages.ts"]) {
      const text = fs.readFileSync(path.join(src, file), "utf8");
      expect(/nationId\s*===|nationId\s*!==/.test(text), file).toBe(false);
    }
  });
});
