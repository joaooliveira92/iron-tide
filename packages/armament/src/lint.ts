/**
 * The authoritative armament content lint (ADR-0093, national armament integration Step 2).
 *
 * `lintArmament` validates a whole authored armament catalogue — shared gun families, national gun
 * models, the mount catalogue and ammunition patterns — as one deterministic pass. It is the release
 * gate over the armament domain: at release every `BLOCKING` finding fails the gate; `WARNING` and
 * `ADVISORY` findings stay visible but are never silently promoted to blockers.
 *
 * Like the resolver, it is pure: it never mutates its input, never throws for expected content
 * errors, and returns findings in the same deterministic order as `resolveArmament`. It contains no
 * nation-id conditional — national difference enters only through the data it is given.
 */
import { ARMAMENT_BP_ONE, isSafeInteger } from "./arithmetic.js";
import {
  sortArmamentFindings,
  type ArmamentEntityRef,
  type ArmamentFindingCode,
  type ArmamentFindingSeverity,
  type ArmamentParameterValue,
  type ArmamentResolutionFinding,
} from "./findings.js";
import { isArmamentId } from "./ids.js";
import {
  ARMAMENT_MOUNT_TYPES,
  type AmmunitionPattern,
  type GunFamily,
  type GunModel,
  type GunMountDef,
} from "./model.js";
import type { ArmamentProvenance } from "./provenance.js";

/** The full authored armament catalogue the lint validates. */
export interface ArmamentCatalogue {
  readonly families: readonly GunFamily[];
  readonly models: readonly GunModel[];
  readonly mounts: readonly GunMountDef[];
  readonly ammunition: readonly AmmunitionPattern[];
}

export interface ArmamentLintOptions {
  /** At release a PLACEHOLDER provenance is a blocker; a missing source reference is always a blocker. */
  readonly release: boolean;
  /** Technology ids the scenario actually defines. */
  readonly knownTechnologyIds: ReadonlySet<string>;
  /** Nation ids the scenario actually defines. */
  readonly knownNationIds?: ReadonlySet<string>;
  /** model id → nation id, so national access and nation references can be checked. */
  readonly nationOfModel?: Readonly<Record<string, string>>;
  /** ammunition id → nation id. */
  readonly nationOfAmmunition?: Readonly<Record<string, string>>;
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

const familyEntity = (family: GunFamily): ArmamentEntityRef => ({
  kind: "gunFamily",
  id: String(family.id),
});
const modelEntity = (model: GunModel): ArmamentEntityRef => ({
  kind: "gunModel",
  id: String(model.id),
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
  value: string,
): void {
  if (!isArmamentId(value)) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_ID_INVALID",
        entity,
        "id",
        { value },
        `${entity.kind} id '${value}' is not a canonical lower snake_case id.`,
      ),
    );
  }
}

function checkIntRange(
  findings: ArmamentResolutionFinding[],
  entity: ArmamentEntityRef,
  field: string,
  value: number | undefined,
  min: number,
  max: number,
): void {
  if (value === undefined) return;
  if (!isSafeInteger(value) || value < min || value > max) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_VALUE_OUT_OF_RANGE",
        entity,
        field,
        { value, min, max },
        `${entity.kind}.${field} must be a safe integer in ${min}..${max}.`,
      ),
    );
  }
}

function checkMonth(
  findings: ArmamentResolutionFinding[],
  entity: ArmamentEntityRef,
  field: string,
  value: string | null | undefined,
): void {
  if (value == null) return;
  if (!MONTH_RE.test(value)) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_MONTH_INVALID",
        entity,
        field,
        { value },
        `${entity.kind}.${field} '${value}' is not YYYY-MM.`,
      ),
    );
  }
}

function checkDateOrder(
  findings: ArmamentResolutionFinding[],
  entity: ArmamentEntityRef,
  introductionMonth: string | undefined,
  retirementMonth: string | null | undefined,
): void {
  if (
    introductionMonth !== undefined &&
    MONTH_RE.test(introductionMonth) &&
    retirementMonth != null &&
    MONTH_RE.test(retirementMonth) &&
    monthIndex(retirementMonth) < monthIndex(introductionMonth)
  ) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_DATE_ORDER",
        entity,
        "retirementMonth",
        { introductionMonth, retirementMonth },
        `${entity.kind} retires (${retirementMonth}) before it is introduced (${introductionMonth}).`,
      ),
    );
  }
}

