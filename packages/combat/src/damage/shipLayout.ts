//packages/combat/src/damage/shipLayout.ts
// Shared types for compartment layout and armor zone definitions used by
// the hit-location (Stage 1) and protection-interaction (Stage 2) stages.
// All dimensions in integer mm / µm per DESIGN-07.
// No ambient I/O, clock, or randomness — pure data structures.
import { type ArmorQualityFamily, type ArmorZoneType } from "./armorModel.js";

// ---------------------------------------------------------------------------
// CompartmentDef — one watertight / functional compartment on the ship.
// Spatial bounds are integer millimetres. The three axes are:
//   z (vertical):   increasing upward (0 = keel)
//   x (longitudinal): increasing forward (0 = stern or arbitrary reference)
//   altitude:        height above keel (redundant with z but kept for clarity)
//
// A compartment spans [zMinMm, zMaxMm] × [xMinMm, xMaxMm] × [altitudeMinMm, altitudeMaxMm].
// The hit resolves to a compartment when all three impact coordinates
// fall within the inclusive bounds.
export interface CompartmentDef {
  id: string;
  zMinMm: number;
  zMaxMm: number;
  xMinMm: number;
  xMaxMm: number;
  altitudeMinMm: number;
  altitudeMaxMm: number;
}

// ---------------------------------------------------------------------------
// ArmorZoneDef — describes one armor zone (belt, deck, turret face, etc.).
// Each zone is identified by an id and carries the zone type, thickness,
// quality family, and slope. The mapping from compartments to zones is
// established by the caller (zone.id matches compartment.id by convention).
export interface ArmorZoneDef {
  id: string;
  zoneType: ArmorZoneType;
  thicknessUm: number;
  qualityFamily: ArmorQualityFamily;
  slopeDeg: number;
}
