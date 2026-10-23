#!/usr/bin/env node
// No torpedo-model performance constants in combat (ship-part-model ticket 13b, SPM-R26 P4).
//
// Combat reads torpedo performance ONLY from the neutral `CompiledTorpedo` contract threaded
// through the battle input. The retired per-model module (`packages/combat/src/torpedoes/model.ts`)
// and its consumers are gone; this gate fails closed if any of that module's symbols reappears
// under `packages/combat/src`. Comments are stripped before scanning (the fuze map and prose
// comments legitimately name the retired symbols).
//
// Usage:
//   node scripts/verify-no-torpedo-model-constants.mjs
//   node scripts/verify-no-torpedo-model-constants.mjs --self-test
//
// The check is a pure `findTorpedoModelConstants(file, text) -> findings[]`; it reads no clock,
// RNG, environment, or network.

import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

/** The scanned subtree: combat's source only. */
export const SCAN_ROOT = "packages/combat/src";

/** The retired per-model symbols that must never return to combat's source. */
export const FORBIDDEN_SYMBOLS = [
  "TorpedoModelDefinition",
  "TorpedoModelSource",
  "SHIPPED_TORPEDO_MODELS",
  "SHIPPED_TORPEDO_MODELS_CONTRACT",
  "torpedoModelById",
  "OxygenTorpedoState",
  "TorpedoSetting",
  "torpedoModelsContentVersion",
  "compatibleLauncherFamilyIds",
  "orderedSettings",
  "TorpedoModelsContract",
  "validateTorpedoModelsContract",
  "assertTorpedoModelSurface",
  "validateTorpedoModelDefinition",
  "computeTorpedoModelContentHash",
  "withTorpedoModelContentHash",
  "verifyTorpedoModelContentHash",
];

const SOURCE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;

/**
 * The cross-process test harnesses. They carry sample `CompiledTorpedo` records to drive the
 * determinism children, which is test input, not engine data. The retired-symbol scan still
 * applies to them; only per-model sample *literals* are permitted, and only in these two files.
 */
export const TORPEDO_FIXTURE_HARNESSES = [
  "packages/combat/harness/run-torpedo-child.ts",
  "packages/combat/harness/run-battle-resolution-child.ts",
];

/**
 * Strip comments from source while preserving string/template-literal contents (a URL or a regex
 * inside a string is never a comment). Returns the code with comments blanked, so a forbidden
 * symbol in a comment is not a finding.
 * @param {string} text
 * @returns {string}
 */
export function stripComments(text) {
  let out = "";
  let i = 0;
  const n = text.length;
  let state = "code"; // code | line | block | single | double | template
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        state = "block";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "`") state = "template";
      out += c;
      i += 1;
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += c;
      } else out += " ";
      i += 1;
      continue;
    }
    if (state === "block") {
      if (c === "*" && next === "/") {
        state = "code";
        out += "  ";
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }
    // String states: preserve contents, honour escapes, terminate on the matching quote.
    if (c === "\\") {
      out += c + (next ?? "");
      i += 2;
      continue;
    }
    if (
      (state === "single" && c === "'") ||
      (state === "double" && c === '"') ||
      (state === "template" && c === "`")
    ) {
      state = "code";
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Find the retired per-model symbols in one source file, in source order.
 * @param {string} file - repository-relative path (forward slashes).
 * @param {string} text - source contents.
 * @returns {Array<{file: string, line: number, symbol: string}>}
 */
export function findTorpedoModelConstants(file, text) {
  const normalized = file.replaceAll("\\", "/");
  const code = stripComments(text);
  const findings = [];
  const offsets = [];
  let offset = 0;
  for (const line of code.split("\n")) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  for (const symbol of FORBIDDEN_SYMBOLS) {
    const re = new RegExp(`\\b${symbol}\\b`, "gu");
    let match;
    while ((match = re.exec(code)) !== null) {
      let line = 1;
      for (let i = 1; i < offsets.length && offsets[i] <= match.index; i += 1) line = i + 1;
      findings.push({ file: normalized, line, symbol });
    }
  }
  return findings.sort((a, b) => a.line - b.line || (a.symbol < b.symbol ? -1 : 1));
}

/**
 * Find a per-model `CompiledTorpedo` sample record (a `partId:` key alongside a `diameterUm:` key)
 * outside the cross-process test harnesses. This proves combat's engine source holds no per-model
 * torpedo sample data — only the harnesses that drive the determinism children do.
 * @param {string} file - repository-relative path (forward slashes).
 * @param {string} text - source contents.
 * @returns {Array<{file: string, line: number, symbol: string}>}
 */
export function findUnscopedTorpedoFixture(file, text) {
  const normalized = file.replaceAll("\\", "/");
  // Scope: `packages/combat/src` only. `packages/combat/test/**` is allowed to carry sample records
  // (the combat test fixtures replicate the retired models); the symbol scan + the deleted model.ts
  // are the guarantee that the engine itself holds no per-model data.
  if (TORPEDO_FIXTURE_HARNESSES.includes(normalized)) return [];
  const code = stripComments(text);
  if (/\bpartId\s*:/u.test(code) && /\bdiameterUm\s*:/u.test(code)) {
    return [{ file: normalized, line: 1, symbol: "CompiledTorpedo sample literal" }];
  }
  return [];
}

/**
 * Scan combat's source under `packages/combat/src` (tracked + untracked, git-ignored excluded).
 * @param {string} repoRoot
 * @returns {Array<{file: string, line: number, symbol: string}>}
 */
export function scanTorpedoModelConstants(repoRoot) {
  const files = [
    ...new Set(
      execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      })
        .split("\0")
        .map((file) => file.replaceAll("\\", "/"))
        .filter((file) => file.startsWith(`${SCAN_ROOT}/`) && SOURCE_RE.test(file)),
    ),
  ].sort();

  if (files.length === 0) {
    throw new Error(`verify-no-torpedo-model-constants: no source under ${SCAN_ROOT}`);
  }

  return files.flatMap((file) => {
    const stat = lstatSync(resolve(repoRoot, file), { throwIfNoEntry: false });
    if (stat?.isSymbolicLink())
      throw new Error(`verify-no-torpedo-model-constants: source symlink unsupported: ${file}`);
    if (stat?.isFile() !== true) return [];
    const text = readFileSync(resolve(repoRoot, file), "utf8");
    return [...findTorpedoModelConstants(file, text), ...findUnscopedTorpedoFixture(file, text)];
  });
}

