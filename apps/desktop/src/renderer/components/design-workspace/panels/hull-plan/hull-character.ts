export type BowStyle = "ram" | "spoon" | "plumb";

export function bowStyleFor(hullFormId: string): BowStyle {
  if (hullFormId === "torpedo_boat_form") return "spoon";
  if (hullFormId === "coast_defence_form") return "plumb";
  return "ram";
}

export type SternStyle = "counter" | "transom" | "round";

export function sternStyleFor(hullFormId: string): SternStyle {
  if (hullFormId === "torpedo_boat_form") return "round";
  if (hullFormId === "coast_defence_form") return "transom";
  return "counter";
}