function checkProvenance(
  findings: ArmamentResolutionFinding[],
  entity: ArmamentEntityRef,
  subject: string,
  provenance: ArmamentProvenance,
  release: boolean,
): void {
  if (provenance.sourceStatus === "PLACEHOLDER") {
    if (release) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_PROVENANCE_PLACEHOLDER",
          entity,
          subject,
          { sourceStatus: provenance.sourceStatus },
          `${subject} carries PLACEHOLDER provenance; release content must be sourced.`,
        ),
      );
    } else {
      findings.push(
        finding(
          "ADVISORY",
          "ARMAMENT_PROVENANCE_PLACEHOLDER",
          entity,
          subject,
          { sourceStatus: provenance.sourceStatus },
          `${subject} carries PLACEHOLDER provenance; release validation will reject it.`,
        ),
      );
    }
    return;
  }
  if (provenance.sources.length === 0) {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_PROVENANCE_MISSING",
        entity,
        subject,
        {},
        `${subject} has no source references.`,
      ),
    );
  }
  // A verified measurement cannot be a pure balance choice, and a historical fact cannot be only a
  // balance target; a derivation without an explanation is an unexplained unit conversion.
  if (provenance.kind === "balance_adjustment" && provenance.sourceStatus === "VERIFIED") {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_PROVENANCE_INCONSISTENT",
        entity,
        subject,
        { kind: provenance.kind, sourceStatus: provenance.sourceStatus },
        `${subject} is a balance adjustment but claims VERIFIED status.`,
      ),
    );
  }
  if (provenance.kind === "historical_fact" && provenance.sourceStatus === "BALANCE_TARGET") {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_PROVENANCE_INCONSISTENT",
        entity,
        subject,
        { kind: provenance.kind, sourceStatus: provenance.sourceStatus },
        `${subject} is a historical claim but carries only BALANCE_TARGET status.`,
      ),
    );
  }
  if (provenance.derivation !== undefined && provenance.derivation.conversion.trim() === "") {
    findings.push(
      finding(
        "BLOCKING",
        "ARMAMENT_PROVENANCE_INCONSISTENT",
        entity,
        subject,
        {},
        `${subject} has a derivation with no conversion explanation.`,
      ),
    );
  }
}

function checkReferences(
  findings: ArmamentResolutionFinding[],
  entity: ArmamentEntityRef,
  field: string,
  ids: readonly string[] | undefined,
  known: ReadonlySet<string>,
): void {
  if (ids === undefined) return;
  for (const id of [...ids].sort()) {
    if (!known.has(id)) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_REFERENCE_MISSING",
          entity,
          field,
          { reference: id },
          `${entity.kind}.${field} references unknown '${id}'.`,
        ),
      );
    }
  }
}

