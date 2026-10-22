import { compareCodePoints } from "@bluewave/deterministic";
import { parse, stringify } from "yaml";

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort(compareCodePoints)) {
      out[key] = sortKeysDeep(source[key]);
    }
    return out;
  }
  return value;
}

export function toYaml(value: unknown): string {
  const text = stringify(sortKeysDeep(value), {
    lineWidth: 0,
    aliasDuplicateObjects: false,
    indent: 2,
  });
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function fromYaml(text: string): unknown {
  return parse(text);
}
