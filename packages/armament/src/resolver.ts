import {
  ARMAMENT_BP_ONE,
  composeBpMultipliers,
  scaleByBp,
  type ArmamentArithmeticResult,
} from "./arithmetic.js";
import {
  type ArmamentEntityRef,
  type ArmamentFindingSeverity,
  type ArmamentParameterValue,
  type ArmamentResolutionFinding,
  type ArmamentFindingCode,
  sortArmamentFindings,
} from "./findings.js";
import { isArmamentId } from "./ids.js";
import {
  ARMAMENT_ACCESS_STATUSES,
  ARMAMENT_MOUNT_TYPES,
  type AmmunitionPattern,
  type AppliedArmamentModifier,
  type ArmamentAccessContext,
  type ArmamentAccessStatus,
  type ArmamentTechnologyContext,
  type GunModel,
  type GunMountDef,
  type ResolvedArmament,
} from "./model.js";
import type { ArmamentProvenance } from "./provenance.js";

export interface ArmamentResolutionResult {
  readonly ok: boolean;
  readonly resolved: ResolvedArmament | null;
  readonly findings: readonly ArmamentResolutionFinding[];
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthIndex = (month: string): number =>
  Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1);

const finding = (
  severity: ArmamentFindingSeverity,
  code: ArmamentFindingCode,
  entity: ArmamentEntityRef,
  field: string,
  parameters: Readonly<Record<string, ArmamentParameterValue>>,
  message: string,
): ArmamentResolutionFinding => ({ severity, code, entity, field, parameters, message });

const gunModelEntity = (gunModel: GunModel): ArmamentEntityRef => ({
  kind: "gunModel",
  id: String(gunModel.id),
});
const mountEntity = (mount: GunMountDef): ArmamentEntityRef => ({
  kind: "gunMount",
  id: String(mount.id),
});
const ammunitionEntity = (ammunition: AmmunitionPattern): ArmamentEntityRef => ({
  kind: "ammunition",
  id: String(ammunition.id),
});

function checkId(
  findings: ArmamentResolutionFinding[],
  entity: ArmamentEntityRef,
  field: string,
  value: string,
): void {
  if (!isArmamentId(value)) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_ID_INVALID",
        entity,
        field,
        { value },
        `${field} '${value}' is not a canonical lower snake_case id.`,
      ),
    );
  }
}

function checkRange(
  findings: ArmamentResolutionFinding[],
  entity: ArmamentEntityRef,
  field: string,
  value: number | undefined,
  min: number,
  max: number,
): void {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_VALUE_OUT_OF_RANGE",
        entity,
        field,
        { value, min, max },
        `${field} must be a safe integer in ${min}..${max}.`,
      ),
    );
  }
}

function checkDateBand(
  findings: ArmamentResolutionFinding[],
  entity: ArmamentEntityRef,
  introductionMonth: string | undefined,
  retirementMonth: string | null | undefined,
  monthIdx: number | null,
): void {
  if (introductionMonth !== undefined && MONTH_RE.test(introductionMonth)) {
    if (monthIdx !== null && monthIdx < monthIndex(introductionMonth)) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_BEFORE_INTRODUCTION",
          entity,
          "introductionMonth",
          { introductionMonth, month: String(monthIdx) },
          `Not available until ${introductionMonth}.`,
        ),
      );
    }
  } else if (introductionMonth !== undefined) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_MONTH_INVALID",
        entity,
        "introductionMonth",
        { value: introductionMonth },
        `introductionMonth '${introductionMonth}' is not YYYY-MM.`,
      ),
    );
  }
  if (retirementMonth != null) {
    if (!MONTH_RE.test(retirementMonth)) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_MONTH_INVALID",
          entity,
          "retirementMonth",
          { value: retirementMonth },
          `retirementMonth '${retirementMonth}' is not YYYY-MM.`,
        ),
      );
    } else if (monthIdx !== null && monthIdx > monthIndex(retirementMonth)) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_AFTER_RETIREMENT",
          entity,
          "retirementMonth",
          { retirementMonth, month: String(monthIdx) },
          `Retired after ${retirementMonth}.`,
        ),
      );
    }
  }
}

function placeholderFinding(
  entity: ArmamentEntityRef,
  field: string,
  provenance: ArmamentProvenance,
): ArmamentResolutionFinding | null {
  if (provenance.sourceStatus !== "PLACEHOLDER") return null;
  return finding(
    "ADVISORY",
    "ARMAMENT_PROVENANCE_PLACEHOLDER",
    entity,
    field,
    { sourceStatus: provenance.sourceStatus },
    `${field} carries PLACEHOLDER provenance; release validation will reject it.`,
  );
}

