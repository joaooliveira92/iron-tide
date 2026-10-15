import type { BoardFinding } from "./boardFindings.js";

const fmt = (v: number, digits = 0) =>
  v.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Display form of a rule's raw unit (the compile works in integers: milliknots, basis points). */
function display(v: number, unit: string | undefined): string {
  switch (unit) {
    case "kn/1000":
      return `${fmt(v / 1000, 1)} kn`;
    case "bp":
      return `${fmt(v / 100, 1)}%`;
    case "kg":
      return `${fmt(v / 1000, 1)} t`;
    case undefined:
      return fmt(v);
    default:
      return `${fmt(v)} ${unit}`;
  }
}

/**
 * "Current 16.2 kn; needs at least 18.0 kn" when the rule says which way its limit points, else the raw value
 * and limit. Undefined when the finding carries no meaningful numbers (a yes/no rule).
 */
export function valueLine(f: BoardFinding): string | undefined {
  if (f.bound === undefined && f.unit === undefined) return undefined;
  const now = display(f.value, f.unit);
  const limit = display(f.limit, f.unit);
  if (f.bound === "min") return `Current ${now}; needs at least ${limit}`;
  if (f.bound === "max") return `Current ${now}; must not exceed ${limit}`;
  return `Value ${now}; limit ${limit}`;
}
