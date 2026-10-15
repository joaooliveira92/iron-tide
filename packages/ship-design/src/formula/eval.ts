import { powRational } from "@bluewave/deterministic";
import { FormulaError, type Expr } from "./ast.js";
import { BP_ONE, toSafe } from "../units.js";

/** A lookup table: ascending x breakpoints with integer y; linear interpolation, floor, clamped at ends. */
export interface LookupTable {
  readonly points: readonly (readonly [number, number])[];
}

export interface EvalEnv {
  readonly vars: Readonly<Record<string, number>>;
  readonly tables?: Readonly<Record<string, LookupTable>>;
}

function interp(t: LookupTable, x: bigint): bigint {
  const pts = t.points;
  if (pts.length === 0) throw new FormulaError("empty lookup table");
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (x <= BigInt(first[0])) return BigInt(first[1]);
  if (x >= BigInt(last[0])) return BigInt(last[1]);
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    if (x <= BigInt(x1)) {
      const [x0, y0] = pts[i - 1]!;
      const dx = BigInt(x1 - x0);
      const num = BigInt(y1 - y0) * (x - BigInt(x0));
      // floor division, correct for negative slopes
      let q = num / dx;
      if (num % dx !== 0n && num < 0n) q -= 1n;
      return BigInt(y0) + q;
    }
  }
  return BigInt(last[1]);
}

function floorDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new FormulaError("division by zero");
  let q = a / b;
  if (a % b !== 0n && a < 0n !== b < 0n) q -= 1n;
  return q;
}

function ev(e: Expr, env: EvalEnv): bigint {
  switch (e.k) {
    case "num":
      return BigInt(e.v);
    case "var": {
      const v = env.vars[e.name];
      if (v === undefined) throw new FormulaError(`undefined variable '${e.name}'`);
      if (!Number.isSafeInteger(v))
        throw new FormulaError(`variable '${e.name}' is not a safe integer`);
      return BigInt(v);
    }
    case "neg":
      return -ev(e.e, env);
    case "bin": {
      const l = ev(e.l, env);
      const r = ev(e.r, env);
      return e.op === "+" ? l + r : e.op === "-" ? l - r : e.op === "*" ? l * r : floorDiv(l, r);
    }
    case "call": {
      if (e.fn === "lookup") {
        const a0 = e.args[0]!;
        if (a0.k !== "var") throw new FormulaError("lookup first argument must be a table name");
        const t = env.tables?.[a0.name];
        if (!t) throw new FormulaError(`unknown table '${a0.name}'`);
        return interp(t, ev(e.args[1]!, env));
      }
      const a = e.args.map((x) => ev(x, env));
      switch (e.fn) {
        case "min":
          return a.reduce((m, x) => (x < m ? x : m));
        case "max":
          return a.reduce((m, x) => (x > m ? x : m));
        case "clamp":
          return a[0]! < a[1]! ? a[1]! : a[0]! > a[2]! ? a[2]! : a[0]!;
        case "ceildiv":
          return -floorDiv(-a[0]!, a[1]!);
        case "mulbp": {
          const num = a[0]! * a[1]!;
          const d = BigInt(BP_ONE);
          return floorDiv(2n * num + d, 2n * d);
        }
        case "pow": {
          const [x, p, q] = a as [bigint, bigint, bigint];
          if (x < 0n || p < 0n || q < 1n) throw new FormulaError("pow requires x>=0, p>=0, q>=1");
          return powRational(x, Number(p), Number(q));
        }
        default:
          throw new FormulaError(`unknown function '${e.fn}'`);
      }
    }
  }
}

/** Evaluates exactly in bigint; the result must fit a safe integer. Pure and deterministic. */
export function evaluate(e: Expr, env: EvalEnv): number {
  return toSafe("formula", ev(e, env));
}
