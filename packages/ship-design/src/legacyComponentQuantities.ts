/**
 * Legacy `ComponentDef` formulas read as part-model **quantity components** (ship-part-model
 * SPM-R5, SPM-R13, SPM-R19). Shared by every read-path adapter whose part comes from a
 * `components.yaml` entry: fittings and sensors (ticket 05) and the crew, volume and deck
 * footprint of gun mounts and torpedo launchers.
 *
 * A legacy formula is a function of the component's constants and its placement parameters.
 * The part model has no formulas: a quantity is a fixed integer that scales only by its
 * declared basis. So a formula translates only when it is **affine in one declared count
 * parameter** (the gun's `barrels`, the launcher's `tubes`, the quarters' `blocks`) over that
 * parameter's whole declared range:
 *
 * - the count-independent term → `PER_LOADOUT_ENTRY` (charged once per entry, like the gun's
 *   `mount_fixed_kg`);
 * - the per-count term → the caller's per-unit basis (`PER_PART_UNIT`, or `PER_CONTAINED_UNIT`
 *   on a gun mount, §9.2);
 * - with no count parameter the formula is one constant per installed unit → the per-unit basis.
 *
 * The basis comes from the formula's shape and the caller, never from the family or the kind.
 * A formula that reads another parameter, is not affine, or yields a negative or fractional
 * value is a coded issue, never a guess.
 */
import type { QuantityComponentData } from "@bluewave/content-schema";
import type { ComponentDef } from "./component.js";
import { evaluate } from "./formula/eval.js";
import { freeVariables, parseFormula } from "./formula/parse.js";

/** The five legacy formula fields that are part-model quantity kinds, in reading order. */
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

/** The stable stem of a field's quantity ids (`crew`, `deck_footprint`, …). */
export const QUANTITY_STEM: Readonly<Record<LegacyQuantityField, string>> = {
  weightKg: "mass",
  costMicro: "cost",
  crew: "crew",
  volumeLitre: "volume",
  deckFootprintMm2: "deck_footprint",
};

export type QuantityReadIssueCode =
  /** The formula does not parse or does not evaluate. */
  | "PART_READ_PATH_FORMULA_ERROR"
  /** The formula reads a placement parameter other than the count parameter. */
  | "PART_READ_PATH_PARAMETER_DEPENDENT_QUANTITY"
  /** The formula is not affine in the count parameter over its declared range. */
  | "PART_READ_PATH_NONLINEAR_QUANTITY"
  /** A term is negative, fractional or non-finite (a quantity value is a non-negative integer). */
  | "PART_READ_PATH_INVALID_QUANTITY";

/** One formula field that could not be read as quantity components. */
export interface QuantityReadIssue {
  readonly componentId: string;
  readonly field: LegacyQuantityField;
  readonly code: QuantityReadIssueCode;
  readonly message: string;
}

export interface ComponentQuantityRead {
  readonly quantities: readonly QuantityComponentData[];
  /** Codepoint-ordered by field reading order; empty when every field translated. */
  readonly issues: readonly QuantityReadIssue[];
}

export interface ComponentQuantityOptions {
  /** The fields to read (a gun's mass and cost come from its armament records instead). */
  readonly fields: readonly LegacyQuantityField[];
  /** The count parameter the formulas scale by, or `null` for a one-unit component. */
  readonly countParameter: string | null;
  /** The basis of the per-count (or per-unit) term. */
  readonly perUnitBasis: "PER_PART_UNIT" | "PER_CONTAINED_UNIT";
  /** The quantity id of a field's term. */
  readonly idFor: (field: LegacyQuantityField, term: "perUnit" | "fixed") => string;
}

/** The values a count parameter may take, in ascending order. */
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
    // One admissible count cannot separate the fixed term from the per-unit term; read it
    // as per-unit when it divides exactly (the common `n × k` shape), else report it.
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

/**
 * Read a component's quantity formulas as basis-declared components. An absent optional
 * formula (`deckFootprintMm2`) declares nothing. A present one always declares its per-unit
 * term, even when it is zero (the legacy `"0"` of a magazine's mass is authored, not missing);
 * a fixed term is declared only when it is non-zero.
 */
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
