/**
 * Provenance carried by every authored armament value. This is a structural mirror of the canonical
 * national-profile vocabulary (`@bluewave/ship-design`'s `nationProfile.ts`, itself pinned to
 * `@bluewave/content-schema`'s `naval-profile-vocab.ts`). The armament package cannot import either
 * without inverting the dependency direction (ADR-0093), so the vocabulary is duplicated here and a
 * parity test in `@bluewave/ship-design` keeps the three lists identical.
 */

export const ARMAMENT_SOURCE_STATUSES = [
  "VERIFIED",
  "DERIVED",
  "ESTIMATE",
  "BALANCE_TARGET",
  "PLACEHOLDER",
] as const;
export type ArmamentSourceStatus = (typeof ARMAMENT_SOURCE_STATUSES)[number];

export const ARMAMENT_CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type ArmamentConfidence = (typeof ARMAMENT_CONFIDENCE_LEVELS)[number];

export const ARMAMENT_PROVENANCE_KINDS = [
  "historical_fact",
  "game_conversion",
  "balance_adjustment",
] as const;
export type ArmamentProvenanceKind = (typeof ARMAMENT_PROVENANCE_KINDS)[number];

export interface ArmamentSourceReference {
  readonly sourceId?: string;
  readonly title: string;
  readonly author?: string;
  readonly year?: number;
  readonly page?: string;
  readonly section?: string;
  readonly archiveOrUrl?: string;
  readonly accessedAt?: string;
}

export interface ArmamentDerivation {
  readonly sourceValue: string;
  readonly sourceUnit: string;
  readonly conversion: string;
  readonly gameValue: string;
  readonly roundingRule?: string;
  readonly originalValue?: string;
  readonly originalUnit?: string;
  readonly convertedValue?: string;
  readonly convertedUnit?: string;
}

export interface ArmamentProvenance {
  readonly sourceStatus: ArmamentSourceStatus;
  readonly confidence: ArmamentConfidence;
  readonly kind: ArmamentProvenanceKind;
  readonly sources: readonly ArmamentSourceReference[];
  readonly derivation?: ArmamentDerivation;
  readonly note?: string;
}
