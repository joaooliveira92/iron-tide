import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MAX_YAML_ALIAS_COUNT, MAX_YAML_NESTING, parseYamlSafe } from "../src/index.js";

function collectYamlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectYamlFiles(full));
    } else if (/\.ya?ml$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("parseYamlSafe", () => {
  it("parses valid YAML", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe("key: value\nnum: 42", "test.yaml", collector);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: "value", num: 42 });
  });

  it("resolves anchors and aliases", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe("a: &x 1\nb: *x\nc: *x", "test.yaml", collector);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("accepts standard scalar tags", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe('a: !!str 1\nb: !!int "2"', "test.yaml", collector);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ a: "1", b: 2 });
  });

  it("rejects malformed YAML", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe("{ invalid: ", "test.yaml", collector);
    expect(result.success).toBe(false);
    expect(collector.hasErrors).toBe(true);
    expect(collector.errors[0]?.code).toBe("YAML-PARSE");
  });

  it("rejects excessive size", () => {
    const collector = new DiagnosticCollector();
    const largeContent = "key: " + "x".repeat(12 * 1024 * 1024);
    const result = parseYamlSafe(largeContent, "big.yaml", collector);
    expect(result.success).toBe(false);
    expect(collector.errors[0]?.code).toBe("YAML-SIZE");
  });

  it("rejects excessive nesting", () => {
    const collector = new DiagnosticCollector();
    const lines: string[] = [];
    for (let i = 0; i < MAX_YAML_NESTING + 5; i += 1) {
      lines.push(`${"  ".repeat(i)}level${i}:`);
    }
    lines.push(`${"  ".repeat(MAX_YAML_NESTING + 5)}leaf: value`);
    const result = parseYamlSafe(lines.join("\n"), "deep.yaml", collector);
    expect(result.success).toBe(false);
    expect(collector.errors[0]?.code).toBe("YAML-NESTING");
  });

  it("rejects a non-object root", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe("just a scalar", "scalar.yaml", collector);
    expect(result.success).toBe(false);
    expect(collector.errors[0]?.code).toBe("YAML-ROOT");
  });

  it("rejects a duplicate top-level mapping key naming file and key", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe("a: 1\na: 2", "dup.yaml", collector);
    expect(result.success).toBe(false);
    const error = collector.errors[0];
    expect(error?.code).toBe("YAML-DUPLICATE-KEY");
    expect(error?.message).toContain("a");
    expect(error?.sourceLocation?.path).toBe("dup.yaml");
    expect(error?.sourceLocation?.line).toBe(2);
  });

  it("rejects a duplicate nested mapping key naming file and key", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe("root:\n  b: 1\n  b: 2", "nested.yaml", collector);
    expect(result.success).toBe(false);
    const error = collector.errors[0];
    expect(error?.code).toBe("YAML-DUPLICATE-KEY");
    expect(error?.message).toContain("b");
    expect(error?.sourceLocation?.path).toBe("nested.yaml");
    expect(error?.sourceLocation?.line).toBe(3);
  });

  it("rejects a custom tag", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe("a: !foo bar", "tagged.yaml", collector);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    const error = collector.errors[0];
    expect(error?.code).toBe("YAML-UNSUPPORTED-TAG");
    expect(error?.message).toContain("!foo");
    expect(error?.sourceLocation?.path).toBe("tagged.yaml");
  });

  it("rejects a js/function-style tag without constructing a value", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe(
      'a: !!js/function "function () { return 1 }"',
      "exec.yaml",
      collector,
    );
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(collector.errors[0]?.code).toBe("YAML-UNSUPPORTED-TAG");
  });

  it("rejects a binary tag", () => {
    const collector = new DiagnosticCollector();
    const result = parseYamlSafe("a: !!binary aGk=", "binary.yaml", collector);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(collector.errors[0]?.code).toBe("YAML-UNSUPPORTED-TAG");
  });

  it("accepts alias use at the documented cap", () => {
    const collector = new DiagnosticCollector();
    let content = "a: &x 1\n";
    for (let i = 0; i < MAX_YAML_ALIAS_COUNT; i += 1) {
      content += `k${i}: *x\n`;
    }
    const result = parseYamlSafe(content, "aliases.yaml", collector);
    expect(result.success).toBe(true);
  });

  it("rejects alias use above the documented cap at the offending alias", () => {
    const collector = new DiagnosticCollector();
    let content = "a: &x 1\n";
    for (let i = 0; i < MAX_YAML_ALIAS_COUNT + 1; i += 1) {
      content += `k${i}: *x\n`;
    }
    const result = parseYamlSafe(content, "aliases.yaml", collector);
    expect(result.success).toBe(false);
    const error = collector.errors[0];
    expect(error?.code).toBe("YAML-ALIAS-LIMIT");
    expect(error?.message).toContain(String(MAX_YAML_ALIAS_COUNT));
    expect(error?.sourceLocation?.path).toBe("aliases.yaml");
    expect(error?.sourceLocation?.line).toBe(MAX_YAML_ALIAS_COUNT + 2);
  });

  it("parses every authored production content file unchanged", () => {
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
    const root = join(repoRoot, "content", "production", "1880");
    const files = collectYamlFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const collector = new DiagnosticCollector();
      const result = parseYamlSafe(readFileSync(file, "utf8"), file, collector);
      expect(result.success, `${file}: ${collector.toHuman()}`).toBe(true);
    }
  });
});