function accessStatusOf(
  accessContext: ArmamentAccessContext,
  familyId: string,
): ArmamentAccessStatus | undefined {
  return accessContext.componentAccess[familyId];
}

function composeModifiers(
  mount: GunMountDef,
  ammunition: AmmunitionPattern,
): ArmamentArithmeticResult<{
  readonly appliedModifiers: readonly AppliedArmamentModifier[];
  readonly resolvedRateOfFireModifierBp: number;
}> {
  const appliedModifiers: AppliedArmamentModifier[] = [];
  if (mount.rateOfFireModifierBp !== undefined) {
    appliedModifiers.push({
      source: "mount.rateOfFireModifierBp",
      valueBp: mount.rateOfFireModifierBp,
    });
  }
  if (mount.ammunitionHandlingModifierBp !== undefined) {
    appliedModifiers.push({
      source: "mount.ammunitionHandlingModifierBp",
      valueBp: mount.ammunitionHandlingModifierBp,
    });
  }
  if (ammunition.rateOfFireModifierBp !== undefined) {
    appliedModifiers.push({
      source: "ammunition.rateOfFireModifierBp",
      valueBp: ammunition.rateOfFireModifierBp,
    });
  }
  const composed = composeBpMultipliers(appliedModifiers.map((m) => m.valueBp));
  return composed.ok
    ? {
        ok: true,
        value: {
          appliedModifiers,
          resolvedRateOfFireModifierBp: composed.value,
        },
      }
    : composed;
}

