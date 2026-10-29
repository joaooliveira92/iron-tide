export type Expr =
  | { readonly k: "num"; readonly v: number }
  | { readonly k: "ref"; readonly name: string }
  | { readonly k: "bin"; readonly op: "+" | "-" | "*" | "/"; readonly l: Expr; readonly r: Expr };

export const PRECEDENCE: Readonly<Record<Expr["k"] | "+" | "-" | "*" | "/", number>> = {
  num: 3,
  ref: 3,
  bin: 0,
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
};

export type Operand = Term | number;

export interface Term {
  readonly node: Expr;
  plus(...others: readonly Operand[]): Term;
  minus(other: Operand): Term;
  times(...others: readonly Operand[]): Term;
  over(other: Operand): Term;
}

const checkInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer, got ${String(value)}`);
  }
  return value;
};

const operandNode = (operand: Operand): Expr =>
  typeof operand === "number" ? { k: "num", v: checkInteger(operand, "literal") } : operand.node;

const makeTerm = (node: Expr): Term => ({
  node,
  plus: (...others) =>
    makeTerm(others.reduce<Expr>((left, right) => bin("+", left, operandNode(right)), node)),
  minus: (other) => makeTerm(bin("-", node, operandNode(other))),
  times: (...others) =>
    makeTerm(others.reduce<Expr>((left, right) => bin("*", left, operandNode(right)), node)),
  over: (other) => makeTerm(bin("/", node, operandNode(other))),
});

const bin = (op: "+" | "-" | "*" | "/", l: Expr, r: Expr): Expr => ({ k: "bin", op, l, r });

export const number = (value: number): Term =>
  makeTerm({ k: "num", v: checkInteger(value, "number") });

export const reference = (name: string): Term => makeTerm({ k: "ref", name });

export type InputValues = Readonly<Record<string, number>>;

export type Terms<T extends Readonly<Record<string, unknown>>> = {
  readonly [K in keyof T]: Term;
};

export const terms = <T extends Readonly<Record<string, unknown>>>(values: T): Terms<T> =>
  Object.fromEntries(
    Object.keys(values)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((name) => [name, reference(name)]),
  ) as Terms<T>;

const render = (node: Expr, parentPrecedence: number): string => {
  switch (node.k) {
    case "num":
      return String(node.v);
    case "ref":
      return node.name;
    case "bin": {
      const precedence = PRECEDENCE[node.op];
      const text = `${render(node.l, precedence)} ${node.op} ${render(node.r, precedence)}`;
      return precedence < parentPrecedence ? `(${text})` : text;
    }
  }
};

export const renderExpression = (term: Term | Expr): string =>
  render("node" in term ? term.node : term, 0);

export const expressionReferences = (term: Term | Expr, seen: string[] = []): string[] => {
  const node = "node" in term ? term.node : term;
  switch (node.k) {
    case "ref":
      return seen.includes(node.name) ? seen : [...seen, node.name];
    case "num":
      return seen;
    case "bin":
      return expressionReferences(node.r, expressionReferences(node.l, seen));
  }
};
