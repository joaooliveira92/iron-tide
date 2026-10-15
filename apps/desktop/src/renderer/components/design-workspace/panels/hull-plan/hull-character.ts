/**
 * Bow/stern character per hull form: a drawing choice, not simulation data. Kept apart from the plan frame so the
 * silhouette conventions can be read (and tested) without the SVG geometry.
 */

/** Bow character, a drawing choice per hull form (not simulation data): ram beak, spoon bow or blunt plumb bow. */
export type BowStyle = "ram" | "spoon" | "plumb";

/** Drawn bow for a hull form id; unrecognised forms get the 1880s default, a ram. */
export function bowStyleFor(hullFormId: string): BowStyle {
  if (hullFormId === "torpedo_boat_form") return "spoon";
  if (hullFormId === "coast_defence_form") return "plumb";
  return "ram";
}

/**
 * Stern character, a drawing choice per hull form (not simulation data): a counter (overhanging, elliptical),
 * a flat transom, or a rounded fantail.
 */
export type SternStyle = "counter" | "transom" | "round";

/** Drawn stern for a hull form id; unrecognised forms get a counter stern. */
export function sternStyleFor(hullFormId: string): SternStyle {
  if (hullFormId === "torpedo_boat_form") return "round";
  if (hullFormId === "coast_defence_form") return "transom";
  return "counter";
}
