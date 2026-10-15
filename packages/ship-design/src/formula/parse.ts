import { FormulaError, FUNCTIONS, type Expr } from "./ast.js";

type Tok = { t: "num" | "id" | "op" | "eof"; s: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) i++;
    else if (/[0-9_]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9_]/.test(src[j]!)) j++;
      if (src[j] === ".") throw new FormulaError(`non-integer literal at ${i}`);
      out.push({ t: "num", s: src.slice(i, j).replaceAll("_", "") });
      i = j;
    } else if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j]!)) j++;
      out.push({ t: "id", s: src.slice(i, j) });
      i = j;
    } else if ("+-*/(),".includes(c)) {
      out.push({ t: "op", s: c });
      i++;
    } else throw new FormulaError(`unexpected character '${c}' at ${i}`);
  }
  out.push({ t: "eof", s: "" });
  return out;
}

/** Parses the restricted integer grammar into a typed AST. Throws FormulaError on any violation. */
export function parseFormula(src: string): Expr {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p]!;
  const eat = (s?: string) => {
    const t = toks[p]!;
    if (s !== undefined && t.s !== s)
      throw new FormulaError(`expected '${s}' but found '${t.s || "end"}'`);
    p++;
    return t;
  };

  const primary = (): Expr => {
    const t = peek();
    if (t.t === "num") {
      eat();
      const v = Number(t.s);
      if (!Number.isSafeInteger(v)) throw new FormulaError(`literal ${t.s} is not a safe integer`);
      return { k: "num", v };
    }
    if (t.t === "id") {
      eat();
      if (peek().s === "(") {
        eat("(");
        const args: Expr[] = [];
        if (peek().s !== ")") {
          args.push(sum());
          while (peek().s === ",") {
            eat(",");
            args.push(sum());
          }
        }
        eat(")");
        const arity = FUNCTIONS[t.s];
        if (arity === undefined) throw new FormulaError(`unknown function '${t.s}'`);
        if (arity === null ? args.length < 1 : args.length !== arity) {
          throw new FormulaError(`function '${t.s}' has wrong argument count`);
        }
        return { k: "call", fn: t.s, args };
      }
      return { k: "var", name: t.s };
    }
    if (t.s === "(") {
      eat("(");
      const e = sum();
      eat(")");
      return e;
    }
    if (t.s === "-") {
      eat();
      return { k: "neg", e: primary() };
    }
    throw new FormulaError(`unexpected '${t.s || "end"}'`);
  };
  const product = (): Expr => {
    let l = primary();
    while (peek().s === "*" || peek().s === "/") {
      const op = eat().s as "*" | "/";
      l = { k: "bin", op, l, r: primary() };
    }
    return l;
  };
  const sum = (): Expr => {
    let l = product();
    while (peek().s === "+" || peek().s === "-") {
      const op = eat().s as "+" | "-";
      l = { k: "bin", op, l, r: product() };
    }
    return l;
  };

  const e = sum();
  if (peek().t !== "eof") throw new FormulaError(`trailing input '${peek().s}'`);
  return e;
}

export function freeVariables(e: Expr, acc = new Set<string>()): Set<string> {
  switch (e.k) {
    case "var":
      acc.add(e.name);
      break;
    case "bin":
      freeVariables(e.l, acc);
      freeVariables(e.r, acc);
      break;
    case "neg":
      freeVariables(e.e, acc);
      break;
    case "call":
      // lookup's first argument names a table, not a variable
      for (const [i, a] of e.args.entries()) {
        if (e.fn === "lookup" && i === 0 && a.k === "var") continue;
        freeVariables(a, acc);
      }
      break;
    default:
      break;
  }
  return acc;
}
