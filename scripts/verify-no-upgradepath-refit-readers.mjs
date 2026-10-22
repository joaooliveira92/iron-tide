#!/usr/bin/env node
// No `upgradePath` reader in the refit / design-compile / production compatibility path
// (ship-part-model ticket 14, SPM-R18 AC3).
//
// Refit compatibility comes only from slot acceptance and constraints at the refit month
// (ADR-0154 §7, I-7). The legacy succession field `upgradePath` is still read by the migration
// tooling (`partCatalogue.ts`), `component.ts` `lintCatalogue` and
// `content-compiler/stages/validate.ts` (the legacy P1-read-path validation) until ticket 15
// deletes them; this gate freezes the narrower property: the refit, fit, production-compile and
// inverse-reader modules never consult `upgradePath` (nor does the desktop rebuild/refit command
// path), and the modules that decide a part's acceptance (the refit evaluation and the compile
// barrier) never read `lifecycle.supersedes` at all.
//
// Guarded file list (`SCANNED_FILES`): refit.ts, partFit.ts, partFitConstraints.ts, partQueries.ts,
// partCompatibility.ts, compileProduction.ts, compileShared.ts,
// shipBuildingContent.ts, partCatalogueReaders.ts, phase-engine/src/startRebuild.ts and
// apps/desktop/src/main/commands/designCommands.ts. The `supersedes` subset
// (`SUPERSESSION_FORBIDDEN_FILES`) is refit.ts and compileProduction.ts;
// partFit/partQueries read `supersedes` only for the informational `supersededBy`/lineage output.
//
// "Supersession never implies compatibility" is proven behaviourally by
// `packages/ship-design/test/refitSlotAcceptance.test.ts`: a successor that violates a slot
// constraint is rejected and a non-successor the slot accepts is allowed.
//
// Usage:
//   node scripts/verify-no-upgradepath-refit-readers.mjs
//   node scripts/verify-no-upgradepath-refit-readers.mjs --self-test
//
// The check is a pure `findUpgradePathReaders(file, text) -> findings[]`; it reads no clock,
// RNG, environment, or network.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

/** The refit / design-compile / production compatibility modules the gate guards. */
export const SCANNED_FILES = [
  "packages/ship-design/src/refit.ts",
  "packages/ship-design/src/partFit.ts",
  "packages/ship-design/src/partFitConstraints.ts",
  "packages/ship-design/src/partQueries.ts",
  "packages/ship-design/src/partCompatibility.ts",
  "packages/ship-design/src/compileProduction.ts",
  "packages/ship-design/src/compileShared.ts",
  "packages/ship-design/src/shipBuildingContent.ts",
  "packages/ship-design/src/partCatalogueReaders.ts",
  "packages/phase-engine/src/startRebuild.ts",
  "apps/desktop/src/main/commands/designCommands.ts",
];

/** The retired succession field these modules must never read. */
export const FORBIDDEN_TOKEN = "upgradePath";

/**
 * The modules that decide whether a part is accepted (the refit evaluation and the
 * design-compile barrier) must not read supersession at all. `partFit.ts` and `partQueries.ts`
 * still read `lifecycle.supersedes` for the informational `supersededBy`/lineage output, which
 * is not an acceptance decision, so they are outside this subset.
 */
export const SUPERSESSION_FORBIDDEN_FILES = [
  "packages/ship-design/src/refit.ts",
  "packages/ship-design/src/compileProduction.ts",
];
export const SUPERSESSION_TOKEN = "supersedes";

/**
 * Strip comments from source while preserving string/template-literal contents (a URL or a regex
 * inside a string is never a comment). Returns the code with comments blanked, so a forbidden
 * token in a comment is not a finding.
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
 * Find a reference to `token` in one source file, in source order.
 * @param {string} file - repository-relative path (forward slashes).
 * @param {string} text - source contents.
 * @param {string} token
 * @returns {Array<{file: string, line: number, token: string}>}
 */
function findToken(file, text, token) {
  const normalized = file.replaceAll("\\", "/");
  const code = stripComments(text);
  const re = new RegExp(`\\b${token}\\b`, "gu");
  const findings = [];
  let match;
  while ((match = re.exec(code)) !== null) {
    let line = 1;
    for (let i = 0; i < match.index; i += 1) if (code[i] === "\n") line += 1;
    findings.push({ file: normalized, line, token });
  }
  return findings;
}

