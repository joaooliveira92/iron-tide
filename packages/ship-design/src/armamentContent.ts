import {
  ammunitionId,
  armamentNationId,
  armamentTechnologyId,
  gunFamilyId,
  gunModelId,
  gunMountId,
  lintArmament,
  resolveArmament,
  sortArmamentFindings,
  type AmmunitionPattern as ArmamentAmmunitionPattern,
  type ArmamentAccessStatus,
  type ArmamentCatalogue,
  type ArmamentEntityRef,
  type ArmamentFindingCode,
  type ArmamentFindingSeverity,
  type ArmamentMountType,
  type ArmamentParameterValue,
  type ArmamentProvenance,
  type ArmamentResolutionFinding,
  type ArmamentResolutionResult,
  type GunFamily,
  type GunModel as ArmamentGunModel,
  type GunMountDef as ArmamentGunMountDef,
  type ResolvedArmament,
} from "@bluewave/armament";
import type { ComponentDef } from "./component.js";
import type { GunModelDef, NationNavalProfile, Provenance } from "./nationProfile.js";

export interface AuthoredGunFamily {
  readonly id: string;
  readonly designation: string;
  readonly category: "MAIN_GUN" | "SECONDARY_GUN" | "DUAL_PURPOSE_GUN" | "AA_WEAPON";
  readonly defaultMountType: ArmamentMountType;
  readonly provenance: Provenance;
}

export interface AuthoredGunModel {
  readonly id: string;
  readonly familyId: string;
  readonly nationId: string;
  readonly designation: string;
  readonly caliberUm?: number;
  readonly barrelLengthCalibers?: number;
  readonly gunMassKg?: number;
  readonly loadingSystem?: string;
  readonly nominalMuzzleVelocityUmPerSec?: number;
  readonly mechanicalRateOfFireRoundsPerMinuteX100?: number;
  readonly propellantChargeBp?: number;
  readonly shellMassG?: number;
  readonly roundVolumeMl?: number;
  readonly reliabilityBp?: number;
  readonly introductionMonth?: string;
  readonly retirementMonth?: string | null;
  readonly supportedMountTypes: readonly ArmamentMountType[];
  readonly requiredTechnologyIds: readonly string[];
  readonly provenance: Provenance;
}

export interface AuthoredGunMount {
  readonly id: string;
  readonly mountType: ArmamentMountType;
  readonly compatibleGunFamilies?: readonly string[];
  readonly gunCount: number;
  readonly baseInstallationMassKg?: number;
  readonly perGunInstallationMassKg?: number;
  readonly topWeightKg?: number;
  readonly supportedArmorMm?: number;
  readonly traverseDeg?: number;
  readonly elevationMinDeg?: number;
  readonly elevationMaxDeg?: number;
  readonly firingArcDeg?: number;
  readonly rateOfFireModifierBp?: number;
  readonly ammunitionHandlingModifierBp?: number;
  readonly crewProtection?: string;
  readonly hullSpaceUsageLitre?: number;
  readonly stabilityContributionKgM?: number;
  readonly vulnerability?: string;
  readonly introductionMonth?: string;
  readonly retirementMonth?: string | null;
  readonly requiredTechnologyIds: readonly string[];
  readonly provenance: Provenance;
}

export interface AuthoredAmmunition {
  readonly id: string;
  readonly shellType: "AP" | "APC" | "CPC" | "SAP" | "HE" | "MELINITE";
  readonly nationId: string;
  readonly compatibleGunFamilies?: readonly string[];
  readonly compatibleGunModelIds?: readonly string[];
  readonly shellMassG?: number;
  readonly propellantInteractionBp?: number;
  readonly penetrationBiasBp?: number;
  readonly explosiveFillerG?: number;
  readonly burstingEffectBp?: number;
  readonly fireEffectBp?: number;
  readonly storageHazard?: string;
  readonly ammunitionCostMicro?: number;
  readonly rateOfFireModifierBp?: number;
  readonly introductionMonth?: string;
  readonly retirementMonth?: string | null;
  readonly provenance: Provenance;
}

