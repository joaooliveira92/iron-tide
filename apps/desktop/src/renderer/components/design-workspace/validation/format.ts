import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import type { BoardFinding } from "./boardFindings.js";

/** Display form of a rule's raw unit (the compile works in integers: milliknots, basis points). */
function display(v: number, unit: string | undefined, format: PresentationFormat): string {
  switch (unit) {
    case "kn/1000":
      return `${format.number(v / 1000, { maximumFractionDigits: 1 })} kn`;
    case "bp":
      return format.percent(v, 1);
    case "kg":
      return format.measurement(v, "mass", { maximumFractionDigits: 1 });
    case undefined:
      return format.number(v, { maximumFractionDigits: 0 });
    default:
      return `${format.number(v, { maximumFractionDigits: 0 })} ${unit}`;
  }
}

/**
 * "Current 16.2 kn; needs at least 18.0 kn" when the rule says which way its limit points, else the raw value
 * and limit. Undefined when the finding carries no meaningful numbers (a yes/no rule). Renders through the bound
 * presentation format (ADR-0218).
 */
export function valueLine(f: BoardFinding, format: PresentationFormat): string | undefined {
  if (f.bound === undefined && f.unit === undefined) return undefined;
  const now = display(f.value, f.unit, format);
  const limit = display(f.limit, f.unit, format);
  if (f.bound === "min") return `Current ${now}; needs at least ${limit}`;
  if (f.bound === "max") return `Current ${now}; must not exceed ${limit}`;
  return `Value ${now}; limit ${limit}`;
}
