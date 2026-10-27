import { evaluate } from "./formula/eval.js";
import { parseFormula, freeVariables } from "./formula/parse.js";
import { FormulaError } from "./formula/ast.js";
import type { CompiledTorpedo } from "@bluewave/armament";

export const COMPONENT_CATEGORIES = [
  "HULL_FORM",
  "MATERIAL",
  "BOILER",
  "ENGINE",
  "SHAFT_PROPELLER",
  "FUEL_BUNKER",
  "GENERATOR",
  "MAIN_GUN",
  "SECONDARY_GUN",
  "TERTIARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
  "ASW_WEAPON",
  "TORPEDO_TUBE",
  "MINE_GEAR",
  "AIRCRAFT_FACILITY",
  "MISSILE_LAUNCHER",
  "MOUNT",
  "MAGAZINE",
  "AMMUNITION",
  "ARMOUR_SCHEME",
  "UNDERWATER_PROTECTION",
  "DIRECTOR",
  "RANGEFINDER",
  "RADAR",
  "SONAR",
  "COMMS",
  "SPECIAL_EQUIPMENT",
  "DAMAGE_CONTROL",
  "ACCOMMODATION",
] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

export interface ParameterRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface ComponentDef {
  readonly id: string;
  readonly displayName: string;
  readonly category: ComponentCategory;
  readonly introduction: { readonly fromMonth: string; readonly obsoleteMonth: string | null };
  readonly requires: readonly string[];
  readonly parameters: Readonly<Record<string, ParameterRange>>;
  readonly constants: Readonly<Record<string, number>>;
  readonly weightKg: string;
  readonly volumeLitre: string;
  readonly costMicro: string;
  readonly crew: string;
  readonly powerKw: string;
  readonly upgradePath: readonly string[];
  readonly tags: readonly string[];
  readonly deckFootprintMm2?: string;
  readonly heightMm?: string;
  readonly zCgMm?: string;
  readonly coolingKw?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly allowedZones?: readonly string[];
  readonly forbidsCoLocation?: readonly ComponentCategory[];
  readonly critical?: boolean;
  readonly fcClass?: string;
  readonly fcClasses?: readonly string[];
  readonly torpedoMount?: {
    readonly mountType: string;
    readonly torpedoModelId: string;
    readonly compiledTorpedo?: CompiledTorpedo;
  };
  readonly maintenanceMonthlyBp?: number;
  readonly buildWorkMicro?: string;
  readonly productionLine?: string;
}

export interface LintIssue {
  readonly componentId: string;
  readonly code: string;
  readonly message: string;
}

const ID_RE = /^[a-z][a-z0-9_]*$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const FORMULA_FIELDS = ["weightKg", "volumeLitre", "costMicro", "crew", "powerKw"] as const;
const OPTIONAL_FORMULA_FIELDS = [
  "deckFootprintMm2",
  "heightMm",
  "zCgMm",
  "coolingKw",
  "buildWorkMicro",
] as const;
const NON_NEGATIVE = new Set<string>([...FORMULA_FIELDS, ...OPTIONAL_FORMULA_FIELDS]);

function* samples(
  params: Readonly<Record<string, ParameterRange>>,
): Generator<Record<string, number>> {
  const names = Object.keys(params).sort();
  const choices = names.map((n) => {
    const r = params[n]!;
    return [...new Set([r.min, r.min + Math.floor((r.max - r.min) / 2 / r.step) * r.step, r.max])];
  });
  const idx = names.map(() => 0);
  for (let n = 0; n < 243; n++) {
    yield Object.fromEntries(names.map((nm, i) => [nm, choices[i]![idx[i]!]!]));
    let i = 0;
    while (i < idx.length && ++idx[i]! === choices[i]!.length) idx[i++] = 0;
    if (i === idx.length) return;
  }
}

export function lintCatalogue(
  defs: readonly ComponentDef[],
  knownTechIds: ReadonlySet<string>,
): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (componentId: string, code: string, message: string) =>
    issues.push({ componentId, code, message });
  const ids = new Set<string>();
  for (const d of defs) {
    if (ids.has(d.id)) add(d.id, "DUPLICATE_ID", "component id is not unique");
    ids.add(d.id);
  }
  for (const d of [...defs].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!ID_RE.test(d.id)) add(d.id, "BAD_ID", "id must be lower snake_case");
    if (!COMPONENT_CATEGORIES.includes(d.category)) add(d.id, "UNKNOWN_CATEGORY", d.category);
    if (!MONTH_RE.test(d.introduction.fromMonth))
      add(d.id, "BAD_MONTH", "introduction.fromMonth must be YYYY-MM");
    for (const t of d.requires)
      if (!knownTechIds.has(t)) add(d.id, "UNKNOWN_TECH", `requires unknown tech '${t}'`);
    for (const u of d.upgradePath)
      if (!ids.has(u)) add(d.id, "UNKNOWN_UPGRADE", `upgradePath references '${u}'`);
    for (const [n, r] of Object.entries(d.parameters)) {
      if (r.step < 1 || r.min > r.max)
        add(d.id, "BAD_PARAMETER", `parameter '${n}' has invalid range`);
    }
    const paramNames = new Set(Object.keys(d.parameters));
    const constNames = new Set(Object.keys(d.constants));
    const formulas: [string, string][] = [
      ...FORMULA_FIELDS.map((f): [string, string] => [f, d[f]]),
      ...OPTIONAL_FORMULA_FIELDS.filter((f) => d[f] !== undefined).map((f): [string, string] => [
        f,
        d[f]!,
      ]),
      ...Object.entries(d.attributes ?? {})
        .sort((x, y) => (x[0] < y[0] ? -1 : 1))
        .map(([k, v]): [string, string] => [`attributes.${k}`, v]),
    ];
    for (const [f, src] of formulas) {
      let ast;
      try {
        ast = parseFormula(src);
      } catch (e) {
        add(d.id, "BAD_FORMULA", `${f}: ${(e as Error).message}`);
        continue;
      }
      let unknownVar = false;
      for (const v of freeVariables(ast)) {
        if (!paramNames.has(v) && !constNames.has(v)) {
          add(d.id, "UNKNOWN_VARIABLE", `${f} uses undefined '${v}'`);
          unknownVar = true;
        }
      }
      if (unknownVar) continue;
      for (const s of samples(d.parameters)) {
        try {
          const v = evaluate(ast, { vars: { ...d.constants, ...s } });
          if ((NON_NEGATIVE.has(f) || f.startsWith("attributes.")) && v < 0) {
            add(d.id, "NEGATIVE_VALUE", `${f} = ${v} for ${JSON.stringify(s)}`);
            break;
          }
        } catch (e) {
          add(d.id, "FORMULA_EVAL", `${f}: ${FormulaError.is(e) ? e.message : String(e)}`);
          break;
        }
      }
    }
  }
  const byId = new Map(defs.map((d) => [d.id, d]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, stack: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      add(id, "UPGRADE_CYCLE", `cycle: ${[...stack, id].join(" -> ")}`);
      return;
    }
    state.set(id, 1);
    for (const n of byId.get(id)?.upgradePath ?? []) if (byId.has(n)) visit(n, [...stack, id]);
    state.set(id, 2);
  };
  for (const id of [...byId.keys()].sort()) visit(id, []);
  return issues;
}
