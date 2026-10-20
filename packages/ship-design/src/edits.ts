import {
  compileDesign,
  type CompiledDesign,
  type DesignDraft,
  type MachineryPlan,
  type PlacementSpec,
  type ShipContext,
} from "./compile.js";
import type { ArmourRegion } from "./armour.js";
import type { ArmourSchemeId } from "./armourSchemes.js";
import type { DesignRequirement } from "./compileShared.js";
import type { MountSide } from "./weapons.js";
import type { TertiaryBattery } from "./tertiary.js";
import type { HullSpec } from "./hull.js";
import { SEVERITY_ORDER, type Severity } from "./findings.js";

/** The atomic, undoable edits a player or the AI can make to a draft (spec §17). */
export type DraftEdit =
  | { readonly kind: "set_hull"; readonly patch: Partial<HullSpec> }
  | { readonly kind: "set_machinery"; readonly patch: Partial<MachineryPlan> }
  | { readonly kind: "set_fire_control"; readonly positions: number }
  /** Fit or unfit colonial service (S-5, manual p.42). Unfitting removes the flag, restoring the pre-S-5 draft shape. */
  | { readonly kind: "set_colonial_service"; readonly fitted: boolean }
  /** The tertiary battery: a count of one chosen gun; `null` removes it. */
  | { readonly kind: "set_tertiary"; readonly tertiary: TertiaryBattery | null }
  /** The design brief: ship type, required speed and range, crew and accommodation. A brief is not a build change. */
  | { readonly kind: "set_requirement"; readonly patch: Partial<DesignRequirement> }
  | { readonly kind: "add_placement"; readonly placement: PlacementSpec }
  | { readonly kind: "remove_placement"; readonly instanceId: string }
  | {
      readonly kind: "move_placement";
      readonly instanceId: string;
      readonly zoneId: PlacementSpec["zoneId"];
      readonly stationPermille: number;
    }
  | {
      readonly kind: "set_param";
      readonly instanceId: string;
      readonly param: string;
      readonly value: number;
    }
  | { readonly kind: "set_armour_region"; readonly region: ArmourRegion }
  | { readonly kind: "remove_armour_region"; readonly region: ArmourRegion["region"] }
  /** Which side a mount fires from (centreline, port or starboard); it sets its arc and obstruction. */
  | { readonly kind: "set_side"; readonly instanceId: string; readonly side: MountSide }
  /** Several edits as one undoable step, applied in order; if any fails none is applied. Batches do not nest. */
  | { readonly kind: "batch"; readonly edits: readonly Exclude<DraftEdit, { kind: "batch" }>[] }
  /** Replaces every armour region at once (an armour scheme), as one undoable step. Order is kept. */
  | { readonly kind: "set_armour_regions"; readonly regions: readonly ArmourRegion[] }
  /** Applies a named armour scheme (ADR-0232): the regions it produced and its label, as one undoable step. */
  | {
      readonly kind: "set_armour_scheme";
      readonly schemeId: ArmourSchemeId;
      readonly regions: readonly ArmourRegion[];
    };

export class EditError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "EditError";
  /** `_tag`-based narrowing without `instanceof`. */
  static is(value: unknown): value is EditError {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { readonly _tag?: unknown })._tag === "EditError"
    );
  }
  constructor(message: string) {
    super(message);
    this.name = "EditError";
  }
}

const need = (draft: DesignDraft, id: string): PlacementSpec => {
  const p = draft.placements.find((x) => x.instanceId === id);
  if (!p) throw new EditError(`no placement '${id}'`);
  return p;
};

/** Pure: returns a new draft; the input is never mutated. Throws EditError for edits that reference nothing. */
/** The armour plan with new regions and no scheme label: a manual edit leaves a named scheme for "Custom". */
function customArmour(
  armour: DesignDraft["armour"],
  regions: ArmourRegion[],
): DesignDraft["armour"] {
  const { schemeId: _scheme, ...rest } = armour;
  return { ...rest, regions };
}

