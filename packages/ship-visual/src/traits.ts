import { type MountClass } from "./vocabulary.js";

export const PRESENTATION_FORMS = [
  "rotating_gunhouse",
  "barbette",
  "casemate",
  "battery_port",
  "pedestal",
  "tube_carriage",
  "funnel_stack",
] as const;
export type PresentationForm = (typeof PRESENTATION_FORMS)[number];

export const ENCLOSURES = ["enclosed", "hooded", "shielded", "open"] as const;
export type Enclosure = (typeof ENCLOSURES)[number];

export function mountClassOfTraits(
  form: string,
  enclosure: string | undefined,
): MountClass | undefined {
  switch (form) {
    case "rotating_gunhouse":
      return "TURRET";
    case "barbette":
      return "BARBETTE";
    case "casemate":
    case "battery_port":
      return "CASEMATE";
    case "pedestal":
      if (enclosure === "shielded") return "SHIELDED";
      if (enclosure === "open") return "OPEN";
      return undefined;
    default:
      return undefined;
  }
}

export function isPresentationForm(value: string): value is PresentationForm {
  return (PRESENTATION_FORMS as readonly string[]).includes(value);
}
