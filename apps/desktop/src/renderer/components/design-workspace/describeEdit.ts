import type { DraftEdit } from "@bluewave/ship-design";

const show = (v: unknown): string =>
  typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);

const words = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();

/** One-line, player-readable description of an edit for the history list. `nameOf` resolves a component id. */
export function describeEdit(e: DraftEdit, nameOf: (componentId: string) => string): string {
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
        : `Tertiary battery: ${e.tertiary.count} × ${Math.round(e.tertiary.caliberUm / 1000)} mm`;
    case "set_side":
      return `Set ${e.instanceId} to ${e.side === "CENTRE" ? "the centreline" : e.side === "PORT" ? "port" : "starboard"}`;
    case "batch":
      return e.edits.length === 1
        ? describeEdit(e.edits[0]!, nameOf)
        : `${e.edits.length} changes: ${describeEdit(e.edits[0]!, nameOf)}, ...`;
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
      return `Armour: set ${words(r.region)} (${(r.thicknessUm / 1000).toFixed(0)} mm ${words(r.materialId)}, ${(r.lengthMm / 1000).toFixed(1)} m × ${(r.heightMm / 1000).toFixed(1)} m${slope})`;
    }
    case "set_armour_scheme":
      return `Armour scheme: ${words(e.schemeId)}`;
    case "set_armour_regions":
      return `Armour scheme: ${e.regions.length} region${e.regions.length === 1 ? "" : "s"}`;
    case "remove_armour_region":
      return `Armour: remove ${words(e.region)}`;
  }
}
