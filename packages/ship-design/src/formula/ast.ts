export type Expr =
  | { readonly k: "num"; readonly v: number }
  | { readonly k: "var"; readonly name: string }
  | { readonly k: "bin"; readonly op: "+" | "-" | "*" | "/"; readonly l: Expr; readonly r: Expr }
  | { readonly k: "neg"; readonly e: Expr }
  | { readonly k: "call"; readonly fn: string; readonly args: readonly Expr[] };

export class FormulaError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "FormulaError";
  /** `_tag`-based narrowing without `instanceof`. */
  static is(value: unknown): value is FormulaError {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { readonly _tag?: unknown })._tag === "FormulaError"
    );
  }
  constructor(message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

/** Function name -> arity (null = variadic >= 1). Closed set: no eval, no content-defined code. */
export const FUNCTIONS: Readonly<Record<string, number | null>> = {
  min: null,
  max: null,
  clamp: 3,
  ceildiv: 2,
  mulbp: 2,
  pow: 3,
  lookup: 2,
};
