import type { SafeInt } from "@bluewave/contracts";
import {
  EmptyFormulaIdentifierError,
  InvalidExplanationOperationError,
  InvalidExplanationSourceError,
  NonFiniteNumberError,
} from "./errors.js";

export const EXPLANATION_OPERATIONS = [
  "identity",
  "add",
  "subtract",
  "multiply",
  "divide",
  "round",
  "clamp",
] as const;

export type ExplanationOperation = (typeof EXPLANATION_OPERATIONS)[number];

export const EXPLANATION_SOURCE_KINDS = ["ruleset", "content", "manual", "code"] as const;

export type ExplanationSourceKind = (typeof EXPLANATION_SOURCE_KINDS)[number];

export interface ExplanationSource {
  readonly kind: ExplanationSourceKind;
  readonly ref: string;
}

export interface ExplanationTree {
  readonly formulaId: string;
  readonly formulaVersion: string;
  readonly inputs: Readonly<Record<string, number | string>>;
  readonly intermediate: Readonly<Record<string, number>>;
  readonly result: number | SafeInt;
  readonly unit?: string;
  readonly operation?: ExplanationOperation;
  readonly source?: ExplanationSource;
  readonly children?: readonly ExplanationTree[];
}

function assertOperation(operation: string): asserts operation is ExplanationOperation {
  if (!(EXPLANATION_OPERATIONS as readonly string[]).includes(operation)) {
    throw new InvalidExplanationOperationError({
      operation,
      message: `operation must be one of ${EXPLANATION_OPERATIONS.join(", ")}`,
    });
  }
}

function assertSource(source: ExplanationSource): void {
  if (!(EXPLANATION_SOURCE_KINDS as readonly string[]).includes(source.kind)) {
    throw new InvalidExplanationSourceError({
      message: `source kind must be one of ${EXPLANATION_SOURCE_KINDS.join(", ")}`,
    });
  }
  if (source.ref.trim().length === 0) {
    throw new InvalidExplanationSourceError({ message: "source ref must be non-empty" });
  }
}

function assertFiniteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new NonFiniteNumberError({ valueName: name, message: `${name} must be a finite number` });
  }
}

function cloneAndFreezeTree(tree: ExplanationTree): ExplanationTree {
  const children = tree.children?.map(cloneAndFreezeTree);
  const clone: ExplanationTree = {
    formulaId: tree.formulaId,
    formulaVersion: tree.formulaVersion,
    inputs: Object.freeze({ ...tree.inputs }),
    intermediate: Object.freeze({ ...tree.intermediate }),
    result: tree.result,
    ...(tree.unit === undefined ? {} : { unit: tree.unit }),
    ...(tree.operation === undefined ? {} : { operation: tree.operation }),
    ...(tree.source === undefined ? {} : { source: Object.freeze({ ...tree.source }) }),
    ...(children === undefined ? {} : { children: Object.freeze(children) }),
  };
  return Object.freeze(clone);
}

export class ExplanationBuilder {
  private readonly formulaId: string;
  private readonly formulaVersion: string;
  private readonly inputs: Record<string, number | string> = {};
  private readonly intermediate: Record<string, number> = {};
  private result: number | SafeInt = 0;
  private unit: string | undefined;
  private operation: ExplanationOperation | undefined;
  private source: ExplanationSource | undefined;
  private readonly children: ExplanationTree[] = [];

  constructor(formulaId: string, formulaVersion: string) {
    if (formulaId.trim().length === 0 || formulaVersion.trim().length === 0) {
      throw new EmptyFormulaIdentifierError({
        message: "formulaId and formulaVersion must be non-empty",
      });
    }
    this.formulaId = formulaId;
    this.formulaVersion = formulaVersion;
  }

  withInput(name: string, value: number | string): this {
    if (typeof value === "number") assertFiniteNumber(name, value);
    this.inputs[name] = value;
    return this;
  }

  withIntermediate(name: string, value: number): this {
    assertFiniteNumber(name, value);
    this.intermediate[name] = value;
    return this;
  }

  withResult(result: number | SafeInt): this {
    assertFiniteNumber("result", result);
    this.result = result;
    return this;
  }

  withUnit(unit: string): this {
    this.unit = unit;
    return this;
  }

  withOperation(operation: ExplanationOperation): this {
    assertOperation(operation);
    this.operation = operation;
    return this;
  }

  withSource(source: ExplanationSource): this {
    assertSource(source);
    this.source = source;
    return this;
  }

  addChild(child: ExplanationTree): this {
    this.children.push(cloneAndFreezeTree(child));
    return this;
  }

  build(): ExplanationTree {
    return cloneAndFreezeTree({
      formulaId: this.formulaId,
      formulaVersion: this.formulaVersion,
      inputs: this.inputs,
      intermediate: this.intermediate,
      result: this.result,
      ...(this.unit === undefined ? {} : { unit: this.unit }),
      ...(this.operation === undefined ? {} : { operation: this.operation }),
      ...(this.source === undefined ? {} : { source: this.source }),
      ...(this.children.length === 0 ? {} : { children: this.children }),
    });
  }
}