export function applyEdit(draft: DesignDraft, e: DraftEdit): DesignDraft {
  switch (e.kind) {
    case "set_hull":
      return { ...draft, hull: { ...draft.hull, ...e.patch } };
    case "set_machinery":
      return { ...draft, machinery: { ...draft.machinery, ...e.patch } };
    case "set_fire_control":
      if (!Number.isSafeInteger(e.positions) || e.positions < 0)
        throw new EditError("fire-control positions must be a non-negative integer");
      return { ...draft, fireControl: { positions: e.positions } };
    case "set_colonial_service": {
      if (typeof e.fitted !== "boolean")
        throw new EditError("colonial service must be fitted or not fitted");
      if (!e.fitted) {
        const { colonialServiceFitted: _removed, ...rest } = draft;
        return rest;
      }
      return { ...draft, colonialServiceFitted: true };
    }
    case "set_tertiary": {
      const t = e.tertiary;
      if (t === null) {
        const { tertiary: _removed, ...rest } = draft;
        return rest;
      }
      if (!Number.isSafeInteger(t.caliberUm) || t.caliberUm <= 0)
        throw new EditError("tertiary calibre must be a positive integer");
      if (!Number.isSafeInteger(t.count) || t.count < 0)
        throw new EditError("tertiary count must be a non-negative integer");
      return { ...draft, tertiary: { caliberUm: t.caliberUm, count: t.count } };
    }
    case "set_requirement":
      return { ...draft, requirement: { ...draft.requirement, ...e.patch } };
    case "add_placement":
      if (draft.placements.some((p) => p.instanceId === e.placement.instanceId))
        throw new EditError(`placement '${e.placement.instanceId}' exists`);
      return { ...draft, placements: [...draft.placements, e.placement] };
    case "remove_placement": {
      need(draft, e.instanceId);
      return {
        ...draft,
        placements: draft.placements.filter(
          (p) => p.instanceId !== e.instanceId && p.magazineRef !== e.instanceId,
        ),
      };
    }
    case "move_placement": {
      need(draft, e.instanceId);
      return {
        ...draft,
        placements: draft.placements.map((p) =>
          p.instanceId === e.instanceId
            ? { ...p, zoneId: e.zoneId, stationPermille: e.stationPermille }
            : p,
        ),
      };
    }
    case "set_param": {
      need(draft, e.instanceId);
      return {
        ...draft,
        placements: draft.placements.map((p) =>
          p.instanceId === e.instanceId ? { ...p, params: { ...p.params, [e.param]: e.value } } : p,
        ),
      };
    }
    case "set_armour_region": {
      const rest = draft.armour.regions.filter((r) => r.region !== e.region.region);
      return { ...draft, armour: customArmour(draft.armour, [...rest, e.region]) };
    }
    case "set_side": {
      need(draft, e.instanceId);
      return {
        ...draft,
        placements: draft.placements.map((p) =>
          p.instanceId === e.instanceId ? { ...p, side: e.side } : p,
        ),
      };
    }
    case "batch": {
      if (e.edits.length === 0) throw new EditError("an empty batch changes nothing");
      return e.edits.reduce<DesignDraft>((d, inner) => applyEdit(d, inner), draft);
    }
    case "set_armour_regions": {
      const seen = new Set<string>();
      for (const r of e.regions) {
        if (seen.has(r.region)) throw new EditError(`armour region '${r.region}' listed twice`);
        seen.add(r.region);
      }
      return { ...draft, armour: customArmour(draft.armour, [...e.regions]) };
    }
    case "set_armour_scheme": {
      const seen = new Set<string>();
      for (const r of e.regions) {
        if (seen.has(r.region)) throw new EditError(`armour region '${r.region}' listed twice`);
        seen.add(r.region);
      }
      return {
        ...draft,
        armour: { ...draft.armour, regions: [...e.regions], schemeId: e.schemeId },
      };
    }
    case "remove_armour_region":
      return {
        ...draft,
        armour: customArmour(
          draft.armour,
          draft.armour.regions.filter((r) => r.region !== e.region),
        ),
      };
  }
}

export interface EditPreview {
  readonly draft: DesignDraft;
  readonly result: CompiledDesign;
  /** Finding ids present before and gone after. */
  readonly resolved: readonly string[];
  /** Finding ids absent before and present after. */
  readonly introduced: readonly string[];
  readonly countsBefore: Readonly<Record<Severity, number>>;
  readonly countsAfter: Readonly<Record<Severity, number>>;
  readonly totalKgDelta: number;
}

const counts = (r: CompiledDesign): Record<Severity, number> => {
  const c = { BLOCKING: 0, CRITICAL: 0, WARNING: 0, ADVISORY: 0 };
  for (const f of r.findings) c[f.severity]++;
  return c;
};

/** What would this edit do? Full recompile in preview mode; nothing is persisted. */
export function previewEdit(
  draft: DesignDraft,
  ctx: ShipContext,
  edit: DraftEdit,
  before?: CompiledDesign,
): EditPreview {
  const base = before ?? compileDesign(draft, ctx);
  const next = applyEdit(draft, edit);
  const result = compileDesign(next, ctx);
  const b = new Set(base.findings.map((f) => `${f.severity}:${f.id}`));
  const a = new Set(result.findings.map((f) => `${f.severity}:${f.id}`));
  const names = (s: Set<string>, not: Set<string>) =>
    [...s].filter((x) => !not.has(x)).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  return {
    draft: next,
    result,
    resolved: names(b, a),
    introduced: names(a, b),
    countsBefore: counts(base),
    countsAfter: counts(result),
    totalKgDelta: result.totalKg - base.totalKg,
  };
}

/** True if the edit strictly improves the worst severity present, or keeps it and reduces the count at that level. */
export function improves(p: EditPreview): boolean {
  for (const s of SEVERITY_ORDER) {
    if (p.countsAfter[s] !== p.countsBefore[s]) return p.countsAfter[s] < p.countsBefore[s];
  }
  return false;
}
