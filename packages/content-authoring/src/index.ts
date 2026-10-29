export * from "@bluewave/content-schema";

export {
  expressionReferences,
  number,
  renderExpression,
  terms,
  type Expr,
  type InputValues,
  type Term,
  type Terms,
} from "./expression.js";

export { collection, list, record } from "./document.js";

export {
  PROVENANCE_STATUSES,
  ProvenanceError,
  provenance,
  requiresRationale,
  type Provenance,
  type ProvenanceStatus,
} from "./provenance.js";

export {
  ComponentDefinitionError,
  FORMULA_FIELDS,
  OPTIONAL_FORMULA_FIELDS,
  REQUIRED_FORMULA_FIELDS,
  defineShipComponent,
  defineShipComponentCatalogue,
  type FormulaField,
  type OptionalFormulaField,
  type ParameterRange,
  type RequiredFormulaField,
  type ShipComponentCatalogueDocument,
  type ShipComponentSpec,
} from "./ship-component.js";
