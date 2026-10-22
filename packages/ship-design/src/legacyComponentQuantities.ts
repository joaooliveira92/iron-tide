import type { QuantityComponentData } from "@bluewave/content-schema";
import type { ComponentDef } from "./component.js";
import { evaluate } from "./formula/eval.js";
import { freeVariables, parseFormula } from "./formula/parse.js";

export const LEGACY_QUANTITY_FIELDS = [
  "weightKg",
  "costMicro",
  "crew",
  "volumeLitre",
  "deckFootprintMm2",
] as const;
export type LegacyQuantityField = (typeof LEGACY_QUANTITY_FIELDS)[number];

const KIND_OF: Readonly<Record<LegacyQuantityField, QuantityComponentData["kind"]>> = {
  weightKg: "massKg",
  costMicro: "costMicro",
  crew: "crew",
  volumeLitre: "volumeLitre",
  deckFootprintMm2: "deckFootprintMm2",
};

export const QUANTITY_STEM: Readonly<Record<LegacyQuantityField, string>> = {
  weightKg: "mass",
  costMicro: "cost",
  crew: "crew",
  volumeLitre: "volume",
  deckFootprintMm2: "deck_footprint",
};

export type QuantityReadIssueCode =
  | "PART_READ_PATH_FORMULA_ERROR"
  | "PART_READ_PATH_PARAMETER_DEPENDENT_QUANTITY"
  | "PART_READ_PATH_NONLINEAR_QUANTITY"
  | "PART_READ_PATH_INVALID_QUANTITY";

export interface QuantityReadIssue {
  readonly componentId: string;
  readonly field: LegacyQuantityField;
  readonly code: QuantityReadIssueCode;
  readonly message: string;
}

export interface ComponentQuantityRead {
  readonly quantities: readonly QuantityComponentData[];
  readonly issues: readonly QuantityReadIssue[];
}

export interface ComponentQuantityOptions {
  readonly fields: readonly LegacyQuantityField[];
  readonly countParameter: string | null;
  readonly perUnitBasis: "PER_PART_UNIT" | "PER_CONTAINED_UNIT";
  readonly idFor: (field: LegacyQuantityField, term: "perUnit" | "fixed") => string;
}

function countValues(range: { min: number; max: number; step: number }): number[] {
  const out: number[] = [];
  for (let v = range.min; v <= range.max; v += range.step) out.push(v);
  return out;
}

const isQuantityValue = (v: number): boolean => Number.isInteger(v) && v >= 0;

type Terms = { readonly fixed: number; readonly perUnit: number } | QuantityReadIssue;

function readTerms(
  def: ComponentDef,
  field: LegacyQuantityField,
  src: string,
  countParameter: string | null,
): Terms {
  const issue = (code: QuantityReadIssueCode, message: string): QuantityReadIssue => ({
    componentId: def.id,
    field,
    code,
    message: `${def.id}.${field} = "${src}": ${message}`,
  });
  let ast;
  try {
    ast = parseFormula(src);
  } catch (e) {
    return issue("PART_READ_PATH_FORMULA_ERROR", e instanceof Error ? e.message : String(e));
  }
  const foreign = [...freeVariables(ast)]
    .filter((v) => v !== countParameter && def.constants[v] === undefined)
    .sort();
  if (foreign.length > 0) {
    return issue(
      "PART_READ_PATH_PARAMETER_DEPENDENT_QUANTITY",
      `reads ${foreign.join(", ")}, which a fixed quantity value cannot carry.`,
    );
  }
  const at = (count: number | null): number =>
    evaluate(ast, {
      vars: {
        ...def.constants,
        ...(countParameter === null ? {} : { [countParameter]: count ?? 0 }),
      },
    });
  try {
    if (countParameter === null) {
      const value = at(null);
      return isQuantityValue(value)
        ? { fixed: 0, perUnit: value }
        : issue("PART_READ_PATH_INVALID_QUANTITY", `evaluates to ${value}.`);
    }
    const range = def.parameters[countParameter];
    if (range === undefined) {
      return issue(
        "PART_READ_PATH_FORMULA_ERROR",
        `the count parameter '${countParameter}' is not declared.`,
      );
    }
    const counts = countValues(range);
    const samples = counts.map((c) => [c, at(c)] as const);
    const [first, second] = samples;
    if (first === undefined) {
      return issue("PART_READ_PATH_FORMULA_ERROR", `'${countParameter}' has an empty range.`);
    }
    const perUnit =
      second === undefined ? first[1] / first[0] : (second[1] - first[1]) / (second[0] - first[0]);
    const fixed = second === undefined ? 0 : first[1] - perUnit * first[0];
    const bent = samples.find(([c, v]) => v !== fixed + perUnit * c);
    if (bent !== undefined) {
      return issue(
        "PART_READ_PATH_NONLINEAR_QUANTITY",
        `is not ${fixed} + ${perUnit} × ${countParameter} at ${countParameter} = ${bent[0]} (${bent[1]}).`,
      );
    }
    if (!isQuantityValue(perUnit) || !isQuantityValue(fixed)) {
      return issue(
        "PART_READ_PATH_INVALID_QUANTITY",
        `reads as ${fixed} + ${perUnit} × ${countParameter}; both terms must be non-negative integers.`,
      );
    }
    return { fixed, perUnit };
  } catch (e) {
    return issue("PART_READ_PATH_FORMULA_ERROR", e instanceof Error ? e.message : String(e));
  }
}

export function readComponentQuantities(
  def: ComponentDef,
  options: ComponentQuantityOptions,
): ComponentQuantityRead {
  const quantities: QuantityComponentData[] = [];
  const issues: QuantityReadIssue[] = [];
  for (const field of options.fields) {
    const src = def[field];
    if (src === undefined) continue;
    const terms = readTerms(def, field, src, options.countParameter);
    if ("code" in terms) {
      issues.push(terms);
      continue;
    }
    const kind = KIND_OF[field];
    if (terms.fixed !== 0) {
      quantities.push({
        id: options.idFor(field, "fixed"),
        kind,
        value: terms.fixed,
        basis: "PER_LOADOUT_ENTRY",
      });
    }
    quantities.push({
      id: options.idFor(field, "perUnit"),
      kind,
      value: terms.perUnit,
      basis: options.perUnitBasis,
    });
  }
  return { quantities, issues };
}
