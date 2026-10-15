/**
 * The compiled torpedo contract (ship-part-model ticket 13a, SPM-R17).
 *
 * This is the immutable, unit-explicit snapshot of one torpedo model at one revision. `@bluewave/
 * ship-design` produces it from a strictly decoded torpedo part at design-compile time; `@bluewave/
 * combat` will consume it (ticket 13b) so it reads torpedo performance without depending on
 * ship-design and without re-reading the per-model combat constants.
 *
 * It carries no launch, hit, interception, reliability-roll, damage or flooding algorithm: only the
 * grounded inputs those algorithms read. It lives in the neutral armament package so ship-design and
 * combat consume one contract, never two drifting copies (ADR-0093).
 *
 * Fields the content vocabulary closes (warhead, propulsion, guidance, mount types, hazard policy)
 * are plain strings here, exactly as `CompiledArmamentMount.mountType` is: the content schema is the
 * closed-vocabulary authority, and this contract preserves the value verbatim.
 */

/** Compatibility version of the compiled torpedo contract. */
export const COMPILED_TORPEDO_VERSION = "compiled_torpedo_v1" as const;

/** One ordered speed/range setting: the run the torpedo makes at one speed. */
export interface CompiledTorpedoSpeedSetting {
  /** The authored setting id combat selects by (the combat model's `settingId`). */
  readonly settingId: string;
  /** Speed in thousandths of a knot (the combat model's `speedKnotsBp`). */
  readonly speedMilliKnots: number;
  /** Maximum run at this setting, metres. */
  readonly rangeM: number;
}

/**
 * The compiled identity and performance of one torpedo model. Every value is grounded in the
 * authoritative torpedo part; values the content does not carry are omitted, never guessed.
 */
export interface CompiledTorpedo {
  /** The torpedo part this compiled record came from (the combat model id it replaces). */
  readonly partId: string;
  /** The effective revision: the applied revision's `from` (`YYYY-MM`) or `"base"`. */
  readonly revision: string;
  readonly diameterUm: number;
  readonly massKg: number;
  readonly warheadType: string;
  readonly warheadExplosiveMassKg: number;
  readonly warheadExplosiveEquivalentMassKg: number;
  readonly propulsionType: string;
  readonly speedSettings: readonly CompiledTorpedoSpeedSetting[];
  readonly minimumArmingDistanceM: number;
  /** Reliability per 100,000, the combat model's scale. */
  readonly reliabilityBp: number;
  readonly guidanceCapability: string;
  /** The DESIGN-40 §2 mount types the torpedo may be launched from. */
  readonly launchTypes: readonly string[];
  /** Technology prerequisites the platform must satisfy before install (DESIGN-40 §4). */
  readonly technologyPrerequisiteIds: readonly string[];
  readonly tubeHitHazardPolicy: string;
  /** Present exactly for an `OXYGEN` torpedo (the per-model wake-visibility modifier, bp). */
  readonly oxygenWakeVisibilityModifierBp?: number;
}