export function resolveArmament(
  gunModel: GunModel,
  mount: GunMountDef,
  ammunition: AmmunitionPattern,
  technologyContext: ArmamentTechnologyContext,
  accessContext: ArmamentAccessContext,
): ArmamentResolutionResult {
  const findings: ArmamentResolutionFinding[] = [];
  const gmEntity = gunModelEntity(gunModel);
  const mEntity = mountEntity(mount);
  const aEntity = ammunitionEntity(ammunition);

  checkId(findings, gmEntity, "id", String(gunModel.id));
  checkId(findings, gmEntity, "familyId", String(gunModel.familyId));
  checkId(findings, mEntity, "id", String(mount.id));
  checkId(findings, aEntity, "id", String(ammunition.id));

  const monthValid = MONTH_RE.test(technologyContext.month);
  if (!monthValid) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_MONTH_INVALID",
        { kind: "armament", id: String(gunModel.id) },
        "technologyContext.month",
        { value: technologyContext.month },
        `Resolution month '${technologyContext.month}' is not YYYY-MM.`,
      ),
    );
  }
  const monthIdx = monthValid ? monthIndex(technologyContext.month) : null;

  if (!(ARMAMENT_MOUNT_TYPES as readonly string[]).includes(mount.mountType)) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_VALUE_OUT_OF_RANGE",
        mEntity,
        "mountType",
        { value: String(mount.mountType) },
        `mountType '${String(mount.mountType)}' is not a canonical mount type.`,
      ),
    );
  }

  if (
    mount.compatibleGunFamilies !== undefined &&
    !mount.compatibleGunFamilies.includes(gunModel.familyId)
  ) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_GUN_FAMILY_MISMATCH",
        mEntity,
        "compatibleGunFamilies",
        { familyId: String(gunModel.familyId) },
        `Mount '${mount.id}' does not accept gun family '${gunModel.familyId}'.`,
      ),
    );
  }
  if (
    gunModel.supportedMountTypes !== undefined &&
    !gunModel.supportedMountTypes.includes(mount.mountType)
  ) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_MOUNT_NOT_SUPPORTED",
        gmEntity,
        "supportedMountTypes",
        { mountType: mount.mountType },
        `Gun model '${gunModel.id}' cannot be installed in a ${mount.mountType} mount.`,
      ),
    );
  }

  if (
    ammunition.compatibleGunFamilies !== undefined &&
    !ammunition.compatibleGunFamilies.includes(gunModel.familyId)
  ) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_AMMUNITION_INCOMPATIBLE",
        aEntity,
        "compatibleGunFamilies",
        { familyId: String(gunModel.familyId) },
        `Ammunition '${ammunition.id}' does not fit gun family '${gunModel.familyId}'.`,
      ),
    );
  }
  if (
    ammunition.compatibleGunModelIds !== undefined &&
    !ammunition.compatibleGunModelIds.includes(gunModel.id)
  ) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_AMMUNITION_INCOMPATIBLE",
        aEntity,
        "compatibleGunModelIds",
        { gunModelId: String(gunModel.id) },
        `Ammunition '${ammunition.id}' does not fit gun model '${gunModel.id}'.`,
      ),
    );
  }

  checkDateBand(findings, gmEntity, gunModel.introductionMonth, gunModel.retirementMonth, monthIdx);
  checkDateBand(findings, mEntity, mount.introductionMonth, mount.retirementMonth, monthIdx);
  checkDateBand(
    findings,
    aEntity,
    ammunition.introductionMonth,
    ammunition.retirementMonth,
    monthIdx,
  );

  const requiredTechs = [
    ...(gunModel.requiredTechnologyIds ?? []),
    ...(mount.requiredTechnologyIds ?? []),
  ];
  for (const techId of requiredTechs) {
    if (!technologyContext.unlockedTechnologyIds.has(techId)) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_TECHNOLOGY_MISSING",
          gunModel.requiredTechnologyIds?.includes(techId) ? gmEntity : mEntity,
          "requiredTechnologyIds",
          { technologyId: String(techId) },
          `Required technology '${techId}' is not unlocked.`,
        ),
      );
    }
  }

  const status = accessStatusOf(accessContext, gunModel.familyId);
  const effectiveStatus: ArmamentAccessStatus = status === undefined ? "DOMESTIC" : status;
  if (!(ARMAMENT_ACCESS_STATUSES as readonly string[]).includes(effectiveStatus)) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_VALUE_OUT_OF_RANGE",
        gmEntity,
        "accessStatus",
        { value: String(effectiveStatus) },
        `Access status '${String(effectiveStatus)}' is not canonical.`,
      ),
    );
  } else if (effectiveStatus === "UNAVAILABLE") {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_ACCESS_UNAVAILABLE",
        gmEntity,
        "familyId",
        { familyId: String(gunModel.familyId), nationId: String(accessContext.nationId) },
        `Nation '${accessContext.nationId}' cannot obtain gun family '${gunModel.familyId}'.`,
      ),
    );
  } else if (effectiveStatus === "IMPORTED" || effectiveStatus === "CAPTURED_OR_STUDIED") {
    findings.push(
      finding(
        "WARNING",
        "ARMAMENT_ACCESS_FOREIGN",
        gmEntity,
        "familyId",
        { familyId: String(gunModel.familyId), accessStatus: effectiveStatus },
        `Gun family '${gunModel.familyId}' is ${effectiveStatus.toLowerCase().replaceAll("_", " ")} rather than domestic.`,
      ),
    );
  }

  checkRange(findings, gmEntity, "caliberUm", gunModel.caliberUm, 1, Number.MAX_SAFE_INTEGER);
  checkRange(findings, gmEntity, "gunMassKg", gunModel.gunMassKg, 0, Number.MAX_SAFE_INTEGER);
  checkRange(findings, gmEntity, "shellMassG", gunModel.shellMassG, 0, Number.MAX_SAFE_INTEGER);
  checkRange(
    findings,
    gmEntity,
    "roundVolumeMl",
    gunModel.roundVolumeMl,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  checkRange(
    findings,
    gmEntity,
    "mechanicalRateOfFireRoundsPerMinuteX100",
    gunModel.mechanicalRateOfFireRoundsPerMinuteX100,
    1,
    Number.MAX_SAFE_INTEGER,
  );
  checkRange(findings, gmEntity, "propellantChargeBp", gunModel.propellantChargeBp, 0, 1_000_000);
  checkRange(findings, gmEntity, "reliabilityBp", gunModel.reliabilityBp, 0, ARMAMENT_BP_ONE);
  checkRange(findings, mEntity, "gunCount", mount.gunCount, 1, Number.MAX_SAFE_INTEGER);
  checkRange(
    findings,
    mEntity,
    "baseInstallationMassKg",
    mount.baseInstallationMassKg,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  checkRange(
    findings,
    mEntity,
    "perGunInstallationMassKg",
    mount.perGunInstallationMassKg,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  checkRange(findings, mEntity, "firingArcDeg", mount.firingArcDeg, 0, 360);
  checkRange(findings, mEntity, "rateOfFireModifierBp", mount.rateOfFireModifierBp, 0, 1_000_000);
  checkRange(
    findings,
    mEntity,
    "ammunitionHandlingModifierBp",
    mount.ammunitionHandlingModifierBp,
    0,
    1_000_000,
  );
  checkRange(findings, aEntity, "shellMassG", ammunition.shellMassG, 0, Number.MAX_SAFE_INTEGER);
  checkRange(
    findings,
    aEntity,
    "penetrationBiasBp",
    ammunition.penetrationBiasBp,
    0,
    ARMAMENT_BP_ONE,
  );
  checkRange(
    findings,
    aEntity,
    "rateOfFireModifierBp",
    ammunition.rateOfFireModifierBp,
    0,
    1_000_000,
  );

  for (const f of [
    placeholderFinding(gmEntity, "gunModel.provenance", gunModel.provenance),
    placeholderFinding(mEntity, "mount.provenance", mount.provenance),
    placeholderFinding(aEntity, "ammunition.provenance", ammunition.provenance),
  ]) {
    if (f !== null) findings.push(f);
  }

  const sorted = sortArmamentFindings(findings);
  if (sorted.some((f) => f.severity === "BLOCKING")) {
    return { ok: false, resolved: null, findings: sorted };
  }

  const modifiers = composeModifiers(mount, ammunition);
  if (!modifiers.ok) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_ARITHMETIC_OVERFLOW",
        mEntity,
        "resolvedRateOfFireModifierBp",
        {},
        modifiers.failure.message,
      ),
    );
    return { ok: false, resolved: null, findings: sortArmamentFindings(findings) };
  }
  const { appliedModifiers, resolvedRateOfFireModifierBp } = modifiers.value;

  const shellMassG = ammunition.shellMassG ?? gunModel.shellMassG;
  const chargeBp = gunModel.propellantChargeBp;
  let ammunitionUnitMassG: number | undefined;
  if (shellMassG !== undefined && chargeBp !== undefined) {
    const unitMass = scaleByBp(shellMassG, ARMAMENT_BP_ONE + chargeBp);
    if (!unitMass.ok) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_ARITHMETIC_OVERFLOW",
          gmEntity,
          "ammunitionUnitMassG",
          { shellMassG, propellantChargeBp: chargeBp },
          unitMass.failure.message,
        ),
      );
      return { ok: false, resolved: null, findings: sortArmamentFindings(findings) };
    }
    ammunitionUnitMassG = unitMass.value;
  }
  const mountStructureMassKg =
    mount.baseInstallationMassKg !== undefined || mount.perGunInstallationMassKg !== undefined
      ? (mount.baseInstallationMassKg ?? 0) + (mount.perGunInstallationMassKg ?? 0) * mount.gunCount
      : undefined;
  const totalInstallationMassKg =
    gunModel.gunMassKg !== undefined && mountStructureMassKg !== undefined
      ? gunModel.gunMassKg * mount.gunCount + mountStructureMassKg
      : undefined;

  const resolved: ResolvedArmament = {
    gunModelId: gunModel.id,
    gunFamilyId: gunModel.familyId,
    mountId: mount.id,
    ammunitionId: ammunition.id,
    gunCount: mount.gunCount,
    ...(gunModel.caliberUm !== undefined ? { caliberUm: gunModel.caliberUm } : {}),
    ...(shellMassG !== undefined ? { shellMassG } : {}),
    ...(chargeBp !== undefined ? { propellantChargeBp: chargeBp } : {}),
    ...(ammunitionUnitMassG !== undefined ? { ammunitionUnitMassG } : {}),
    ...(gunModel.roundVolumeMl !== undefined
      ? { ammunitionUnitVolumeMl: gunModel.roundVolumeMl }
      : {}),
    ...(gunModel.nominalMuzzleVelocityUmPerSec !== undefined
      ? { nominalMuzzleVelocityUmPerSec: gunModel.nominalMuzzleVelocityUmPerSec }
      : {}),
    ...(gunModel.mechanicalRateOfFireRoundsPerMinuteX100 !== undefined
      ? {
          mechanicalRateOfFireRoundsPerMinuteX100: gunModel.mechanicalRateOfFireRoundsPerMinuteX100,
        }
      : {}),
    resolvedRateOfFireModifierBp,
    ...(gunModel.gunMassKg !== undefined ? { gunMassKg: gunModel.gunMassKg } : {}),
    ...(mountStructureMassKg !== undefined
      ? { mountInstallationMassKg: mountStructureMassKg }
      : {}),
    ...(totalInstallationMassKg !== undefined ? { totalInstallationMassKg } : {}),
    ...(mount.topWeightKg !== undefined ? { topWeightKg: mount.topWeightKg } : {}),
    ...(mount.firingArcDeg !== undefined ? { firingArcDeg: mount.firingArcDeg } : {}),
    ...(mount.hullSpaceUsageLitre !== undefined
      ? { hullSpaceUsageLitre: mount.hullSpaceUsageLitre }
      : {}),
    ...(gunModel.reliabilityBp !== undefined ? { reliabilityBp: gunModel.reliabilityBp } : {}),
    accessStatus: effectiveStatus,
    provenance: {
      gunModel: gunModel.provenance,
      mount: mount.provenance,
      ammunition: ammunition.provenance,
    },
    appliedModifiers,
  };

  return { ok: true, resolved, findings: sorted };
}
