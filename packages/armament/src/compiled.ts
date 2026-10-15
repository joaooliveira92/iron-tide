/**
 * The compiled combat armament contract (ADR-0093 Step 4).
 *
 * This is the immutable, unit-explicit identity + grounded-value snapshot of one installed weapon.
 * `@bluewave/ship-design` produces it from `ResolvedArmament` at design-compile time and persists it on
 * the compiled design version; `@bluewave/combat` consumes it to identify its batteries without
 * depending on ship-design and without re-reading mutable armament content at battle time.
 *
 * It carries no combat penetration, hit probability or damage: only the identity and the grounded inputs
 * those later calculations read. It lives in the neutral armament package so ship-design and combat
 * consume one contract, never two drifting copies.
 */
import type { ResolvedArmament } from "./model.js";

/** Compatibility version of the compiled combat armament contract. */
export const COMPILED_ARMAMENT_VERSION = "compiled_armament_v1" as const;

/** One applied modifier, preserved from `ResolvedArmament.appliedModifiers`. */
export interface CompiledArmamentModifier {
  readonly source: string;
  readonly valueBp: number;
}

/**
 * The compiled identity of one installed weapon placement. Every value is grounded in the
 * authoritative `ResolvedArmament`; values the content does not carry are omitted, never guessed.
 */
export interface CompiledArmamentMount {
  /** The ship-design placement this installation compiled from (stable within a design version). */
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

/**
 * Map a resolved armament into the compiled contract. Pure and total; the produced object is plain JSON
 * (no class instances, no cycles) so it serialises, hashes and clones deterministically.
 */
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
