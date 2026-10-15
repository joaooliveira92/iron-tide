/**
 * Deterministic YAML for the staged tree (ship-part-model ticket 11c).
 *
 * YAML is the content pipeline's authoring format, so the staged tree is byte-stable and
 * reviewable. Determinism comes from two rules: object keys are sorted in codepoint order
 * before emission, and shared object references are never aliased. A caller must build each
 * record from data only (no `undefined` values, no host paths, no timestamps); this module
 * adds no metadata of its own.
 */
import { compareCodePoints } from "@bluewave/deterministic";
import { parse, stringify } from "yaml";

/** Recursively clone `value` with every object's keys in codepoint order. Arrays keep order. */
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

/** Serialize a record to deterministic YAML (sorted keys, no aliases, a trailing newline). */
export function toYaml(value: unknown): string {
  const text = stringify(sortKeysDeep(value), {
    lineWidth: 0,
    aliasDuplicateObjects: false,
    indent: 2,
  });
  return text.endsWith("\n") ? text : `${text}\n`;
}

/** Parse a staged YAML document back to a raw value. */
export function fromYaml(text: string): unknown {
  return parse(text);
}
