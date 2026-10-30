import type { ShipComponentData } from "@bluewave/content-schema";

import {
  expressionReferences,
  number,
  renderExpression,
  terms,
  type InputValues,
  type Term,
  type Terms,
} from "./expression.js";
import { provenance, type Provenance } from "./provenance.js";

export const REQUIRED_FORMULA_FIELDS = [
  "weightKg",
  "volumeLitre",
  "costMicro",
  "crew",
  "powerKw",
] as const;

export const OPTIONAL_FORMULA_FIELDS = [
  "deckFootprintMm2",
  "heightMm",
  "zCgMm",
  "coolingKw",
  "buildWorkMicro",
] as const;

export type RequiredFormulaField = (typeof REQUIRED_FORMULA_FIELDS)[number];
export type OptionalFormulaField = (typeof OPTIONAL_FORMULA_FIELDS)[number];
export type FormulaField = RequiredFormulaField | OptionalFormulaField;

export type ParameterRange = { readonly min: number; readonly max: number; readonly step: number };

export const FORMULA_FIELDS: readonly FormulaField[] = [
  ...REQUIRED_FORMULA_FIELDS,
  ...OPTIONAL_FORMULA_FIELDS,
];

export class ComponentDefinitionError extends Error {
  readonly _tag = "ComponentDefinitionError";
  constructor(message: string) {
    super(message);
    this.name = "ComponentDefinitionError";
  }
}

type VariableTerms<
  C extends InputValues,
  P extends Readonly<Record<string, ParameterRange>>,
> = Terms<C> & Terms<{ readonly [K in keyof P]: unknown }>;

const CONSTRUCTED_KEYS = new Set([
  "id",
  "displayName",
  "category",
  "introduction",
  "constants",
  "parameters",
  "formulas",
  "attributes",
  "fieldProvenance",
  ...FORMULA_FIELDS,
]);

export type ShipComponentPassthrough = Partial<
  Omit<
    ShipComponentData,
    | "id"
    | "displayName"
    | "category"
    | "introduction"
    | "constants"
    | "parameters"
    | "attributes"
    | "provenance"
    | FormulaField
  >
>;

export interface ShipComponentSpec<
  C extends InputValues,
  P extends Readonly<Record<string, ParameterRange>>,
> extends ShipComponentPassthrough {
  readonly id: string;
  readonly displayName: string;
  readonly category: ShipComponentData["category"];
  readonly introduction: ShipComponentData["introduction"];
  readonly constants: C;
  readonly parameters: P;
  readonly formulas: (v: VariableTerms<C, P>) => Partial<Record<FormulaField, Term>>;
  readonly attributes?: (v: VariableTerms<C, P>) => Readonly<Record<string, Term>>;
  readonly fieldProvenance?: Readonly<Record<string, Provenance>>;
}

const compareKeys = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const sortByKey = <T>(record: Readonly<Record<string, T>>): [string, T][] =>
  Object.entries(record).sort(([a], [b]) => compareKeys(a, b));

export const defineShipComponent = <
  C extends InputValues,
  P extends Readonly<Record<string, ParameterRange>>,
>(
  spec: ShipComponentSpec<C, P>,
): ShipComponentData => {
  const parameterNames = Object.keys(spec.parameters).sort(compareKeys);
  const variableValues: InputValues = {
    ...spec.constants,
    ...Object.fromEntries(parameterNames.map((name) => [name, 0])),
  };
  const variables = terms(variableValues) as VariableTerms<C, P>;
  const declared = new Set([...Object.keys(spec.constants), ...parameterNames]);

  const renderChecked = (label: string, term: Term): string => {
    for (const name of expressionReferences(term)) {
      if (!declared.has(name)) {
        throw new ComponentDefinitionError(
          `${spec.id}.${label} references '${name}', which is not a declared constant or parameter`,
        );
      }
    }
    return renderExpression(term);
  };

  const formulas = spec.formulas(variables);
  for (const field of Object.keys(formulas)) {
    if (!FORMULA_FIELDS.includes(field as FormulaField)) {
      throw new ComponentDefinitionError(
        `${spec.id} declares '${field}', which is not a formula-typed field`,
      );
    }
  }
  for (const field of REQUIRED_FORMULA_FIELDS) {
    if (formulas[field] === undefined) {
      throw new ComponentDefinitionError(`${spec.id} is missing the required formula '${field}'`);
    }
  }

  const rendered = new Map<string, string>();
  for (const field of FORMULA_FIELDS) {
    const term = formulas[field];
    if (term !== undefined) rendered.set(field, renderChecked(field, term));
  }

  const attributes = sortByKey(spec.attributes?.(variables) ?? {}).map(
    ([name, term]) => [name, renderChecked(`attributes.${name}`, term)] as const,
  );

  const declaredProvenance = sortByKey(spec.fieldProvenance ?? {}).map(
    ([field, value]) => [field, provenance(field, value)] as const,
  );
  const emitted = new Set([
    ...rendered.keys(),
    ...attributes.map(([name]) => `attributes.${name}`),
  ]);
  for (const [field] of declaredProvenance) {
    if (!emitted.has(field)) {
      throw new ComponentDefinitionError(
        `${spec.id} declares provenance for '${field}', which is not an emitted formula or attribute`,
      );
    }
  }

  const constants = sortByKey(spec.constants).map(
    ([name, value]) => [name, number(value).node.k === "num" ? value : value] as const,
  );
  const parameters = sortByKey(spec.parameters).map(
    ([name, range]) => [name, { min: range.min, max: range.max, step: range.step }] as const,
  );

  const passthrough = Object.fromEntries(
    Object.entries(spec).filter(([name]) => !CONSTRUCTED_KEYS.has(name)),
  ) as Partial<ShipComponentData>;

  return Object.freeze({
    id: spec.id,
    displayName: spec.displayName,
    category: spec.category,
    introduction: spec.introduction,
    requires: [...(spec.requires ?? [])],
    parameters: Object.fromEntries(parameters),
    constants: Object.fromEntries(constants),
    weightKg: rendered.get("weightKg")!,
    volumeLitre: rendered.get("volumeLitre")!,
    costMicro: rendered.get("costMicro")!,
    crew: rendered.get("crew")!,
    powerKw: rendered.get("powerKw")!,
    upgradePath: [...(spec.upgradePath ?? [])],
    tags: [...(spec.tags ?? [])],
    ...(rendered.has("deckFootprintMm2")
      ? { deckFootprintMm2: rendered.get("deckFootprintMm2") }
      : {}),
    ...(rendered.has("heightMm") ? { heightMm: rendered.get("heightMm") } : {}),
    ...(rendered.has("zCgMm") ? { zCgMm: rendered.get("zCgMm") } : {}),
    ...(rendered.has("coolingKw") ? { coolingKw: rendered.get("coolingKw") } : {}),
    ...(rendered.has("buildWorkMicro") ? { buildWorkMicro: rendered.get("buildWorkMicro") } : {}),
    ...(attributes.length === 0 ? {} : { attributes: Object.fromEntries(attributes) }),
    ...passthrough,
  } satisfies ShipComponentData);
};

export interface ShipComponentCatalogueDocument {
  readonly components: readonly ShipComponentData[];
}

export const defineShipComponentCatalogue = (
  components: readonly ShipComponentData[],
): ShipComponentCatalogueDocument => {
  const ids = new Set<string>();
  for (const component of components) {
    if (ids.has(component.id)) {
      throw new ComponentDefinitionError(`duplicate component id '${component.id}'`);
    }
    ids.add(component.id);
  }
  return Object.freeze({ components: [...components] });
};