export interface AuthoredArmamentContent {
  readonly gunFamilies: readonly AuthoredGunFamily[];
  readonly gunModels: readonly AuthoredGunModel[];
  readonly gunMounts: readonly AuthoredGunMount[];
  readonly ammunition: readonly AuthoredAmmunition[];
}

const toArmamentProvenance = (p: Provenance): ArmamentProvenance => ({
  sourceStatus: p.sourceStatus,
  confidence: p.confidence,
  kind: p.kind,
  sources: p.sources.map((s) => ({ ...s })),
  ...(p.derivation !== undefined ? { derivation: { ...p.derivation } } : {}),
  ...(p.note !== undefined ? { note: p.note } : {}),
});

function familyToDomain(f: AuthoredGunFamily): GunFamily {
  return {
    id: gunFamilyId(f.id),
    designation: f.designation,
    category: f.category,
    provenance: toArmamentProvenance(f.provenance),
  };
}

function modelToDomain(m: AuthoredGunModel): ArmamentGunModel {
  return {
    id: gunModelId(m.id),
    familyId: gunFamilyId(m.familyId),
    designation: m.designation,
    ...(m.caliberUm !== undefined ? { caliberUm: m.caliberUm } : {}),
    ...(m.barrelLengthCalibers !== undefined
      ? { barrelLengthCalibers: m.barrelLengthCalibers }
      : {}),
    ...(m.gunMassKg !== undefined ? { gunMassKg: m.gunMassKg } : {}),
    ...(m.loadingSystem !== undefined ? { loadingSystem: m.loadingSystem } : {}),
    ...(m.nominalMuzzleVelocityUmPerSec !== undefined
      ? { nominalMuzzleVelocityUmPerSec: m.nominalMuzzleVelocityUmPerSec }
      : {}),
    ...(m.mechanicalRateOfFireRoundsPerMinuteX100 !== undefined
      ? { mechanicalRateOfFireRoundsPerMinuteX100: m.mechanicalRateOfFireRoundsPerMinuteX100 }
      : {}),
    ...(m.propellantChargeBp !== undefined ? { propellantChargeBp: m.propellantChargeBp } : {}),
    ...(m.shellMassG !== undefined ? { shellMassG: m.shellMassG } : {}),
    ...(m.roundVolumeMl !== undefined ? { roundVolumeMl: m.roundVolumeMl } : {}),
    ...(m.reliabilityBp !== undefined ? { reliabilityBp: m.reliabilityBp } : {}),
    ...(m.introductionMonth !== undefined ? { introductionMonth: m.introductionMonth } : {}),
    retirementMonth: m.retirementMonth ?? null,
    supportedMountTypes: [...m.supportedMountTypes],
    requiredTechnologyIds: m.requiredTechnologyIds.map(armamentTechnologyId),
    provenance: toArmamentProvenance(m.provenance),
  };
}

