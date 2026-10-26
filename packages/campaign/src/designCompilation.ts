import { SafeInt } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import {
  type CampaignDesign,
  type DesignTemplate,
  DesignTemplateSchema,
  validateAgainstSchema,
} from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex, compareCodePoints } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { knotsToUms, mmToUm } from "./designUnits.js";
import type {
  CompiledDesignVersion,
  CompiledTorpedoMount,
  DesignFamily,
  NationState,
} from "./state.js";

export function assertFleetDesignLinks(
  nations: Map<string, NationState>,
  designs: Map<string, CompiledDesignVersion>,
  collector: DiagnosticCollector,
): boolean {
  if (designs.size === 0) return true;
  for (const [, nation] of nations) {
    for (const fleet of nation.fleets) {
      for (const ship of fleet.ships) {
        if (ship.designVersionId && !designs.has(ship.designVersionId)) {
          collector.addError(
            "CAMPAIGN-DESIGN",
            `Ship ${ship.id} references unknown designVersionId ${ship.designVersionId}`,
            { stage: "campaign-compile" },
          );
        }
      }
    }
  }
  return !collector.hasErrors;
}

export type TorpedoResolver = (torpedoModelId: string) => CompiledTorpedo | undefined;

function mapTorpedoArmament(
  validated: DesignTemplate,
  torpedoOf?: TorpedoResolver,
): CompiledTorpedoMount[] | undefined {
  return validated.torpedoArmament?.map((m) => {
    const compiledTorpedo = torpedoOf?.(m.torpedoModelId);
    return {
      mountType: m.mountType,
      tubeCount: SafeInt(m.tubeCount),
      torpedoModelId: m.torpedoModelId,
      ...(compiledTorpedo !== undefined ? { compiledTorpedo } : {}),
    };
  });
}

function hashableTorpedoArmament(
  armament: CompiledTorpedoMount[] | undefined,
): readonly { mountType: string; tubeCount: SafeInt; torpedoModelId: string }[] | undefined {
  return armament?.map(({ mountType, tubeCount, torpedoModelId }) => ({
    mountType,
    tubeCount,
    torpedoModelId,
  }));
}

function buildRawDesignRecord(rec: CampaignDesign): Record<string, unknown> {
  return {
    designId: rec.designId,
    designFamilyId: rec.designFamilyId,
    nationId: rec.nationId,
    className: rec.className,
    hullType: rec.hullType,
    displacementKg: rec.displacementKg,
    speedUms: rec.speedUms,
    armorBeltUm: rec.armorBeltUm,
    mainGuns: rec.mainGuns,
    machineryType: rec.machineryType,
    hitPoints: rec.hitPoints,
    crewComplement: rec.crewComplement,
    contentVersion: rec.contentVersion,
    ...(rec.torpedoArmament !== undefined ? { torpedoArmament: rec.torpedoArmament } : {}),
  };
}

function computeCompiledDesignHash(
  designVersionId: string,
  validated: DesignTemplate,
  torpedoArmament: CompiledTorpedoMount[] | undefined,
): string {
  return sha256Hex(
    canonicalSerialize({
      designVersionId,
      className: validated.className,
      nationId: validated.nationId,
      hullType: validated.hullType,
      displacementKg: validated.displacementKg,
      speedUms: validated.speedUms,
      armorBeltUm: validated.armorBeltUm,
      mainGuns: validated.mainGuns,
      machineryType: validated.machineryType,
      hitPoints: validated.hitPoints,
      crewComplement: validated.crewComplement,
      ...(hashableTorpedoArmament(torpedoArmament)
        ? { torpedoArmament: hashableTorpedoArmament(torpedoArmament) }
        : {}),
    }),
  );
}

function buildCompiledDesign(
  designVersionId: string,
  rec: CampaignDesign,
  validated: DesignTemplate,
  torpedoOf?: TorpedoResolver,
): CompiledDesignVersion {
  const torpedoArmament = mapTorpedoArmament(validated, torpedoOf);
  return {
    designVersionId,
    designFamilyId: validated.designFamilyId ?? "",
    className: validated.className,
    nationId: validated.nationId,
    hullType: validated.hullType,
    normalizedDisplacementKg: SafeInt(rec.normalizedDisplacementKg ?? validated.displacementKg),
    normalizedSpeedUms: SafeInt(rec.normalizedSpeedUms ?? knotsToUms(validated.speedUms)),
    normalizedArmorUm: SafeInt(rec.normalizedArmorUm ?? mmToUm(validated.armorBeltUm)),
    hitPoints: SafeInt(validated.hitPoints),
    mainGunsCaliber: SafeInt(mmToUm(validated.mainGuns.caliber)),
    mainGunsCount: SafeInt(validated.mainGuns.count),
    machineryType: validated.machineryType,
    crewComplement: SafeInt(validated.crewComplement),
    contentVersion: validated.contentVersion ?? "0.1.0",
    compiledHash: computeCompiledDesignHash(designVersionId, validated, torpedoArmament),
    ...(torpedoArmament ? { torpedoArmament } : {}),
  };
}

export function buildDesignsFromData(
  designsData: readonly CampaignDesign[],
  collector: DiagnosticCollector,
  torpedoOf?: TorpedoResolver,
): Map<string, CompiledDesignVersion> {
  const designs = new Map<string, CompiledDesignVersion>();

  for (const rec of designsData) {
    const designVersionId = rec.designVersionId;

    const validated = validateAgainstSchema(
      buildRawDesignRecord(rec),
      DesignTemplateSchema,
      "DesignTemplate",
      "designs.yaml",
      collector,
    );
    if (!validated) continue;

    designs.set(designVersionId, buildCompiledDesign(designVersionId, rec, validated, torpedoOf));
  }

  return designs;
}

export function buildDesignFamiliesFromData(
  designsData: readonly CampaignDesign[],
): Map<string, DesignFamily> {
  const families = new Map<string, DesignFamily>();

  const familyMap = new Map<string, { rec: CampaignDesign; members: string[] }>();
  for (const rec of designsData) {
    const familyId = rec.designFamilyId;
    if (familyId === undefined) continue;

    if (!familyMap.has(familyId)) {
      familyMap.set(familyId, { rec, members: [] });
    }
    familyMap.get(familyId)!.members.push(rec.designVersionId);
  }

  for (const [familyId, data] of familyMap) {
    data.members.sort((a, b) => compareCodePoints(a, b));
    families.set(familyId, {
      designFamilyId: familyId,
      nationId: data.rec.nationId,
      rootDesignVersionId: data.members[0] ?? "",
      memberDesignVersionIds: data.members,
      familyCreationMonth: data.rec.familyCreationMonth ?? "1880-01",
    });
  }

  return families;
}
