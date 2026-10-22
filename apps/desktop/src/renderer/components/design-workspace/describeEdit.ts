import type { DraftEdit } from "@bluewave/ship-design";

import type { PresentationFormat } from "../../lib/presentation-format/index.js";

const show = (v: unknown): string =>
  typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);

const words = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, (_match, lower: string, upper: string) => `${lower} ${upper}`)
    .replaceAll("_", " ")
    .toLowerCase();

export function describeEdit(
  e: DraftEdit,
  nameOf: (componentId: string) => string,
  format: PresentationFormat,
): string {
  switch (e.kind) {
    case "set_hull":
      return `Hull: ${Object.entries(e.patch)
        .map(([k, v]) => `${words(k)} → ${show(v)}`)
        .join(", ")}`;
    case "set_machinery":
      return `Machinery: ${Object.entries(e.patch)
        .map(([k, v]) => `${words(k)} → ${show(v)}`)
        .join(", ")}`;
    case "set_fire_control":
      return `Fire control: ${e.positions} position${e.positions === 1 ? "" : "s"}`;
    case "set_tertiary":
      return e.tertiary === null
        ? "Remove the tertiary battery"
        : `Tertiary battery: ${e.tertiary.count} × ${format.number(e.tertiary.caliberUm / 1000, { maximumFractionDigits: 0 })} mm`;
    case "set_side":
      return `Set ${e.instanceId} to ${e.side === "CENTRE" ? "the centreline" : e.side === "PORT" ? "port" : "starboard"}`;
    case "batch":
      return e.edits.length === 1
        ? describeEdit(e.edits[0]!, nameOf, format)
        : `${e.edits.length} changes: ${describeEdit(e.edits[0]!, nameOf, format)}, ...`;
    case "set_requirement":
      return `Brief: ${Object.entries(e.patch)
        .map(([k, v]) => `${words(k)} → ${show(v)}`)
        .join(", ")}`;
    case "add_placement":
      return `Add ${nameOf(e.placement.componentId)} to ${words(e.placement.zoneId)}`;
    case "remove_placement":
      return `Remove ${e.instanceId}`;
    case "move_placement":
      return `Move ${e.instanceId} to ${words(e.zoneId)} at ${e.stationPermille}‰`;
    case "set_param":
      return `Set ${words(e.param)} of ${e.instanceId} to ${e.value}`;
    case "set_armour_region": {
      const r = e.region;
      const slope = r.cosObliquityBp < 10_000 ? ", inclined" : "";
      return `Armour: set ${words(r.region)} (${format.number(r.thicknessUm / 1000, { maximumFractionDigits: 0 })} mm ${words(r.materialId)}, ${format.number(r.lengthMm / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m × ${format.number(r.heightMm / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m${slope})`;
    }
    case "set_armour_scheme":
      return `Armour scheme: ${words(e.schemeId)}`;
    case "set_armour_regions":
      return `Armour scheme: ${e.regions.length} region${e.regions.length === 1 ? "" : "s"}`;
    case "set_anti_aircraft":
      return e.antiAircraft === null
        ? "Remove the AA fit"
        : `AA fit: ${e.antiAircraft.lightGuns} light, ${e.antiAircraft.mediumGuns} medium, ${e.antiAircraft.directors} directors`;
    case "set_aluminium_superstructure":
      return e.fitted ? "Use an aluminium superstructure" : "Return to a steel superstructure";
    case "set_colonial_service":
      return e.fitted ? "Fit for colonial service" : "Remove the colonial-service fitting";
    case "remove_armour_region":
      return `Armour: remove ${words(e.region)}`;
  }
}
