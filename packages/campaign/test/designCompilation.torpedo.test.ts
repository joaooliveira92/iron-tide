import type { CompiledTorpedo } from "@bluewave/armament";
import type { CampaignDesign } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { CompileTorpedoFailure } from "@bluewave/ship-design";
import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { buildDesignsFromData, type TorpedoResolver } from "../src/designCompilation.js";

const DESIGN: CampaignDesign = {
  designId: "uk-inflexible-v1",
  designVersionId: "uk-inflexible-v1",
  designFamilyId: "inflexible",
  nationId: "uk",
  className: "Inflexible",
  hullType: "ironclad_turret_ship",
  displacementKg: 11_880_000,
  speedUms: 14,
  armorBeltUm: 610,
  mainGuns: { caliber: 406, count: 4, mounts: 2 },
  machineryType: "reciprocating_compound",
  hitPoints: 60,
  crewComplement: 460,
  torpedoArmament: [
    { mountType: "UNDERWATER_FIXED", tubeCount: 2, torpedoModelId: "whitehead_14in_1886" },
  ],
};

const COMPILED: CompiledTorpedo = {
  partId: "whitehead_14in_1886",
  revision: "base",
  diameterUm: 355_600,
  massKg: 280,
  warheadType: "WET_GUNCOTTON",
  warheadExplosiveMassKg: 20,
  warheadExplosiveEquivalentMassKg: 15,
  propulsionType: "COMPRESSED_AIR",
  speedSettings: [{ settingId: "full", speedMilliKnots: 18_000, rangeM: 800 }],
  minimumArmingDistanceM: 90,
  reliabilityBp: 5_000,
  guidanceCapability: "unguided",
  launchTypes: ["UNDERWATER_FIXED"],
  technologyPrerequisiteIds: [],
  tubeHitHazardPolicy: "ORDINARY",
};

function resolveWith(result: ReturnType<TorpedoResolver>): TorpedoResolver {
  return () => result;
}

describe("torpedo armament compilation", () => {
  it("attaches a torpedo when the model compiles", () => {
    const collector = new DiagnosticCollector();
    const designs = buildDesignsFromData(
      [DESIGN],
      collector,
      resolveWith(Result.succeed(COMPILED)),
    );

    expect(collector.hasErrors).toBe(false);
    expect(designs.get(DESIGN.designVersionId)?.torpedoArmament).toEqual([
      {
        mountType: "UNDERWATER_FIXED",
        tubeCount: 2,
        torpedoModelId: "whitehead_14in_1886",
        compiledTorpedo: COMPILED,
      },
    ]);
  });

  it("reports every torpedo compile failure instead of dropping the model", () => {
    const failures: readonly CompileTorpedoFailure[] = [
      {
        code: "COMPILED_TORPEDO_MISSING_FIELD",
        path: "diameterUm",
        message: "the torpedo spec has no 'diameterUm'.",
      },
      {
        code: "COMPILED_TORPEDO_INVALID_FIELD",
        path: "massKg",
        message: "'massKg' must be an integer.",
      },
    ];
    const collector = new DiagnosticCollector();
    const designs = buildDesignsFromData([DESIGN], collector, resolveWith(Result.fail(failures)));

    expect(collector.hasErrors).toBe(true);
    expect(
      collector.all.map(({ code, message, entityId }) => ({ code, message, entityId })),
    ).toEqual([
      {
        code: "CAMPAIGN-DESIGN",
        message: "Torpedo whitehead_14in_1886 diameterUm: the torpedo spec has no 'diameterUm'.",
        entityId: "uk-inflexible-v1",
      },
      {
        code: "CAMPAIGN-DESIGN",
        message: "Torpedo whitehead_14in_1886 massKg: 'massKg' must be an integer.",
        entityId: "uk-inflexible-v1",
      },
    ]);
    expect(designs.get(DESIGN.designVersionId)?.torpedoArmament?.[0]).toEqual({
      mountType: "UNDERWATER_FIXED",
      tubeCount: 2,
      torpedoModelId: "whitehead_14in_1886",
    });
  });

  it("leaves an unknown torpedo model uncompiled", () => {
    const collector = new DiagnosticCollector();
    const designs = buildDesignsFromData([DESIGN], collector, resolveWith(undefined));

    expect(collector.hasErrors).toBe(false);
    expect(designs.get(DESIGN.designVersionId)?.torpedoArmament?.[0]).toEqual({
      mountType: "UNDERWATER_FIXED",
      tubeCount: 2,
      torpedoModelId: "whitehead_14in_1886",
    });
  });
});