/** Validate a whole armament catalogue. Pure, deterministic, never throws on content errors. */
export function lintArmament(
  catalogue: ArmamentCatalogue,
  options: ArmamentLintOptions,
): readonly ArmamentResolutionFinding[] {
  const findings: ArmamentResolutionFinding[] = [];
  const { families, models, mounts, ammunition } = catalogue;

  const familyIds = new Set(families.map((f) => String(f.id)));
  const modelIds = new Set(models.map((m) => String(m.id)));
  const knownTech = options.knownTechnologyIds;
  const knownNations = options.knownNationIds;

  const perCollection: [string, readonly { readonly id: unknown }[]][] = [
    ["gunFamily", families],
    ["gunModel", models],
    ["gunMount", mounts],
    ["ammunition", ammunition],
  ];
  const globalSeen = new Map<string, string>();
  for (const [kind, records] of perCollection) {
    const seen = new Set<string>();
    for (const record of records) {
      const id = String(record.id);
      const entity: ArmamentEntityRef = { kind: kind as ArmamentEntityRef["kind"], id };
      checkId(findings, entity, id);
      if (seen.has(id)) {
        findings.push(
          finding(
            "BLOCKING",
            "ARMAMENT_ID_DUPLICATE",
            entity,
            "id",
            { id },
            `${kind} id '${id}' is declared more than once.`,
          ),
        );
      }
      seen.add(id);
      const prior = globalSeen.get(id);
      if (prior !== undefined && prior !== kind) {
        findings.push(
          finding(
            "BLOCKING",
            "ARMAMENT_ID_DUPLICATE",
            entity,
            "id",
            { id, collections: `${prior},${kind}` },
            `id '${id}' is used by both ${prior} and ${kind}.`,
          ),
        );
      }
      globalSeen.set(id, kind);
    }
  }

  for (const family of families) {
    const entity = familyEntity(family);
    checkProvenance(findings, entity, "gunFamily.provenance", family.provenance, options.release);
  }

  const modelKey = new Map<string, string>();
  for (const model of models) {
    const entity = modelEntity(model);
    checkReferences(findings, entity, "familyId", [String(model.familyId)], familyIds);
    checkReferences(
      findings,
      entity,
      "requiredTechnologyIds",
      model.requiredTechnologyIds,
      knownTech,
    );
    if (model.supportedMountTypes !== undefined) {
      if (model.supportedMountTypes.length === 0) {
        findings.push(
          finding(
            "BLOCKING",
            "ARMAMENT_VALUE_OUT_OF_RANGE",
            entity,
            "supportedMountTypes",
            { value: 0 },
            "gunModel.supportedMountTypes must list at least one mount type.",
          ),
        );
      }
      for (const mountType of [...model.supportedMountTypes].sort()) {
        if (!(ARMAMENT_MOUNT_TYPES as readonly string[]).includes(mountType)) {
          findings.push(
            finding(
              "BLOCKING",
              "ARMAMENT_VALUE_OUT_OF_RANGE",
              entity,
              "supportedMountTypes",
              { value: mountType },
              `'${mountType}' is not a canonical mount type.`,
            ),
          );
        }
      }
    }
    checkMonth(findings, entity, "introductionMonth", model.introductionMonth);
    checkMonth(findings, entity, "retirementMonth", model.retirementMonth);
    checkDateOrder(findings, entity, model.introductionMonth, model.retirementMonth);
    checkIntRange(findings, entity, "caliberUm", model.caliberUm, 1, Number.MAX_SAFE_INTEGER);
    checkIntRange(findings, entity, "gunMassKg", model.gunMassKg, 0, Number.MAX_SAFE_INTEGER);
    checkIntRange(findings, entity, "shellMassG", model.shellMassG, 0, Number.MAX_SAFE_INTEGER);
    checkIntRange(
      findings,
      entity,
      "roundVolumeMl",
      model.roundVolumeMl,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    checkIntRange(
      findings,
      entity,
      "mechanicalRateOfFireRoundsPerMinuteX100",
      model.mechanicalRateOfFireRoundsPerMinuteX100,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    checkIntRange(findings, entity, "propellantChargeBp", model.propellantChargeBp, 0, 1_000_000);
    checkIntRange(findings, entity, "reliabilityBp", model.reliabilityBp, 0, ARMAMENT_BP_ONE);
    checkIntRange(
      findings,
      entity,
      "nominalMuzzleVelocityUmPerSec",
      model.nominalMuzzleVelocityUmPerSec,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (
      model.barrelLengthCalibers !== undefined &&
      (!Number.isFinite(model.barrelLengthCalibers) || model.barrelLengthCalibers <= 0)
    ) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_VALUE_OUT_OF_RANGE",
          entity,
          "barrelLengthCalibers",
          { value: model.barrelLengthCalibers },
          "gunModel.barrelLengthCalibers must be a positive ratio.",
        ),
      );
    }
    checkProvenance(findings, entity, "gunModel.provenance", model.provenance, options.release);

    const nation = options.nationOfModel?.[String(model.id)];
    if (nation !== undefined && knownNations !== undefined && !knownNations.has(nation)) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_NATION_UNKNOWN",
          entity,
          "nationId",
          { nationId: nation },
          `gunModel '${model.id}' belongs to unknown nation '${nation}'.`,
        ),
      );
    }
    const key = `${String(model.familyId)}@${nation ?? ""}`;
    const prior = modelKey.get(key);
    if (prior !== undefined) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_DUPLICATE_CONTRADICTORY",
          entity,
          "familyId",
          { familyId: String(model.familyId), nationId: nation ?? "", other: prior },
          `nation '${nation ?? "?"}' has more than one model for family '${model.familyId}'.`,
        ),
      );
    } else {
      modelKey.set(key, String(model.id));
    }
  }

  const mountKey = new Map<string, string>();
  for (const mount of mounts) {
    const entity = mountEntity(mount);
    if (!(ARMAMENT_MOUNT_TYPES as readonly string[]).includes(mount.mountType)) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_VALUE_OUT_OF_RANGE",
          entity,
          "mountType",
          { value: String(mount.mountType) },
          `'${String(mount.mountType)}' is not a canonical mount type.`,
        ),
      );
    }
    checkReferences(
      findings,
      entity,
      "compatibleGunFamilies",
      mount.compatibleGunFamilies,
      familyIds,
    );
    checkReferences(
      findings,
      entity,
      "requiredTechnologyIds",
      mount.requiredTechnologyIds,
      knownTech,
    );
    checkMonth(findings, entity, "introductionMonth", mount.introductionMonth);
    checkMonth(findings, entity, "retirementMonth", mount.retirementMonth);
    checkDateOrder(findings, entity, mount.introductionMonth, mount.retirementMonth);
    checkIntRange(findings, entity, "gunCount", mount.gunCount, 1, Number.MAX_SAFE_INTEGER);
    checkIntRange(
      findings,
      entity,
      "baseInstallationMassKg",
      mount.baseInstallationMassKg,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    checkIntRange(
      findings,
      entity,
      "perGunInstallationMassKg",
      mount.perGunInstallationMassKg,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    checkIntRange(findings, entity, "topWeightKg", mount.topWeightKg, 0, Number.MAX_SAFE_INTEGER);
    checkIntRange(
      findings,
      entity,
      "supportedArmorMm",
      mount.supportedArmorMm,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    checkIntRange(findings, entity, "traverseDeg", mount.traverseDeg, 0, 360);
    checkIntRange(findings, entity, "elevationMinDeg", mount.elevationMinDeg, -90, 90);
    checkIntRange(findings, entity, "elevationMaxDeg", mount.elevationMaxDeg, -90, 90);
    checkIntRange(findings, entity, "firingArcDeg", mount.firingArcDeg, 0, 360);
    checkIntRange(
      findings,
      entity,
      "rateOfFireModifierBp",
      mount.rateOfFireModifierBp,
      0,
      1_000_000,
    );
    checkIntRange(
      findings,
      entity,
      "ammunitionHandlingModifierBp",
      mount.ammunitionHandlingModifierBp,
      0,
      1_000_000,
    );
    checkIntRange(
      findings,
      entity,
      "hullSpaceUsageLitre",
      mount.hullSpaceUsageLitre,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (
      mount.elevationMinDeg !== undefined &&
      mount.elevationMaxDeg !== undefined &&
      mount.elevationMinDeg > mount.elevationMaxDeg
    ) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_VALUE_OUT_OF_RANGE",
          entity,
          "elevationMaxDeg",
          { min: mount.elevationMinDeg, max: mount.elevationMaxDeg },
          "gunMount.elevationMinDeg exceeds elevationMaxDeg.",
        ),
      );
    }
    checkProvenance(findings, entity, "gunMount.provenance", mount.provenance, options.release);

    const familiesKey = [...(mount.compatibleGunFamilies ?? [])].sort().join(",");
    const key = `${familiesKey}#${mount.mountType}`;
    const prior = mountKey.get(key);
    if (prior !== undefined) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_DUPLICATE_CONTRADICTORY",
          entity,
          "compatibleGunFamilies",
          { mountType: mount.mountType, other: prior },
          `two mounts ('${prior}', '${mount.id}') share the same family set and mount type.`,
        ),
      );
    } else {
      mountKey.set(key, String(mount.id));
    }
  }

  for (const pattern of ammunition) {
    const entity = ammunitionEntity(pattern);
    checkReferences(
      findings,
      entity,
      "compatibleGunFamilies",
      pattern.compatibleGunFamilies,
      familyIds,
    );
    checkReferences(
      findings,
      entity,
      "compatibleGunModelIds",
      pattern.compatibleGunModelIds,
      modelIds,
    );
    checkMonth(findings, entity, "introductionMonth", pattern.introductionMonth);
    checkMonth(findings, entity, "retirementMonth", pattern.retirementMonth);
    checkDateOrder(findings, entity, pattern.introductionMonth, pattern.retirementMonth);
    checkIntRange(findings, entity, "shellMassG", pattern.shellMassG, 0, Number.MAX_SAFE_INTEGER);
    checkIntRange(
      findings,
      entity,
      "penetrationBiasBp",
      pattern.penetrationBiasBp,
      0,
      ARMAMENT_BP_ONE,
    );
    checkIntRange(
      findings,
      entity,
      "propellantInteractionBp",
      pattern.propellantInteractionBp,
      0,
      1_000_000,
    );
    checkIntRange(
      findings,
      entity,
      "explosiveFillerG",
      pattern.explosiveFillerG,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    checkIntRange(findings, entity, "burstingEffectBp", pattern.burstingEffectBp, 0, 1_000_000);
    checkIntRange(findings, entity, "fireEffectBp", pattern.fireEffectBp, 0, 1_000_000);
    checkIntRange(
      findings,
      entity,
      "ammunitionCostMicro",
      pattern.ammunitionCostMicro,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    checkIntRange(
      findings,
      entity,
      "rateOfFireModifierBp",
      pattern.rateOfFireModifierBp,
      0,
      1_000_000,
    );
    checkProvenance(findings, entity, "ammunition.provenance", pattern.provenance, options.release);

    const nation = options.nationOfAmmunition?.[String(pattern.id)];
    if (nation !== undefined && knownNations !== undefined && !knownNations.has(nation)) {
      findings.push(
        finding(
          "BLOCKING",
          "ARMAMENT_NATION_UNKNOWN",
          entity,
          "nationId",
          { nationId: nation },
          `ammunition '${pattern.id}' belongs to unknown nation '${nation}'.`,
        ),
      );
    }
  }

  return sortArmamentFindings(findings);
}

/** True when no finding blocks release. */
export function armamentLintOk(findings: readonly ArmamentResolutionFinding[]): boolean {
  return !findings.some((f) => f.severity === "BLOCKING");
}
