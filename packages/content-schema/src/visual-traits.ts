import { Schema } from "effect";
import { UM_PER_INCH } from "@bluewave/contracts";

export const VISUAL_TRAIT_RULESET = "visual-traits/1";

export const VISUAL_TRAITS = [
  "presentation_form",
  "enclosure",
  "barrel_arrangement",
  "deck_relationship",
  "orientation",
  "size_class",
  "elevation_style",
] as const;
export type VisualTrait = (typeof VISUAL_TRAITS)[number];

export const VISUAL_TRAIT_OWNERSHIP = {
  presentation_form: "derived_with_override",
  enclosure: "derived_with_override",
  barrel_arrangement: "derived_with_override",
  deck_relationship: "derived_with_override",
  orientation: "compiler_derived",
  size_class: "compiler_derived",
  elevation_style: "compiler_derived",
} as const satisfies Readonly<Record<VisualTrait, "derived_with_override" | "compiler_derived">>;

export type VisualTraitOwnership = (typeof VISUAL_TRAIT_OWNERSHIP)[VisualTrait];

export const OVERRIDABLE_TRAITS = [
  "presentation_form",
  "enclosure",
  "barrel_arrangement",
  "deck_relationship",
] as const;
export type OverridableTrait = (typeof OVERRIDABLE_TRAITS)[number];

export const COMPILER_DERIVED_TRAITS = ["orientation", "size_class", "elevation_style"] as const;

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

export const BARREL_ARRANGEMENTS = ["single", "side_by_side", "grouped"] as const;
export type BarrelArrangement = (typeof BARREL_ARRANGEMENTS)[number];

export const DECK_RELATIONSHIPS = ["on_deck", "in_hull_side", "below_waterline"] as const;
export type DeckRelationship = (typeof DECK_RELATIONSHIPS)[number];

