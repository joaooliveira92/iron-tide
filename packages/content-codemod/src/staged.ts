import { compareCodePoints } from "@bluewave/deterministic";

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

export function toStagedJson(value: unknown): string {
  const text = JSON.stringify(sortKeysDeep(value), null, 2);
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function fromStagedJson(text: string): unknown {
  return JSON.parse(text);
}
