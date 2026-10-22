import type { ResolvedArmament } from "./model.js";

export const COMPILED_ARMAMENT_VERSION = "compiled_armament_v1" as const;

export interface CompiledArmamentModifier {
  readonly source: string;
  readonly valueBp: number;
}

export interface CompiledArmamentMount {
  readonly instanceId: string;
  readonly gunFamilyId: string;
  readonly gunModelId: string;
  readonly mountId: string;
  readonly ammunitionId: string;
  readonly mountType: string;
  readonly gunCount: number;
  readonly accessStatus: string;
  readonly caliberUm?: number;
  readonly shellMassG?: number;
  readonly propellantChargeBp?: number;
  readonly nominalRateOfFireX100?: number;
  readonly gunMassKg?: number;
  readonly mountInstallationMassKg?: number;
  readonly totalInstallationMassKg?: number;
  readonly ammunitionUnitMassG?: number;
  readonly firingArcDeg?: number;
  readonly appliedModifiers: readonly CompiledArmamentModifier[];
}

export function toCompiledArmamentMount(
  resolved: ResolvedArmament,
  mountType: string,
  instanceId: string,
): CompiledArmamentMount {
  return {
    instanceId,
    gunFamilyId: String(resolved.gunFamilyId),
    gunModelId: String(resolved.gunModelId),
    mountId: String(resolved.mountId),
    ammunitionId: String(resolved.ammunitionId),
    mountType,
    gunCount: resolved.gunCount,
    accessStatus: resolved.accessStatus,
    ...(resolved.caliberUm !== undefined ? { caliberUm: resolved.caliberUm } : {}),
    ...(resolved.shellMassG !== undefined ? { shellMassG: resolved.shellMassG } : {}),
    ...(resolved.propellantChargeBp !== undefined
      ? { propellantChargeBp: resolved.propellantChargeBp }
      : {}),
    ...(resolved.mechanicalRateOfFireRoundsPerMinuteX100 !== undefined
      ? { nominalRateOfFireX100: resolved.mechanicalRateOfFireRoundsPerMinuteX100 }
      : {}),
    ...(resolved.gunMassKg !== undefined ? { gunMassKg: resolved.gunMassKg } : {}),
    ...(resolved.mountInstallationMassKg !== undefined
      ? { mountInstallationMassKg: resolved.mountInstallationMassKg }
      : {}),
    ...(resolved.totalInstallationMassKg !== undefined
      ? { totalInstallationMassKg: resolved.totalInstallationMassKg }
      : {}),
    ...(resolved.ammunitionUnitMassG !== undefined
      ? { ammunitionUnitMassG: resolved.ammunitionUnitMassG }
      : {}),
    ...(resolved.firingArcDeg !== undefined ? { firingArcDeg: resolved.firingArcDeg } : {}),
    appliedModifiers: resolved.appliedModifiers.map((m) => ({
      source: m.source,
      valueBp: m.valueBp,
    })),
  };
}
