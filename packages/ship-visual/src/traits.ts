/**
 * The `visual-traits/1` render adapter (D16, proposal §8.2): the closed trait vocabulary the
 * catalog is queried with, the ADR-0148 translation map from traits to the drawn mount class,
 * and the drawing resolution order — part-specific override → trait match → interface-family
 * fallback → a visibly marked missing-asset glyph.
 *
 * Presentation only (I-14). `visual-traits/1` is defined canonically in `@bluewave/content-schema`
 * (the decode boundary and the visual compile stage read it there); this package mirrors the two
 * value sets it renders, kept in step by `test/trait-parity.test.ts`.
 */

import { type MountClass } from "./vocabulary.js";

/** The drawn presentation forms (mirror of `@bluewave/content-schema` PRESENTATION_FORMS). */
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

/** The enclosures (mirror of `@bluewave/content-schema` ENCLOSURES). */
export const ENCLOSURES = ["enclosed", "hooded", "shielded", "open"] as const;
export type Enclosure = (typeof ENCLOSURES)[number];

/**
 * The ADR-0148 translation map: a (presentation form, enclosure) pair selects the drawn mount
 * class. The casemate family is explicit — both `casemate` and `battery_port` map to `CASEMATE`
 * — so a broadside battery or a central battery never falls to the generic glyph. A form not
 * drawn as a gun mount (`tube_carriage`, `funnel_stack`) or an unrecognised form has no class.
 */
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

/** Whether a value is one of the closed presentation forms. */
export function isPresentationForm(value: string): value is PresentationForm {
  return (PRESENTATION_FORMS as readonly string[]).includes(value);
}