// Embedded self-test fixtures (ADR-0100/ADR-0107 idiom): the gate proves its own boundary.
const SELF_TEST_CASES = [
  { name: "clean combat code", text: "export const x = compiledTorpedoOf(t, id);", want: 0 },
  {
    name: "a forbidden symbol in code",
    text: "import { torpedoModelById } from './model.js';",
    want: 1,
  },
  { name: "a forbidden symbol in a line comment", text: "// torpedoModelById lived here", want: 0 },
  {
    name: "a forbidden symbol in a block comment",
    text: "/* orderedSettings */ const a = 1;",
    want: 0,
  },
  {
    name: "a forbidden symbol inside a string is still a reference",
    text: 'const s = "compatibleLauncherFamilyIds";',
    want: 1,
  },
  { name: "a substring is not a match", text: "const x = CompiledTorpedoSpeedSetting;", want: 0 },
  {
    name: "a URL in a string is not a comment",
    text: 'const u = "https://x/torpedoModelById";',
    want: 1,
  },
];

/** Fixture-literal cases: only the cross-process harnesses may carry a sample record. */
const FIXTURE_SELF_TEST_CASES = [
  {
    name: "a sample record in the engine source",
    file: "packages/combat/src/torpedoes/evil.ts",
    text: "const t = { partId: 'x', diameterUm: 533_000 };",
    want: 1,
  },
  {
    name: "a sample record in a harness",
    file: "packages/combat/harness/run-torpedo-child.ts",
    text: "const t = { partId: 'x', diameterUm: 533_000 };",
    want: 0,
  },
  {
    name: "an engine type annotation, not a literal",
    file: "packages/combat/src/torpedoes/engine.ts",
    text: "interface T { diameterUm: number }",
    want: 0,
  },
];

function selfTest() {
  let failed = 0;
  for (const testCase of SELF_TEST_CASES) {
    const got = findTorpedoModelConstants("packages/combat/src/x.ts", testCase.text).length;
    if (got !== testCase.want) {
      console.error(`self-test FAILED: ${testCase.name} expected ${testCase.want}, got ${got}`);
      failed += 1;
    }
  }
  for (const testCase of FIXTURE_SELF_TEST_CASES) {
    const got = findUnscopedTorpedoFixture(testCase.file, testCase.text).length;
    if (got !== testCase.want) {
      console.error(`self-test FAILED: ${testCase.name} expected ${testCase.want}, got ${got}`);
      failed += 1;
    }
  }
  if (failed > 0) {
    console.error(`verify-no-torpedo-model-constants: ${failed} self-test(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `verify-no-torpedo-model-constants: self-test passed (${
      SELF_TEST_CASES.length + FIXTURE_SELF_TEST_CASES.length
    } cases)`,
  );
}

try {
  if (process.argv.includes("--self-test")) {
    selfTest();
  } else {
    const findings = scanTorpedoModelConstants(ROOT);
    if (findings.length > 0) {
      console.error(
        "verify-no-torpedo-model-constants: retired torpedo-model constants remain in combat:\n" +
          findings.map((f) => `  ${f.file}:${String(f.line)} (${f.symbol})`).join("\n"),
      );
      process.exitCode = 1;
    } else {
      console.log(
        "verify-no-torpedo-model-constants: combat engine reads only CompiledTorpedo " +
          "(per-model sample data confined to the cross-process test harnesses)",
      );
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
