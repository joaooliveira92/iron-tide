import { groupedInteger } from "./numberText.js";
import { explanationKey, quantity, type ExplanationText } from "./explanation.js";
import type { CompiledDesign, DesignDraft, ShipContext } from "./compile.js";
import { compileDesign } from "./compile.js";
import { previewEdit, type DraftEdit } from "./edits.js";
import type { Severity } from "./findings.js";
import { bp, mm } from "./units.js";

export interface SuggestedFix {
  readonly edit: DraftEdit;
  /** Plain-language description of the change, e.g. "Reduce coal bunkers to 120 t". */
  readonly description: ExplanationText;
  readonly resolved: readonly string[];
  readonly introduced: readonly string[];
  readonly countsBefore: Readonly<Record<Severity, number>>;
  readonly countsAfter: Readonly<Record<Severity, number>>;
  readonly totalKgDelta: number;
}

const pct = (v: number, p: number) => Math.max(1, Math.floor((v * (100 + p)) / 100));
const t = (v: number) => `${groupedInteger(Math.round(v / 1000))} t`;
const metres = (v: number) => quantity(v, 1000, 2, "metres");

/** The fixed neighbourhood of simple, explainable edits. Pure function of the draft and context: no randomness. */
export function candidateEdits(
  d: DesignDraft,
  ctx: ShipContext,
): { edit: DraftEdit; description: ExplanationText }[] {
  const out: { edit: DraftEdit; description: ExplanationText }[] = [];
  const form = ctx.hullForms[d.hull.hullFormId]!.form;
  const mach = d.machinery;
  for (const p of [-85, -70, -50, -30, -20, -10, 10]) {
    out.push({
      edit: { kind: "set_machinery", patch: { fuelCapacityKg: pct(mach.fuelCapacityKg, p) } },
      description: `${p < 0 ? "Reduce" : "Increase"} coal bunkers to ${t(pct(mach.fuelCapacityKg, p))}`,
    });
  }
  for (const p of [-40, -20, -10, 10]) {
    out.push({
      edit: { kind: "set_machinery", patch: { installedKw: pct(mach.installedKw, p) } },
      description: `${p < 0 ? "Reduce" : "Increase"} installed power to ${groupedInteger(pct(mach.installedKw, p))} kW`,
    });
  }
  out.push({
    edit: { kind: "set_hull", patch: { draught: mm(pct(d.hull.draught, 5)) } },
    description: [
      "Raise design draught to ",
      metres(pct(d.hull.draught, 5)),
      " (more buoyancy, less freeboard)",
    ],
  });
  out.push({
    edit: { kind: "set_hull", patch: { draught: mm(pct(d.hull.draught, -5)) } },
    description: ["Reduce design draught to ", metres(pct(d.hull.draught, -5))],
  });
  const len = Math.min(form.lengthMaxMm, pct(d.hull.lengthWl, 5));
  if (len !== d.hull.lengthWl)
    out.push({
      edit: { kind: "set_hull", patch: { lengthWl: mm(len) } },
      description: ["Lengthen the hull to ", metres(len)],
    });
  out.push({
    edit: { kind: "set_hull", patch: { beam: mm(pct(d.hull.beam, 5)) } },
    description: ["Widen the beam to ", metres(pct(d.hull.beam, 5))],
  });
  out.push({
    edit: {
      kind: "set_hull",
      patch: { designMarginBp: bp(Math.max(0, d.hull.designMarginBp - 100)) },
    },
    description: "Reduce the design margin by 1 point",
  });
  for (const r of d.armour.regions) {
    out.push({
      edit: { kind: "set_armour_region", region: { ...r, thicknessUm: pct(r.thicknessUm, 20) } },
      description: `Thicken ${r.region.replaceAll("_", " ").toLowerCase()} to ${Math.round(pct(r.thicknessUm, 20) / 1000)} mm`,
    });
    out.push({
      edit: { kind: "set_armour_region", region: { ...r, thicknessUm: pct(r.thicknessUm, -20) } },
      description: `Thin ${r.region.replaceAll("_", " ").toLowerCase()} to ${Math.round(pct(r.thicknessUm, -20) / 1000)} mm`,
    });
  }
  for (const p of d.placements) {
    const def = ctx.catalogue.find((c) => c.id === p.componentId);
    out.push({
      edit: { kind: "remove_placement", instanceId: p.instanceId },
      description: `Remove ${def?.displayName ?? p.componentId} (${p.instanceId})`,
    });
    for (const [name, r] of Object.entries(def?.parameters ?? {})) {
      const cur = p.params?.[name] ?? r.min;
      if (cur - r.step >= r.min)
        out.push({
          edit: { kind: "set_param", instanceId: p.instanceId, param: name, value: cur - r.step },
          description: `Reduce ${name} of ${p.instanceId} to ${cur - r.step}`,
        });
    }
  }
  return out;
}

const WEIGHTS: Severity[] = ["BLOCKING", "CRITICAL", "WARNING"];

/**
 * Previews every candidate edit by recompiling and returns the best few that strictly reduce serious findings
 * without introducing a new blocking one. Best = most blocking resolved, then critical, then warnings, then least weight change.
 */
export function suggestFixes(
  draft: DesignDraft,
  ctx: ShipContext,
  limit = 5,
  before?: CompiledDesign,
): SuggestedFix[] {
  const base = before ?? compileDesign(draft, ctx);
  if (!WEIGHTS.some((s) => base.findings.some((f) => f.severity === s))) return [];
  const results: (SuggestedFix & { score: number[] })[] = [];
  const seen = new Set<string>();
  for (const { edit, description } of candidateEdits(draft, ctx)) {
    const descriptionKey = explanationKey(description);
    if (seen.has(descriptionKey)) continue;
    seen.add(descriptionKey);
    let p;
    try {
      p = previewEdit(draft, ctx, edit, base);
    } catch {
      continue;
    }
    const newBlocker = p.introduced.some((x) => x.startsWith("BLOCKING:"));
    if (newBlocker) continue;
    const delta = WEIGHTS.map((s) => p.countsBefore[s] - p.countsAfter[s]);
    // Strict improvement: first non-zero delta in severity order must be positive.
    const first = delta.find((v) => v !== 0);
    if (first === undefined || first < 0) continue;
    results.push({
      edit,
      description,
      resolved: p.resolved,
      introduced: p.introduced,
      countsBefore: p.countsBefore,
      countsAfter: p.countsAfter,
      totalKgDelta: p.totalKgDelta,
      score: [...delta, -Math.abs(p.totalKgDelta)],
    });
  }
  results.sort((a, b) => {
    for (let i = 0; i < a.score.length; i++)
      if (a.score[i] !== b.score[i]) return b.score[i]! - a.score[i]!;
    const aKey = explanationKey(a.description);
    const bKey = explanationKey(b.description);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
  return results.slice(0, limit).map(({ score: _score, ...fix }) => fix);
}