/**
 * Find a reference to the retired succession field in one source file.
 * @param {string} file
 * @param {string} text
 * @returns {Array<{file: string, line: number, token: string}>}
 */
export function findUpgradePathReaders(file, text) {
  return findToken(file, text, FORBIDDEN_TOKEN);
}

/**
 * Find a reference to supersession in one source file.
 * @param {string} file
 * @param {string} text
 * @returns {Array<{file: string, line: number, token: string}>}
 */
export function findSupersessionReaders(file, text) {
  return findToken(file, text, SUPERSESSION_TOKEN);
}

/**
 * Scan the guarded modules under the repository root. Every module is checked for `upgradePath`;
 * the acceptance modules are additionally checked for supersession reads.
 * @param {string} repoRoot
 * @returns {Array<{file: string, line: number, token: string}>}
 */
export function scanUpgradePathReaders(repoRoot) {
  const findings = [];
  for (const file of SCANNED_FILES) {
    let text;
    try {
      text = readFileSync(resolve(repoRoot, file), "utf8");
    } catch {
      throw new Error(
        `verify-no-upgradepath-refit-readers: guarded module '${file}' is missing; update SCANNED_FILES if it moved.`,
      );
    }
    findings.push(...findUpgradePathReaders(file, text));
    if (SUPERSESSION_FORBIDDEN_FILES.includes(file))
      findings.push(...findSupersessionReaders(file, text));
  }
  return findings;
}

const SELF_TEST_CASES = [
  { name: "clean refit code", text: "export const x = slotAccepts(part, slot);", want: 0 },
  { name: "a forbidden token in code", text: "const p = def.upgradePath;", want: 1 },
  { name: "a forbidden token in a line comment", text: "// upgradePath is retired", want: 0 },
  { name: "a forbidden token in a block comment", text: "/* upgradePath */ const a = 1;", want: 0 },
  {
    name: "a forbidden token inside a string is still a reference",
    text: 'const s = "upgradePath";',
    want: 1,
  },
  { name: "a substring is not a match", text: "const x = myUpgradePathFinder;", want: 0 },
  { name: "snake-case substring is not a match", text: "const x = upgrade_path;", want: 0 },
];

const SUPERSESSION_SELF_TEST_CASES = [
  { name: "clean refit code", text: "export const x = slotAccepts(part, slot);", want: 0 },
  { name: "a supersession read in code", text: "const s = part.lifecycle.supersedes;", want: 1 },
  { name: "a supersession read in a comment", text: "// supersedes is informational", want: 0 },
];

function selfTest() {
  let failed = 0;
  for (const testCase of SELF_TEST_CASES) {
    const got = findUpgradePathReaders("packages/ship-design/src/x.ts", testCase.text).length;
    if (got !== testCase.want) {
      console.error(`self-test FAILED: ${testCase.name} expected ${testCase.want}, got ${got}`);
      failed += 1;
    }
  }
  for (const testCase of SUPERSESSION_SELF_TEST_CASES) {
    const got = findSupersessionReaders("packages/ship-design/src/x.ts", testCase.text).length;
    if (got !== testCase.want) {
      console.error(`self-test FAILED: ${testCase.name} expected ${testCase.want}, got ${got}`);
      failed += 1;
    }
  }
  if (failed > 0) {
    console.error(`verify-no-upgradepath-refit-readers: ${failed} self-test(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `verify-no-upgradepath-refit-readers: self-test passed (${
      SELF_TEST_CASES.length + SUPERSESSION_SELF_TEST_CASES.length
    } cases)`,
  );
}

try {
  if (process.argv.includes("--self-test")) {
    selfTest();
  } else {
    const findings = scanUpgradePathReaders(ROOT);
    if (findings.length > 0) {
      console.error(
        "verify-no-upgradepath-refit-readers: the refit/design-compile path reads 'upgradePath':\n" +
          findings.map((f) => `  ${f.file}:${String(f.line)} (${f.token})`).join("\n"),
      );
      process.exitCode = 1;
    } else {
      console.log(
        "verify-no-upgradepath-refit-readers: no refit/design-compile/production-compatibility " +
          "module reads 'upgradePath' or (in the acceptance modules) 'supersedes' " +
          "(compatibility is slot acceptance only)",
      );
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
