import {
  ammunitionId,
  gunFamilyId,
  gunModelId,
  type AmmunitionPattern as ArmamentAmmunitionPattern,
  type ArmamentProvenance,
} from "@bluewave/armament";
import type { AuthoredAmmunition, AuthoredArmamentContent } from "./armamentContent.js";
import type { Provenance } from "./nationProfile.js";

export const toArmamentProvenance = (p: Provenance): ArmamentProvenance => ({
  sourceStatus: p.sourceStatus,
  confidence: p.confidence,
  kind: p.kind,
  sources: p.sources.map((s) => ({ ...s })),
  ...(p.derivation !== undefined ? { derivation: { ...p.derivation } } : {}),
  ...(p.note !== undefined ? { note: p.note } : {}),
});

export function ammunitionToDomain(a: AuthoredAmmunition): ArmamentAmmunitionPattern {
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

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function inService(a: AuthoredAmmunition, month: string | undefined): boolean {
  if (month === undefined || !MONTH_RE.test(month)) return true;
  if (
    a.introductionMonth !== undefined &&
    MONTH_RE.test(a.introductionMonth) &&
    month < a.introductionMonth
  ) {
    return false;
  }
  return !(
    a.retirementMonth !== undefined &&
    a.retirementMonth !== null &&
    MONTH_RE.test(a.retirementMonth) &&
    month > a.retirementMonth
  );
}

export function armamentAmmunitionFor(
  content: AuthoredArmamentContent,
  nationId: string,
  familyId: string,
  month?: string,
): ArmamentAmmunitionPattern | null {
  const own = content.ammunition.filter((a) => a.nationId === nationId);
  const listed = own.filter((a) => (a.compatibleGunFamilies ?? []).includes(familyId));
  const unrestricted = own.filter(
    (a) => a.compatibleGunFamilies === undefined && a.compatibleGunModelIds === undefined,
  );
  const live = (a: AuthoredAmmunition) => inService(a, month);
  const preferred =
    listed.find(live) ?? unrestricted.find(live) ?? listed[0] ?? unrestricted[0] ?? own[0];
  return preferred === undefined ? null : ammunitionToDomain(preferred);
}