export const ORIENTATIONS = ["forward", "aft", "port_beam", "starboard_beam"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const SIZE_CLASSES = ["small", "medium", "large"] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

export const ELEVATION_STYLES = ["main_deck", "superstructure_deck"] as const;
export type ElevationStyle = (typeof ELEVATION_STYLES)[number];

export const VISUAL_TRAIT_VALUES: Readonly<Record<VisualTrait, readonly string[]>> = {
  presentation_form: PRESENTATION_FORMS,
  enclosure: ENCLOSURES,
  barrel_arrangement: BARREL_ARRANGEMENTS,
  deck_relationship: DECK_RELATIONSHIPS,
  orientation: ORIENTATIONS,
  size_class: SIZE_CLASSES,
  elevation_style: ELEVATION_STYLES,
};

export const VisualTraitOverrideSchema = <const V extends readonly string[]>(values: V) =>
  Schema.Struct({ value: Schema.Literals(values), reason: Schema.NonEmptyString });

export const PartVisualOverridesSchema = Schema.Struct({
  presentation_form: Schema.optional(VisualTraitOverrideSchema(PRESENTATION_FORMS)),
  enclosure: Schema.optional(VisualTraitOverrideSchema(ENCLOSURES)),
  barrel_arrangement: Schema.optional(VisualTraitOverrideSchema(BARREL_ARRANGEMENTS)),
  deck_relationship: Schema.optional(VisualTraitOverrideSchema(DECK_RELATIONSHIPS)),
}).annotate({ description: "Authored `visual-traits/1` overrides, each with a reason (D16)" });

export type PartVisualOverrides = typeof PartVisualOverridesSchema.Type;

export interface VisualTraitSource {
  readonly family: string;
  readonly provides: string;
  readonly mountType?: string | undefined;
  readonly launchType?: string | undefined;
  readonly gunsPerMount?: number | undefined;
  readonly calibreUm?: number | undefined;
  readonly stationPermille?: number | undefined;
  readonly side?: "CENTRE" | "PORT" | "STBD" | undefined;
  readonly zoneId?: string | undefined;
}

export interface VisualTraitValues {
  readonly presentation_form?: PresentationForm | undefined;
  readonly enclosure?: Enclosure | undefined;
  readonly barrel_arrangement?: BarrelArrangement | undefined;
  readonly deck_relationship?: DeckRelationship | undefined;
  readonly orientation?: Orientation | undefined;
  readonly size_class?: SizeClass | undefined;
  readonly elevation_style?: ElevationStyle | undefined;
}

export function wholeInchesOf(calibreUm: number): number {
  return Math.floor((calibreUm + UM_PER_INCH / 2) / UM_PER_INCH);
}

export function sizeClassOf(calibreUm: number): SizeClass {
  const inches = wholeInchesOf(calibreUm);
  if (inches <= 5) return "small";
  if (inches <= 11) return "medium";
  return "large";
}

export function defaultPresentationForm(source: VisualTraitSource): PresentationForm | undefined {
  if (source.family === "gun_mount" || source.provides === "gun_mount") {
    switch (source.mountType) {
      case "TURRET":
        return "rotating_gunhouse";
      case "BARBETTE":
        return "barbette";
      case "CASEMATE":
        return "casemate";
      case "BROADSIDE_BATTERY":
        return "battery_port";
      case "DECK_SHIELDED":
      case "DECK_OPEN":
        return "pedestal";
      default:
        return undefined;
    }
  }
  if (source.family === "torpedo_launcher" || source.provides === "torpedo_launcher") {
    return "tube_carriage";
  }
  if (source.provides === "funnel" || source.family === "funnel") return "funnel_stack";
  return undefined;
}

function defaultEnclosure(
  source: VisualTraitSource,
  form: PresentationForm | undefined,
): Enclosure | undefined {
  switch (form) {
    case "rotating_gunhouse":
    case "casemate":
    case "battery_port":
      return "enclosed";
    case "barbette":
      return "open";
    case "pedestal":
      return source.mountType === "DECK_SHIELDED" ? "shielded" : "open";
    case "tube_carriage":
      return "open";
    default:
      return undefined;
  }
}

function defaultBarrelArrangement(
  form: PresentationForm | undefined,
  gunsPerMount: number | undefined,
): BarrelArrangement | undefined {
  if (form === "tube_carriage" || form === "funnel_stack" || form === undefined) return undefined;
  const guns = gunsPerMount ?? 1;
  if (guns <= 1) return "single";
  if (form === "casemate" || form === "battery_port") return "grouped";
  return "side_by_side";
}

const UNDERWATER_LAUNCH_TYPES: ReadonlySet<string> = new Set([
  "UNDERWATER_FIXED",
  "UNDERWATER_TRAINABLE",
  "SUBMARINE_INTERNAL",
]);

function defaultDeckRelationship(
  source: VisualTraitSource,
  form: PresentationForm | undefined,
): DeckRelationship | undefined {
  if (form === "casemate" || form === "battery_port") return "in_hull_side";
  if (form === "tube_carriage" && UNDERWATER_LAUNCH_TYPES.has(source.launchType ?? "")) {
    return "below_waterline";
  }
  return form === undefined ? undefined : "on_deck";
}

function defaultOrientation(
  source: VisualTraitSource,
  deck: DeckRelationship | undefined,
): Orientation | undefined {
  if (source.side === "PORT") return "port_beam";
  if (source.side === "STBD") return "starboard_beam";
  if (deck === "in_hull_side") return "forward";
  return (source.stationPermille ?? 0) < 500 ? "forward" : "aft";
}

function defaultElevationStyle(
  source: VisualTraitSource,
  deck: DeckRelationship | undefined,
): ElevationStyle | undefined {
  if (deck === undefined || deck !== "on_deck") return undefined;
  return source.zoneId === "SUPERSTRUCTURE" ? "superstructure_deck" : "main_deck";
}

export function deriveVisualTraits(source: VisualTraitSource): VisualTraitValues {
  const presentation_form = defaultPresentationForm(source);
  const enclosure = defaultEnclosure(source, presentation_form);
  const barrel_arrangement = defaultBarrelArrangement(presentation_form, source.gunsPerMount);
  const deck_relationship = defaultDeckRelationship(source, presentation_form);
  const orientation = defaultOrientation(source, deck_relationship);
  const size_class =
    source.calibreUm !== undefined && source.calibreUm > 0
      ? sizeClassOf(source.calibreUm)
      : undefined;
  const elevation_style = defaultElevationStyle(source, deck_relationship);
  return {
    ...(presentation_form !== undefined ? { presentation_form } : {}),
    ...(enclosure !== undefined ? { enclosure } : {}),
    ...(barrel_arrangement !== undefined ? { barrel_arrangement } : {}),
    ...(deck_relationship !== undefined ? { deck_relationship } : {}),
    ...(orientation !== undefined ? { orientation } : {}),
    ...(size_class !== undefined ? { size_class } : {}),
    ...(elevation_style !== undefined ? { elevation_style } : {}),
  };
}

export function effectiveVisualTraits(
  source: VisualTraitSource,
  overrides: PartVisualOverrides | undefined,
): VisualTraitValues {
  const traits: VisualTraitValues = { ...deriveVisualTraits(source) };
  if (overrides === undefined) return traits;
  return {
    ...traits,
    ...(overrides.presentation_form !== undefined
      ? { presentation_form: overrides.presentation_form.value }
      : {}),
    ...(overrides.enclosure !== undefined ? { enclosure: overrides.enclosure.value } : {}),
    ...(overrides.barrel_arrangement !== undefined
      ? { barrel_arrangement: overrides.barrel_arrangement.value }
      : {}),
    ...(overrides.deck_relationship !== undefined
      ? { deck_relationship: overrides.deck_relationship.value }
      : {}),
  };
}

export interface VisualTraitViolation {
  readonly rule: "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9";
  readonly message: string;
}

export function visualTraitViolations(
  traits: VisualTraitValues,
  source: VisualTraitSource,
): readonly VisualTraitViolation[] {
  const out: VisualTraitViolation[] = [];
  const form = traits.presentation_form;
  const enclosure = traits.enclosure;
  const arrangement = traits.barrel_arrangement;
  const deck = traits.deck_relationship;
  const guns = source.gunsPerMount ?? 1;
  const add = (rule: VisualTraitViolation["rule"], message: string) => out.push({ rule, message });

  if (form === "rotating_gunhouse" && enclosure !== "enclosed" && enclosure !== "hooded") {
    add("V1", "a rotating gunhouse requires an enclosed or hooded enclosure");
  }
  if (form === "pedestal" && enclosure !== "shielded" && enclosure !== "open") {
    add("V2", "a pedestal requires a shielded or open enclosure");
  }
  if (
    (form === "casemate" || form === "battery_port") &&
    (deck !== "in_hull_side" || enclosure !== "enclosed")
  ) {
    add("V3", "a casemate or battery port requires in_hull_side and an enclosed form");
  }
  if (deck === "in_hull_side" && form !== "casemate" && form !== "battery_port") {
    add("V4", "in_hull_side requires a casemate or battery port");
  }
  if (deck === "below_waterline" && form !== "tube_carriage") {
    add("V5", "below_waterline requires a tube carriage");
  }
  if (
    (form === "rotating_gunhouse" ||
      form === "barbette" ||
      form === "pedestal" ||
      form === "funnel_stack") &&
    deck !== "on_deck"
  ) {
    add("V6", "a rotating gunhouse, barbette, pedestal or funnel stack requires on_deck");
  }
  if (arrangement === "single" && guns !== 1) {
    add("V7", "a single barrel arrangement requires gunsPerMount = 1");
  }
  if ((arrangement === "side_by_side" || arrangement === "grouped") && guns < 2) {
    add("V7", "a side-by-side or grouped arrangement requires gunsPerMount ≥ 2");
  }
  if (arrangement === "grouped" && form !== "casemate" && form !== "battery_port") {
    add("V7", "a grouped arrangement requires a casemate or battery port");
  }
  if ((form === "tube_carriage" || form === "funnel_stack") && arrangement !== undefined) {
    add("V8", "barrel arrangement is forbidden on a tube carriage or funnel stack");
  }
  if (form === "funnel_stack" && enclosure !== undefined) {
    add("V9", "enclosure is forbidden on a funnel stack");
  }
  return out;
}

export interface VisualTraitPartLike {
  readonly family: string;
  readonly provides: string;
  readonly spec?: unknown;
  readonly visual?: { readonly traits?: PartVisualOverrides | undefined } | undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function visualTraitSourceOfPart(part: VisualTraitPartLike): VisualTraitSource {
  const spec =
    part.spec !== null && typeof part.spec === "object"
      ? (part.spec as Record<string, unknown>)
      : {};
  return {
    family: part.family,
    provides: part.provides,
    mountType: optionalString(spec["mountType"]),
    launchType: optionalString(spec["launchType"]),
    gunsPerMount: optionalNumber(spec["gunsPerMount"]),
    calibreUm: optionalNumber(spec["calibreUm"]),
  };
}

export function partVisualTraitViolations(
  part: VisualTraitPartLike,
): readonly VisualTraitViolation[] {
  const source = visualTraitSourceOfPart(part);
  return visualTraitViolations(effectiveVisualTraits(source, part.visual?.traits), source);
}
