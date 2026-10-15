import type { SafeInt } from "@bluewave/contracts";
import { EmptyFormulaIdentifierError, NonFiniteNumberError } from "./errors.js";

export interface ExplanationTree {
  readonly formulaId: string;
  readonly formulaVersion: string;
  readonly inputs: Readonly<Record<string, number | string>>;
  readonly intermediate: Readonly<Record<string, number>>;
  readonly result: number | SafeInt;
  readonly unit?: string;
  readonly children?: readonly ExplanationTree[];
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
      ...(this.children.length === 0 ? {} : { children: this.children }),
    });
  }
}