function mountToDomain(m: AuthoredGunMount): ArmamentGunMountDef {
  return {
    id: gunMountId(m.id),
    mountType: m.mountType,
    ...(m.compatibleGunFamilies !== undefined
      ? { compatibleGunFamilies: m.compatibleGunFamilies.map(gunFamilyId) }
      : {}),
    gunCount: m.gunCount,
    ...(m.baseInstallationMassKg !== undefined
      ? { baseInstallationMassKg: m.baseInstallationMassKg }
      : {}),
    ...(m.perGunInstallationMassKg !== undefined
      ? { perGunInstallationMassKg: m.perGunInstallationMassKg }
      : {}),
    ...(m.topWeightKg !== undefined ? { topWeightKg: m.topWeightKg } : {}),
    ...(m.supportedArmorMm !== undefined ? { supportedArmorMm: m.supportedArmorMm } : {}),
    ...(m.traverseDeg !== undefined ? { traverseDeg: m.traverseDeg } : {}),
    ...(m.elevationMinDeg !== undefined ? { elevationMinDeg: m.elevationMinDeg } : {}),
    ...(m.elevationMaxDeg !== undefined ? { elevationMaxDeg: m.elevationMaxDeg } : {}),
    ...(m.firingArcDeg !== undefined ? { firingArcDeg: m.firingArcDeg } : {}),
    ...(m.rateOfFireModifierBp !== undefined
      ? { rateOfFireModifierBp: m.rateOfFireModifierBp }
      : {}),
    ...(m.ammunitionHandlingModifierBp !== undefined
      ? { ammunitionHandlingModifierBp: m.ammunitionHandlingModifierBp }
      : {}),
    ...(m.crewProtection !== undefined ? { crewProtection: m.crewProtection } : {}),
    ...(m.hullSpaceUsageLitre !== undefined ? { hullSpaceUsageLitre: m.hullSpaceUsageLitre } : {}),
    ...(m.stabilityContributionKgM !== undefined
      ? { stabilityContributionKgM: m.stabilityContributionKgM }
      : {}),
    ...(m.vulnerability !== undefined ? { vulnerability: m.vulnerability } : {}),
    ...(m.introductionMonth !== undefined ? { introductionMonth: m.introductionMonth } : {}),
    retirementMonth: m.retirementMonth ?? null,
    requiredTechnologyIds: m.requiredTechnologyIds.map(armamentTechnologyId),
    provenance: toArmamentProvenance(m.provenance),
  };
}

function ammunitionToDomain(a: AuthoredAmmunition): ArmamentAmmunitionPattern {
  return {
    id: ammunitionId(a.id),
    shellType: a.shellType,
    ...(a.compatibleGunFamilies !== undefined
      ? { compatibleGunFamilies: a.compatibleGunFamilies.map(gunFamilyId) }
      : {}),
    ...(a.compatibleGunModelIds !== undefined
      ? { compatibleGunModelIds: a.compatibleGunModelIds.map(gunModelId) }
      : {}),
    ...(a.shellMassG !== undefined ? { shellMassG: a.shellMassG } : {}),
    ...(a.propellantInteractionBp !== undefined
      ? { propellantInteractionBp: a.propellantInteractionBp }
      : {}),
    ...(a.penetrationBiasBp !== undefined ? { penetrationBiasBp: a.penetrationBiasBp } : {}),
    ...(a.explosiveFillerG !== undefined ? { explosiveFillerG: a.explosiveFillerG } : {}),
    ...(a.burstingEffectBp !== undefined ? { burstingEffectBp: a.burstingEffectBp } : {}),
    ...(a.fireEffectBp !== undefined ? { fireEffectBp: a.fireEffectBp } : {}),
    ...(a.storageHazard !== undefined ? { storageHazard: a.storageHazard } : {}),
    ...(a.ammunitionCostMicro !== undefined ? { ammunitionCostMicro: a.ammunitionCostMicro } : {}),
    ...(a.rateOfFireModifierBp !== undefined
      ? { rateOfFireModifierBp: a.rateOfFireModifierBp }
      : {}),
    ...(a.introductionMonth !== undefined ? { introductionMonth: a.introductionMonth } : {}),
    retirementMonth: a.retirementMonth ?? null,
    provenance: toArmamentProvenance(a.provenance),
  };
}

export function buildArmamentCatalogue(content: AuthoredArmamentContent): ArmamentCatalogue {
  return {
    families: content.gunFamilies.map(familyToDomain),
    models: content.gunModels.map(modelToDomain),
    mounts: content.gunMounts.map(mountToDomain),
    ammunition: content.ammunition.map(ammunitionToDomain),
  };
}

