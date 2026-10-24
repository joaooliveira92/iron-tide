import { SafeInt } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import {
  type DesignTemplate,
  DesignTemplateSchema,
  validateAgainstSchema,
} from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex, compareCodePoints } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { toSafeIntOpt, toStr } from "./campaignInput.js";
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
  const armament = validated["torpedoArmament"] as
    | { mountType: string; tubeCount: number; torpedoModelId: string }[]
    | undefined;
  return armament?.map((m) => {
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

function buildRawDesignRecord(
  rec: Record<string, unknown>,
  designVersionId: string,
): Record<string, unknown> {
  return {
    designId: designVersionId,
    designFamilyId: rec["designFamilyId"],
    nationId: rec["nationId"],
    className: rec["className"],
    hullType: rec["hullType"],
    displacementKg: rec["displacementKg"],
    speedUms: rec["speedUms"],
    armorBeltUm: rec["armorBeltUm"],
    mainGuns: rec["mainGuns"],
    machineryType: rec["machineryType"],
    hitPoints: rec["hitPoints"],
    crewComplement: rec["crewComplement"],
    contentVersion: rec["contentVersion"],
    ...(rec["torpedoArmament"] !== undefined ? { torpedoArmament: rec["torpedoArmament"] } : {}),
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
      className: validated["className"],
      nationId: validated["nationId"],
      hullType: validated["hullType"],
      displacementKg: validated["displacementKg"],
      speedUms: validated["speedUms"],
      armorBeltUm: validated["armorBeltUm"],
      mainGuns: validated["mainGuns"],
      machineryType: validated["machineryType"],
      hitPoints: validated["hitPoints"],
      crewComplement: validated["crewComplement"],
      ...(hashableTorpedoArmament(torpedoArmament)
        ? { torpedoArmament: hashableTorpedoArmament(torpedoArmament) }
        : {}),
    }),
  );
}

function buildCompiledDesign(
  designVersionId: string,
  rec: Record<string, unknown>,
  validated: DesignTemplate,
  torpedoOf?: TorpedoResolver,
): CompiledDesignVersion {
  const torpedoArmament = mapTorpedoArmament(validated, torpedoOf);
  return {
    designVersionId,
    designFamilyId: toStr(validated["designFamilyId"], ""),
    className: validated["className"],
    nationId: validated["nationId"],
    hullType: validated["hullType"],
    normalizedDisplacementKg: toSafeIntOpt(
      rec["normalizedDisplacementKg"] ?? validated["displacementKg"],
      SafeInt(0),
    ),
    normalizedSpeedUms: toSafeIntOpt(
      rec["normalizedSpeedUms"] ?? knotsToUms(validated["speedUms"] as number),
      SafeInt(0),
    ),
    normalizedArmorUm: toSafeIntOpt(
      rec["normalizedArmorUm"] ?? mmToUm(validated["armorBeltUm"] as number),
      SafeInt(0),
    ),
    hitPoints: toSafeIntOpt(validated["hitPoints"], SafeInt(100)),
    mainGunsCaliber: toSafeIntOpt(
      validated["mainGuns"]?.["caliber"] === undefined
        ? undefined
        : mmToUm(validated["mainGuns"]?.["caliber"] as number),
      SafeInt(0),
    ),
    mainGunsCount: toSafeIntOpt(validated["mainGuns"]?.["count"], SafeInt(0)),
    machineryType: validated["machineryType"],
    crewComplement: toSafeIntOpt(validated["crewComplement"], SafeInt(0)),
    contentVersion: toStr(validated["contentVersion"], "0.1.0"),
    compiledHash: computeCompiledDesignHash(designVersionId, validated, torpedoArmament),
    ...(torpedoArmament ? { torpedoArmament } : {}),
  };
}

export function buildDesignsFromData(
  designsData: unknown[],
  collector: DiagnosticCollector,
  torpedoOf?: TorpedoResolver,
): Map<string, CompiledDesignVersion> {
  const designs = new Map<string, CompiledDesignVersion>();

  if (!Array.isArray(designsData)) return designs;

  for (const d of designsData) {
    const rec = d as Record<string, unknown>;
    const designVersionId = toStr(rec["designVersionId"], toStr(rec["designId"]));

    const validated = validateAgainstSchema(
      buildRawDesignRecord(rec, designVersionId),
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

export function buildDesignFamiliesFromData(designsData: unknown[]): Map<string, DesignFamily> {
  const families = new Map<string, DesignFamily>();

  if (!Array.isArray(designsData)) return families;

  const familyMap = new Map<string, { rec: Record<string, unknown>; members: string[] }>();
  for (const d of designsData) {
    const rec = d as Record<string, unknown>;
    const familyId = toStr(rec["designFamilyId"], "");
    if (!familyId) continue;
    const designVersionId = toStr(rec["designVersionId"], toStr(rec["designId"]));

    if (!familyMap.has(familyId)) {
      familyMap.set(familyId, { rec, members: [] });
    }
    if (designVersionId) {
      familyMap.get(familyId)!.members.push(designVersionId);
    }
  }

  for (const [familyId, data] of familyMap) {
    data.members.sort((a, b) => compareCodePoints(a, b));
    families.set(familyId, {
      designFamilyId: familyId,
      nationId: toStr(data.rec["nationId"], ""),
      rootDesignVersionId: data.members[0] ?? "",
      memberDesignVersionIds: data.members,
      familyCreationMonth: toStr(data.rec["familyCreationMonth"], "1880-01"),
    });
  }

  return families;
}
