// DESIGN-41 §5 — Stage 2: Protection interaction.
// Wires the armor model (armorModel.ts from INC-2) to determine the outcome
// of a hit against armor. Pure deterministic function: no ambient I/O/clock/random.
//
// Produces effective resistance (µm), penetration margin (µm, positive = penetration),
// and a deterministic PenetrationOutcome (one of 7 outcomes per DESIGN-39 §24).
import {
  type ArmorQualityFamily,
  type ArmorZoneType,
  type PenetrationOutcome,
  determinePenetrationOutcome,
  lookupArmorQualityMultiplierBp,
  manufacturingEffectiveThickness,
  obliquityFactorBp,
  qualityAdjustedThickness,
  validateArmorThickness,
} from "./armorModel.js";

// ProtectionInput — parameters describing the projectile and struck armor.
export interface ProtectionInput {
  /** Projectile caliber in micrometres. */
  projectileCaliberUm: number;
  /** Projectile impact velocity in m/s. */
  projectileVelocityMs: number;
  /** Projectile mass in arbitrary consistent units (e.g. kg). */
  projectileMass: number;
  /** The type of armor zone that was struck. */
  hitZoneType: ArmorZoneType;
  /** The design (as-built) thickness of the struck armor in µm. */
  armorThicknessUm: number;
  /** The armor quality family (e.g. KRUPP_KC). */
  armorQualityFamily: ArmorQualityFamily;
  /** The armor plate's slope from vertical (degrees). */
  armorSlopeDeg: number;
  /** The shell's impact angle relative to horizontal (degrees). */
  impactAngleDeg: number;
  /** Whether the struck zone is critical (magazine, conning-tower, etc.). */
  isCriticalZone: boolean;
}

// ProtectionResult — computed protection outcome.
export interface ProtectionResult {
  /** Effective resistance after manufacturing + quality + obliquity (µm). */
  effectiveResistanceUm: number;
  /** Penetration margin: penetrationCapabilityUm - effectiveResistanceUm. Positive = penetration. */
  penetrationMargin: number;
  /** The deterministic penetration outcome (one of 7). */
  outcome: PenetrationOutcome;
  /** Thickness after manufacturing discount (µm). */
  manufacturingEffectiveThicknessUm: number;
  /** Thickness after quality multiplier adjustment (µm). */
  qualityAdjustedThicknessUm: number;
  /** Obliquity factor in basis points [0, 10_000]. */
  obliquityFactorBp: number;
}

// Penetration capability formula (simplified — §armor_v1 preliminary)
//
// The penetration capability is derived from projectile parameters using a
// simple deterministic formula. This will be replaced by a more sophisticated
// naval penetration model in a later ticket.
//
// Formula: penetrationCapabilityUm = floor(projectileCaliberUm *
//   (projectileVelocityMs / 1000))
//
// This gives a linear scaling: a 12-inch (304_800µm) shell at 800 m/s
// → 243_840µm (~9.6 in) penetration baseline.
function computePenetrationCapabilityUm(
  caliberUm: number,
  velocityMs: number,
  _mass: number,
): number {
  return Math.floor((caliberUm * velocityMs) / 1000);
}

// Public API

/**
 * Resolve the protection interaction: determine the armor's effective resistance
 * and the penetration outcome for a given projectile striking a given armor zone.
 *
 * Calls the armor model functions from INC-2:
 *   - validateArmorThickness
 *   - manufacturingEffectiveThickness (§19)
 *   - qualityAdjustedThickness (§20)
 *   - obliquityFactorBp (§21)
 *   - determinePenetrationOutcome (§24)
 *
 * @param input - The protection interaction parameters.
 * @returns The resolved protection result with effective resistance, margin, and outcome.
 */
export function resolveProtectionInteraction(input: ProtectionInput): ProtectionResult {
  // 1. Validate armor thickness against zone maximum
  validateArmorThickness(input.hitZoneType, input.armorThicknessUm);

  // 2. Manufacturing effective thickness (§19)
  const manufEffectiveUm = manufacturingEffectiveThickness(input.armorThicknessUm);

  // 3. Quality multiplier lookup (§20)
  const qualityMultiplierBp = lookupArmorQualityMultiplierBp(input.armorQualityFamily);

  // 4. Quality-adjusted thickness (§20)
  const qualityAdjustedUm = qualityAdjustedThickness(manufEffectiveUm, qualityMultiplierBp);

  // 5. Obliquity factor (§21)
  const obliquityBp = obliquityFactorBp(input.impactAngleDeg, input.armorSlopeDeg);

  // 6. Effective resistance = quality-adjusted thickness × obliquity / 10_000
  const effectiveResistanceUm = Math.floor((qualityAdjustedUm * obliquityBp) / 10_000);

  // 7. Compute the shell's penetration capability from projectile parameters
  //    (simplified formula — see armor_v1 preliminary section above).
  const penetrationCapabilityUm = computePenetrationCapabilityUm(
    input.projectileCaliberUm,
    input.projectileVelocityMs,
    input.projectileMass,
  );

  // 8. Penetration margin (positive = the shell penetrates)
  const penetrationMargin = penetrationCapabilityUm - effectiveResistanceUm;

  // 9. Determine penetration outcome (§24)
  const outcome = determinePenetrationOutcome(
    penetrationCapabilityUm,
    effectiveResistanceUm,
    input.impactAngleDeg,
    input.isCriticalZone,
  );

  return {
    effectiveResistanceUm,
    penetrationMargin,
    outcome,
    manufacturingEffectiveThicknessUm: manufEffectiveUm,
    qualityAdjustedThicknessUm: qualityAdjustedUm,
    obliquityFactorBp: obliquityBp,
  };
}