export interface ArmamentWeapon {
  readonly instanceId: string;
  readonly componentId: string;
  readonly gunCount: number;
}

export interface ArmamentStarter {
  readonly id: string;
  readonly month: string;
  readonly nationId: string;
  readonly weapons: readonly ArmamentWeapon[];
}

export interface ArmamentUsage {
  readonly starterId: string;
  readonly nationId: string;
  readonly month: string;
  readonly instanceId: string;
  readonly familyId: string;
  readonly modelId: string;
  readonly mountId: string;
  readonly mountType: ArmamentMountType;
  readonly ammunitionId: string;
  readonly gunCount: number;
  readonly result: ArmamentResolutionResult;
}

export interface ArmamentCoverageInput {
  readonly content: AuthoredArmamentContent;
  readonly components: readonly ComponentDef[];
  readonly profiles: readonly NationNavalProfile[];
  readonly starters: readonly ArmamentStarter[];
  readonly technologies: readonly { readonly id: string; readonly year: number }[];
  readonly release: boolean;
}

function componentById(components: readonly ComponentDef[], id: string): ComponentDef | undefined {
  return components.find((c) => c.id === id);
}

function attrOf(def: ComponentDef, name: string): number | undefined {
  const raw = def.attributes?.[name];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function armamentModelFor(
  content: AuthoredArmamentContent,
  components: readonly ComponentDef[],
  nationId: string,
  familyId: string,
): ArmamentGunModel | null {
  const authored = content.gunModels.find(
    (m) => m.nationId === nationId && m.familyId === familyId,
  );
  if (authored !== undefined) return modelToDomain(authored);
  const family = content.gunFamilies.find((f) => f.id === familyId);
  const component = componentById(components, familyId);
  if (family === undefined || component === undefined) return null;
  const domain = familyToDomain(family);
  return {
    id: gunModelId(`standard_${familyId}`),
    familyId: domain.id,
    designation: family.designation,
    ...(attrOf(component, "caliberUm") !== undefined
      ? { caliberUm: attrOf(component, "caliberUm")! }
      : {}),
    ...(component.constants.gun_kg !== undefined ? { gunMassKg: component.constants.gun_kg } : {}),
    ...(attrOf(component, "shellMassG") !== undefined
      ? { shellMassG: attrOf(component, "shellMassG")! }
      : {}),
    ...(attrOf(component, "chargeBp") !== undefined
      ? { propellantChargeBp: attrOf(component, "chargeBp")! }
      : {}),
    ...(attrOf(component, "roundVolumeMl") !== undefined
      ? { roundVolumeMl: attrOf(component, "roundVolumeMl")! }
      : {}),
    ...(attrOf(component, "rofBaseX100") !== undefined
      ? { mechanicalRateOfFireRoundsPerMinuteX100: attrOf(component, "rofBaseX100")! }
      : {}),
    introductionMonth: component.introduction.fromMonth,
    retirementMonth: component.introduction.obsoleteMonth,
    supportedMountTypes: [family.defaultMountType],
    requiredTechnologyIds: component.requires.map(armamentTechnologyId),
    provenance: domain.provenance,
  };
}

export function armamentMountFor(
  content: AuthoredArmamentContent,
  components: readonly ComponentDef[],
  familyId: string,
  mountType: ArmamentMountType,
  gunCount: number,
): ArmamentGunMountDef | null {
  const authored = content.gunMounts.find(
    (m) => m.mountType === mountType && (m.compatibleGunFamilies ?? []).includes(familyId),
  );
  const base =
    authored !== undefined
      ? mountToDomain(authored)
      : (() => {
          const component = componentById(components, familyId);
          const family = content.gunFamilies.find((f) => f.id === familyId);
          if (component === undefined || family === undefined) return null;
          return {
            id: gunMountId(`${familyId}_${mountType.toLowerCase()}`),
            mountType,
            compatibleGunFamilies: [gunFamilyId(familyId)],
            gunCount: 1,
            ...(component.constants.mount_fixed_kg !== undefined
              ? { baseInstallationMassKg: component.constants.mount_fixed_kg }
              : {}),
            ...(component.constants.mount_per_barrel_kg !== undefined
              ? { perGunInstallationMassKg: component.constants.mount_per_barrel_kg }
              : {}),
            ...(attrOf(component, "beamArcDeg") !== undefined
              ? { firingArcDeg: attrOf(component, "beamArcDeg")! }
              : {}),
            introductionMonth: component.introduction.fromMonth,
            retirementMonth: null,
            requiredTechnologyIds: [],
            provenance: toArmamentProvenance(family.provenance),
          } satisfies ArmamentGunMountDef;
        })();
  if (base === null) return null;
  return { ...base, gunCount };
}

export function armamentAmmunitionFor(
  content: AuthoredArmamentContent,
  nationId: string,
  familyId: string,
): ArmamentAmmunitionPattern | null {
  const own = content.ammunition.filter((a) => a.nationId === nationId);
  const preferred = own.find((a) => (a.compatibleGunFamilies ?? []).includes(familyId)) ?? own[0];
  return preferred === undefined ? null : ammunitionToDomain(preferred);
}

function unlockedTechs(
  technologies: readonly { readonly id: string; readonly year: number }[],
  month: string,
): ReadonlySet<string> {
  const year = Number(month.slice(0, 4));
  return new Set(technologies.filter((t) => t.year <= year).map((t) => t.id));
}

function accessStatusOf(
  profiles: readonly NationNavalProfile[],
  nationId: string,
  month: string,
  familyId: string,
): ArmamentAccessStatus {
  const profile = profiles.find((p) => p.nationId === nationId);
  return (profile?.componentAccess[familyId]?.status ?? "DOMESTIC") as ArmamentAccessStatus;
}

function missingFinding(
  severity: ArmamentFindingSeverity,
  code: ArmamentFindingCode,
  entity: ArmamentEntityRef,
  field: string,
  parameters: Readonly<Record<string, ArmamentParameterValue>>,
  message: string,
): ArmamentResolutionFinding {
  return { severity, code, entity, field, parameters, message };
}

export function buildArmamentUsageManifest(input: ArmamentCoverageInput): readonly ArmamentUsage[] {
  const usages: ArmamentUsage[] = [];
  for (const starter of input.starters) {
    for (const weapon of starter.weapons) {
      const model = armamentModelFor(
        input.content,
        input.components,
        starter.nationId,
        weapon.componentId,
      );
      if (model === null) continue;
      const mountType = model.supportedMountTypes?.[0] ?? "DECK_OPEN";
      const mount = armamentMountFor(
        input.content,
        input.components,
        weapon.componentId,
        mountType,
        weapon.gunCount,
      );
      if (mount === null) continue;
      const ammunition = armamentAmmunitionFor(input.content, starter.nationId, weapon.componentId);
      if (ammunition === null) continue;
      const access: Record<string, ArmamentAccessStatus> = {};
      const profile = input.profiles.find((p) => p.nationId === starter.nationId);
      for (const familyId of Object.keys(profile?.componentAccess ?? {})) {
        access[familyId] = accessStatusOf(
          input.profiles,
          starter.nationId,
          starter.month,
          familyId,
        );
      }
      const result = resolveArmament(
        model,
        mount,
        ammunition,
        {
          month: starter.month,
          unlockedTechnologyIds: new Set(
            [...unlockedTechs(input.technologies, starter.month)].map(armamentTechnologyId),
          ),
        },
        { nationId: armamentNationId(starter.nationId), componentAccess: access },
      );
      usages.push({
        starterId: starter.id,
        nationId: starter.nationId,
        month: starter.month,
        instanceId: weapon.instanceId,
        familyId: weapon.componentId,
        modelId: String(model.id),
        mountId: String(mount.id),
        mountType,
        ammunitionId: String(ammunition.id),
        gunCount: weapon.gunCount,
        result,
      });
    }
  }
  return usages;
}

export interface InstalledWeaponResolution {
  readonly resolved: ResolvedArmament | null;
  readonly model: ArmamentGunModel | null;
  readonly mount: ArmamentGunMountDef | null;
  readonly ammunition: ArmamentAmmunitionPattern | null;
  readonly mountType: ArmamentMountType;
  readonly findings: readonly ArmamentResolutionFinding[];
}

export interface ResolveInstalledWeaponInput {
  readonly content: AuthoredArmamentContent;
  readonly components: readonly ComponentDef[];
  readonly nationId: string;
  readonly familyId: string;
  readonly gunCount: number;
  readonly mountType?: ArmamentMountType;
  readonly month: string;
  readonly unlockedTechnologyIds: ReadonlySet<string>;
  readonly componentAccess: Readonly<Record<string, ArmamentAccessStatus>>;
}

export function resolveInstalledWeapon(
  input: ResolveInstalledWeaponInput,
): InstalledWeaponResolution {
  const model = armamentModelFor(input.content, input.components, input.nationId, input.familyId);
  const mountType = input.mountType ?? model?.supportedMountTypes?.[0] ?? "DECK_OPEN";
  if (model === null) {
    return {
      resolved: null,
      model: null,
      mount: null,
      ammunition: null,
      mountType,
      findings: [
        missingFinding(
          "BLOCKING",
          "ARMAMENT_REFERENCE_MISSING",
          { kind: "gunModel", id: input.familyId },
          "familyId",
          { nationId: input.nationId, familyId: input.familyId },
          `No armament model for family '${input.familyId}' available to '${input.nationId}'.`,
        ),
      ],
    };
  }
  const mount = armamentMountFor(
    input.content,
    input.components,
    input.familyId,
    mountType,
    input.gunCount,
  );
  if (mount === null) {
    return {
      resolved: null,
      model,
      mount: null,
      ammunition: null,
      mountType,
      findings: [
        missingFinding(
          "BLOCKING",
          "ARMAMENT_REFERENCE_MISSING",
          { kind: "gunMount", id: `${input.familyId}_${mountType.toLowerCase()}` },
          "mountType",
          { familyId: input.familyId, mountType },
          `No armament mount for family '${input.familyId}' in a ${mountType} mount.`,
        ),
      ],
    };
  }
  const ammunition = armamentAmmunitionFor(input.content, input.nationId, input.familyId);
  if (ammunition === null) {
    return {
      resolved: null,
      model,
      mount,
      ammunition: null,
      mountType,
      findings: [
        missingFinding(
          "BLOCKING",
          "ARMAMENT_REFERENCE_MISSING",
          { kind: "ammunition", id: input.nationId },
          "nationId",
          { nationId: input.nationId, familyId: input.familyId },
          `No armament ammunition pattern for nation '${input.nationId}'.`,
        ),
      ],
    };
  }
  const result = resolveArmament(
    model,
    mount,
    ammunition,
    {
      month: input.month,
      unlockedTechnologyIds: new Set([...input.unlockedTechnologyIds].map(armamentTechnologyId)),
    },
    { nationId: armamentNationId(input.nationId), componentAccess: input.componentAccess },
  );
  return {
    resolved: result.resolved,
    model,
    mount,
    ammunition,
    mountType,
    findings: result.findings,
  };
}

export function nationHasArmamentContent(
  content: AuthoredArmamentContent,
  nationId: string,
): boolean {
  return (
    content.gunModels.some((m) => m.nationId === nationId) ||
    content.ammunition.some((a) => a.nationId === nationId)
  );
}

function entityIdOf(finding: ArmamentResolutionFinding): string {
  return `${finding.entity.kind}:${finding.entity.id}`;
}

function drift(
  entity: ArmamentEntityRef,
  field: string,
  expected: ArmamentParameterValue,
  actual: ArmamentParameterValue,
  subject: string,
): ArmamentResolutionFinding {
  return missingFinding(
    "BLOCKING",
    "ARMAMENT_COMPAT_DRIFT",
    entity,
    field,
    { expected, actual },
    `${subject} ${field} is ${String(actual)} but the legacy content gives ${String(expected)}.`,
  );
}

function profileModelFor(
  profiles: readonly NationNavalProfile[],
  modelId: string,
): { model: GunModelDef; nationId: string } | undefined {
  for (const profile of profiles) {
    const model = profile.gunModels.find((g) => g.id === modelId);
    if (model !== undefined) return { model, nationId: profile.nationId };
  }
  return undefined;
}

export function lintArmamentContent(
  input: ArmamentCoverageInput,
): readonly ArmamentResolutionFinding[] {
  const findings: ArmamentResolutionFinding[] = [];
  const catalogue = buildArmamentCatalogue(input.content);
  const knownTechnologyIds = new Set(input.technologies.map((t) => t.id));
  const knownNationIds = new Set(input.profiles.map((p) => p.nationId));
  const nationOfModel: Record<string, string> = {};
  for (const m of input.content.gunModels) nationOfModel[m.id] = m.nationId;
  const nationOfAmmunition: Record<string, string> = {};
  for (const a of input.content.ammunition) nationOfAmmunition[a.id] = a.nationId;

  findings.push(
    ...lintArmament(catalogue, {
      release: input.release,
      knownTechnologyIds,
      knownNationIds,
      nationOfModel,
      nationOfAmmunition,
    }),
  );

  for (const family of input.content.gunFamilies) {
    const entity: ArmamentEntityRef = { kind: "gunFamily", id: family.id };
    const component = componentById(input.components, family.id);
    if (component === undefined) {
      findings.push(
        missingFinding(
          "BLOCKING",
          "ARMAMENT_REFERENCE_MISSING",
          entity,
          "id",
          { familyId: family.id },
          `gun family '${family.id}' has no matching legacy component.`,
        ),
      );
      continue;
    }
    if (family.category !== component.category) {
      findings.push(
        drift(entity, "category", component.category, family.category, `gun family '${family.id}'`),
      );
    }
  }

  for (const model of input.content.gunModels) {
    const entity: ArmamentEntityRef = { kind: "gunModel", id: model.id };
    const profile = input.profiles.find((p) => p.nationId === model.nationId);
    if (profile?.componentAccess[model.familyId]?.status === "UNAVAILABLE") {
      findings.push(
        missingFinding(
          "BLOCKING",
          "ARMAMENT_ACCESS_CONTRADICTION",
          entity,
          "familyId",
          { nationId: model.nationId, familyId: model.familyId },
          `gun model '${model.id}' is authored for a family nation '${model.nationId}' marks UNAVAILABLE.`,
        ),
      );
    }
    const component = componentById(input.components, model.familyId);
    if (component === undefined) continue;
    const compare = (field: string, actual: number | undefined, expected: number | undefined) => {
      if (actual === undefined || expected === undefined) return;
      if (actual !== expected)
        findings.push(drift(entity, field, expected, actual, `gun model '${model.id}'`));
    };
    compare("caliberUm", model.caliberUm, attrOf(component, "caliberUm"));
    compare("gunMassKg", model.gunMassKg, component.constants.gun_kg);
    compare("propellantChargeBp", model.propellantChargeBp, attrOf(component, "chargeBp"));
    compare("roundVolumeMl", model.roundVolumeMl, attrOf(component, "roundVolumeMl"));
    compare(
      "mechanicalRateOfFireRoundsPerMinuteX100",
      model.mechanicalRateOfFireRoundsPerMinuteX100,
      attrOf(component, "rofBaseX100"),
    );
    const profileModel = profileModelFor(input.profiles, model.id);
    if (profileModel !== undefined) {
      const override = profileModel.model.overrides["attributes.shellMassG"];
      const expectedShell =
        override !== undefined ? Number(override) : attrOf(component, "shellMassG");
      compare("shellMassG", model.shellMassG, expectedShell);
      const expectedMounts = [...profileModel.model.mounts].sort().join(",");
      const actualMounts = [...model.supportedMountTypes].sort().join(",");
      if (expectedMounts !== actualMounts) {
        findings.push(
          drift(
            entity,
            "supportedMountTypes",
            expectedMounts,
            actualMounts,
            `gun model '${model.id}'`,
          ),
        );
      }
    }
    const required = [...model.requiredTechnologyIds].sort().join(",");
    const componentRequires = [...component.requires].sort().join(",");
    if (required !== componentRequires) {
      findings.push(
        drift(
          entity,
          "requiredTechnologyIds",
          componentRequires,
          required,
          `gun model '${model.id}'`,
        ),
      );
    }
  }

  for (const mount of input.content.gunMounts) {
    const entity: ArmamentEntityRef = { kind: "gunMount", id: mount.id };
    const familyId = (mount.compatibleGunFamilies ?? [])[0];
    if (familyId === undefined) continue;
    const component = componentById(input.components, familyId);
    if (component === undefined) continue;
    const compare = (field: string, actual: number | undefined, expected: number | undefined) => {
      if (actual === undefined || expected === undefined) return;
      if (actual !== expected)
        findings.push(drift(entity, field, expected, actual, `gun mount '${mount.id}'`));
    };
    compare(
      "baseInstallationMassKg",
      mount.baseInstallationMassKg,
      component.constants.mount_fixed_kg,
    );
    compare(
      "perGunInstallationMassKg",
      mount.perGunInstallationMassKg,
      component.constants.mount_per_barrel_kg,
    );
    compare("firingArcDeg", mount.firingArcDeg, attrOf(component, "beamArcDeg"));
  }

  for (const pattern of input.content.ammunition) {
    const entity: ArmamentEntityRef = { kind: "ammunition", id: pattern.id };
    const legacy = input.profiles
      .flatMap((p) => p.ammunitionPatterns)
      .find((a) => a.id === pattern.id);
    if (legacy === undefined) continue;
    if (legacy.pattern !== pattern.shellType) {
      findings.push(
        drift(entity, "shellType", legacy.pattern, pattern.shellType, `ammunition '${pattern.id}'`),
      );
    }
    if (legacy.penetrationBiasBp !== pattern.penetrationBiasBp) {
      findings.push(
        drift(
          entity,
          "penetrationBiasBp",
          legacy.penetrationBiasBp,
          pattern.penetrationBiasBp ?? 0,
          `ammunition '${pattern.id}'`,
        ),
      );
    }
  }

  for (const profile of input.profiles) {
    for (const model of profile.gunModels) {
      if (!input.content.gunModels.some((m) => m.id === model.id)) {
        findings.push(
          missingFinding(
            "ADVISORY",
            "ARMAMENT_REFERENCE_MISSING",
            { kind: "gunModel", id: model.id },
            "id",
            { familyId: model.familyId },
            `legacy gun model '${model.id}' has no first-class armament counterpart yet.`,
          ),
        );
      }
    }
  }

  for (const usage of buildArmamentUsageManifest(input)) {
    findings.push(...usage.result.findings);
  }

  return sortArmamentFindings(findings);
}

export function armamentContentLintOk(findings: readonly ArmamentResolutionFinding[]): boolean {
  return !findings.some((f) => f.severity === "BLOCKING");
}

export const armamentFindingKey = (finding: ArmamentResolutionFinding): string =>
  `${finding.severity}|${finding.code}|${entityIdOf(finding)}|${finding.field}`;
