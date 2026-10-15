/**
 * Reading one legacy formula as `fixed + perUnit × count` (ship-part-model ticket 11b).
 *
 * The part model carries no formulas, so a legacy formula becomes numbers only when it is
 * affine in the component's one count parameter over that parameter's whole declared range,
 * with non-negative integer terms. This is the same rule `legacyComponentQuantities.ts`
 * applies to the five accounting fields; it is shared here so power, cooling and attribute
 * formulas follow it too. Anything else is a coded issue, never a guess.
 */
import type { ComponentDef, ParameterRange } from "./component.js";
import { evaluate } from "./formula/eval.js";
import { freeVariables, parseFormula } from "./formula/parse.js";

export type AffineIssueCode =
  | "PARTCAT_FORMULA_UNREADABLE"
  | "PARTCAT_FORMULA_PARAMETER_DEPENDENT"
  | "PARTCAT_FORMULA_NONLINEAR"
  | "PARTCAT_FORMULA_INVALID_TERM";

export interface AffineIssue {
  readonly code: AffineIssueCode;
  readonly message: string;
}

export interface AffineTerms {
  /** Charged once per entry (the count-independent term). */
  readonly fixed: number;
  /** Charged per counted unit. With no count parameter, the one constant. */
  readonly perUnit: number;
}

export function isAffineIssue(value: AffineTerms | AffineIssue): value is AffineIssue {
  return "code" in value;
}

const isTerm = (v: number): boolean => Number.isInteger(v) && v >= 0;

function countValues(range: ParameterRange): number[] {
  const out: number[] = [];
  for (let v = range.min; v <= range.max; v += range.step) out.push(v);
  return out;
}

/**
 * Read `src` against `def`'s constants and, when set, its `countParameter`. `label` names the
 * field in the issue text (`weightKg`, `attributes.genKw`).
 */
export function readAffine(
  def: Pick<ComponentDef, "id" | "constants" | "parameters">,
  label: string,
  src: string,
  countParameter: string | null,
): AffineTerms | AffineIssue {
  const issue = (code: AffineIssueCode, message: string): AffineIssue => ({
    code,
    message: `${def.id}.${label} = "${src}": ${message}`,
  });
  let ast;
  try {
    ast = parseFormula(src);
  } catch (e) {
    return issue("PARTCAT_FORMULA_UNREADABLE", e instanceof Error ? e.message : String(e));
  }
  const foreign = [...freeVariables(ast)]
    .filter((v) => v !== countParameter && def.constants[v] === undefined)
    .sort();
  if (foreign.length > 0) {
    return issue(
      "PARTCAT_FORMULA_PARAMETER_DEPENDENT",
      `reads ${foreign.join(", ")}, which a fixed value cannot carry.`,
    );
  }
  const at = (count: number): number =>
    evaluate(ast, {
      vars: { ...def.constants, ...(countParameter === null ? {} : { [countParameter]: count }) },
    });
  try {
    if (countParameter === null) {
      const value = at(0);
      return isTerm(value)
        ? { fixed: 0, perUnit: value }
        : issue("PARTCAT_FORMULA_INVALID_TERM", `evaluates to ${value}.`);
    }
    const range = def.parameters[countParameter];
    if (range === undefined) {
      return issue(
        "PARTCAT_FORMULA_UNREADABLE",
        `the count parameter '${countParameter}' is undeclared.`,
      );
    }
    const samples = countValues(range).map((c) => [c, at(c)] as const);
    const [first, second] = samples;
    if (first === undefined) {
      return issue("PARTCAT_FORMULA_UNREADABLE", `'${countParameter}' has an empty range.`);
    }
    const perUnit =
      second === undefined ? first[1] / first[0] : (second[1] - first[1]) / (second[0] - first[0]);
    const fixed = second === undefined ? 0 : first[1] - perUnit * first[0];
    const bent = samples.find(([c, v]) => v !== fixed + perUnit * c);
    if (bent !== undefined) {
      return issue(
        "PARTCAT_FORMULA_NONLINEAR",
        `is not ${fixed} + ${perUnit} × ${countParameter} at ${countParameter} = ${bent[0]} (${bent[1]}).`,
      );
    }
    if (!isTerm(perUnit) || !isTerm(fixed)) {
      return issue(
        "PARTCAT_FORMULA_INVALID_TERM",
        `reads as ${fixed} + ${perUnit} × ${countParameter}; both terms must be non-negative integers.`,
      );
    }
    return { fixed, perUnit };
  } catch (e) {
    return issue("PARTCAT_FORMULA_UNREADABLE", e instanceof Error ? e.message : String(e));
  }
}

/** The formula text of `fixed + perUnit × countParameter`, with literals only. */
export function affineFormula(terms: AffineTerms, countParameter: string | null): string {
  if (countParameter === null || terms.perUnit === 0) {
    return String(terms.fixed + (countParameter === null ? terms.perUnit : 0));
  }
  return terms.fixed === 0
    ? `${terms.perUnit} * ${countParameter}`
    : `${terms.fixed} + ${terms.perUnit} * ${countParameter}`;
}
