import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { isScalar, LineCounter, parseDocument, visit } from "yaml";

export interface SafeParseResult {
  success: boolean;
  data: unknown;
}

export const YAML_POLICY_VERSION = 1;
export const MAX_YAML_BYTES = 10 * 1024 * 1024;
export const MAX_YAML_NESTING = 64;

export const MAX_YAML_ALIAS_COUNT = 100;

const SUPPORTED_YAML_TAGS: ReadonlySet<string> = new Set([
  "tag:yaml.org,2002:str",
  "tag:yaml.org,2002:int",
  "tag:yaml.org,2002:float",
  "tag:yaml.org,2002:bool",
  "tag:yaml.org,2002:null",
  "tag:yaml.org,2002:seq",
  "tag:yaml.org,2002:map",
]);

export function parseYamlSafe(
  content: string,
  sourcePath: string,
  collector: DiagnosticCollector,
): SafeParseResult {
  if (Buffer.byteLength(content, "utf8") > MAX_YAML_BYTES) {
    collector.addError("YAML-SIZE", `File exceeds maximum size of ${MAX_YAML_BYTES} bytes`, {
      stage: "parse",
      sourceLocation: { path: sourcePath, line: 1 },
      remediation: "Reduce file size or split into multiple files",
    });
    return { success: false, data: undefined };
  }

  const lineCounter = new LineCounter();
  const duplicateKeys = new Map<number, string>();
  const unsupportedTags: { tag: string; offset: number }[] = [];
  const aliasOffsets: number[] = [];
  let doc: ReturnType<typeof parseDocument>;

  try {
    doc = parseDocument(content, {
      schema: "core",
      lineCounter,
      resolveKnownTags: false,
      uniqueKeys: true,
    });

    visit(doc, {
      Pair(_key, pair) {
        if (isScalar(pair.key) && pair.key.range) {
          duplicateKeys.set(pair.key.range[0], String(pair.key.value));
        }
      },
    });

    visit(doc, {
      Node(_key, node) {
        if (node.tag !== undefined && !SUPPORTED_YAML_TAGS.has(node.tag)) {
          unsupportedTags.push({ tag: node.tag, offset: node.range?.[0] ?? 0 });
        }
      },
    });

    visit(doc, {
      Alias(_key, alias) {
        aliasOffsets.push(alias.range?.[0] ?? 0);
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    collector.addError("YAML-PARSE", `Failed to parse YAML: ${message}`, {
      stage: "parse",
      sourceLocation: { path: sourcePath, line: 1 },
      remediation: "Check YAML syntax",
    });
    return { success: false, data: undefined };
  }

  if (doc.errors.length > 0) {
    for (const error of doc.errors) {
      if (error.code === "DUPLICATE_KEY") {
        const linePos = error.linePos?.[0];
        const key = duplicateKeys.get(error.pos[0]);
        collector.addError(
          "YAML-DUPLICATE-KEY",
          key === undefined ? "Duplicate mapping key" : `Duplicate mapping key '${key}'`,
          {
            stage: "parse",
            sourceLocation: { path: sourcePath, line: linePos?.line ?? 1, column: linePos?.col },
            remediation: "Remove or rename the duplicate mapping key",
          },
        );
      } else {
        collector.addError("YAML-PARSE", `Failed to parse YAML: ${error.message}`, {
          stage: "parse",
          sourceLocation: { path: sourcePath, line: 1 },
          remediation: "Check YAML syntax",
        });
      }
    }
    return { success: false, data: undefined };
  }

  if (unsupportedTags.length > 0) {
    for (const { tag, offset } of unsupportedTags) {
      const linePos = lineCounter.linePos(offset);
      collector.addError("YAML-UNSUPPORTED-TAG", `Unsupported YAML tag '${tag}'`, {
        stage: "parse",
        sourceLocation: { path: sourcePath, line: linePos.line, column: linePos.col },
        remediation: "Remove the tag; only plain YAML values are supported",
      });
    }
    return { success: false, data: undefined };
  }

  if (aliasOffsets.length > MAX_YAML_ALIAS_COUNT) {
    const linePos = lineCounter.linePos(aliasOffsets[MAX_YAML_ALIAS_COUNT] ?? 0);
    collector.addError(
      "YAML-ALIAS-LIMIT",
      `Alias usage exceeds maximum of ${MAX_YAML_ALIAS_COUNT}`,
      {
        stage: "parse",
        sourceLocation: { path: sourcePath, line: linePos.line, column: linePos.col },
        remediation: "Reduce anchor/alias reuse in this file",
      },
    );
    return { success: false, data: undefined };
  }

  let data: unknown;
  try {
    data = doc.toJS({ maxAliasCount: MAX_YAML_ALIAS_COUNT + 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    collector.addError("YAML-PARSE", `Failed to parse YAML: ${message}`, {
      stage: "parse",
      sourceLocation: { path: sourcePath, line: 1 },
      remediation: "Check YAML syntax",
    });
    return { success: false, data: undefined };
  }

  if (typeof data !== "object" || data === null) {
    collector.addError("YAML-ROOT", "YAML root must be an object", {
      stage: "parse",
      sourceLocation: { path: sourcePath, line: 1 },
    });
    return { success: false, data: undefined };
  }

  const depth = calculateDepth(data as Record<string, unknown>);
  if (depth > MAX_YAML_NESTING) {
    collector.addError(
      "YAML-NESTING",
      `YAML nesting depth ${depth} exceeds maximum ${MAX_YAML_NESTING}`,
      {
        stage: "parse",
        sourceLocation: { path: sourcePath, line: 1 },
      },
    );
    return { success: false, data: undefined };
  }

  return { success: true, data };
}

function calculateDepth(obj: Record<string, unknown>): number {
  let maxDepth = 1;
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const d = 1 + calculateDepth(value as Record<string, unknown>);
      if (d > maxDepth) maxDepth = d;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          const d = 1 + calculateDepth(item as Record<string, unknown>);
          if (d > maxDepth) maxDepth = d;
        }
      }
    }
  }
  return maxDepth;
}
