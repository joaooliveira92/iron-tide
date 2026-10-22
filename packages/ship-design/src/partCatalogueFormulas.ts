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
  readonly fixed: number;
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

export function affineFormula(terms: AffineTerms, countParameter: string | null): string {
  if (countParameter === null || terms.perUnit === 0) {
    return String(terms.fixed + (countParameter === null ? terms.perUnit : 0));
  }
  return terms.fixed === 0
    ? `${terms.perUnit} * ${countParameter}`
    : `${terms.fixed} + ${terms.perUnit} * ${countParameter}`;
}
