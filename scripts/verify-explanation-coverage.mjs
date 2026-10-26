#!/usr/bin/env node
// Explanation coverage gate (ADR-0304, issue #299). `scripts/data/explanation-coverage.json`
// lists each displayed view contract under explanation coverage. For every listed contract
// this gate scans the declared numeric and ExplanationTree fields and fails when a field has
// neither a covered formula nor a recorded exemption. It also fails on stale entries and when
// the covered percentage drops below the committed ratchet. Usage:
// `node scripts/verify-explanation-coverage.mjs`.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST_PATH = "scripts/data/explanation-coverage.json";
const CONTRACT_KEYS = ["file", "type", "area", "issue", "covered", "exempt"];
const TOP_KEYS = ["version", "minimumCoveredPercentBp", "contracts"];
const MANIFEST_VERSION = 1;

function stripCommentsAndStrings(text) {
  let out = "";
  let state = "code";
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line";
        i++;
      } else if (char === "/" && next === "*") {
        state = "block";
        i++;
      } else if (char === '"' || char === "'" || char === "`") {
        state = "string";
        quote = char;
      } else {
        out += char;
      }
    } else if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      }
    } else if (state === "block") {
      if (char === "*" && next === "/") {
        state = "code";
        i++;
      }
    } else if (state === "string") {
      if (char === "\\") i++;
      else if (char === quote) state = "code";
      else if (char === "\n") out += char;
    }
  }
  return out;
}

const NUMERIC_TYPE = /^(number|SafeInt)(\s*\|\s*null)?$/u;
const EXPLANATION_TYPE = /^ExplanationTree$/u;
const PROPERTY = /^\s*(?:readonly\s+)?(\w+)\??\s*:\s*(.+?);?\s*$/u;
const INTERFACE = /^\s*(?:export\s+)?interface\s+(\w+)\b[^=]*\{\s*$/u;
const TYPE_ALIAS = /^\s*(?:export\s+)?type\s+(\w+)\s*=\s*\{\s*$/u;
const INLINE_PROPERTY =
  /(?:readonly\s+)?(\w+)\??\s*:\s*(number|SafeInt|ExplanationTree)(?:\s*\|\s*null)?/gu;

function inlineFields(typeText, basePath) {
  const fields = [];
  for (const match of typeText.matchAll(INLINE_PROPERTY)) {
    if (match[2] === "ExplanationTree") {
      fields.push({ name: `${basePath}.${match[1]}`, kind: "explanation" });
    } else {
      fields.push({ name: `${basePath}.${match[1]}`, kind: "number" });
    }
  }
  return fields;
}

/**
 * Find numeric and ExplanationTree property fields of the named contracts in one source text.
 * @param {string} text
 * @returns {Map<string, { name: string, kind: "number" | "explanation" }[]>}
 */
export function scanContracts(text) {
  const lines = stripCommentsAndStrings(text).split("\n");
  const found = new Map();
  const contexts = [];
  let depth = 0;
  for (const line of lines) {
    const declaration = INTERFACE.exec(line) ?? TYPE_ALIAS.exec(line);
    if (declaration) {
      contexts.push({ path: declaration[1], root: declaration[1], bodyDepth: depth + 1 });
      found.set(declaration[1], found.get(declaration[1]) ?? []);
    }
    const top = contexts[contexts.length - 1];
    if (top) {
      const property = PROPERTY.exec(line);
      if (property && depth === top.bodyDepth) {
        const [, name, type] = property;
        const trimmed = type.trim();
        if (NUMERIC_TYPE.test(trimmed)) {
          found.get(top.root).push({ name: `${top.path}.${name}`, kind: "number" });
        } else if (EXPLANATION_TYPE.test(trimmed)) {
          found.get(top.root).push({ name: `${top.path}.${name}`, kind: "explanation" });
        } else if (trimmed.startsWith("{")) {
          found.get(top.root).push(...inlineFields(trimmed, `${top.path}.${name}`));
          if (!trimmed.includes("}")) {
            contexts.push({ path: `${top.path}.${name}`, root: top.root, bodyDepth: depth + 1 });
          }
        }
      }
    }
    const opens = (line.match(/\{/gu) ?? []).length;
    const closes = (line.match(/\}/gu) ?? []).length;
    depth += opens - closes;
    while (contexts.length > 0 && contexts[contexts.length - 1].bodyDepth > depth) contexts.pop();
  }
  return found;
}

/**
 * Strict manifest validation. Excess keys are rejected the way an Effect Schema decode with
 * `onExcessProperty: "error"` would reject them.
 * @param {unknown} manifest
 * @returns {string[]}
 */
export function validateManifest(manifest) {
  const problems = [];
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return ["manifest: must be an object"];
  }
  const top = /** @type {Record<string, unknown>} */ (manifest);
  for (const key of Object.keys(top)) {
    if (!TOP_KEYS.includes(key)) problems.push(`manifest: unknown key "${key}"`);
  }
  if (top.version !== MANIFEST_VERSION)
    problems.push(`manifest: version must be ${MANIFEST_VERSION}`);
  if (
    !Number.isInteger(top.minimumCoveredPercentBp) ||
    /** @type {number} */ (top.minimumCoveredPercentBp) < 0 ||
    /** @type {number} */ (top.minimumCoveredPercentBp) > 10_000
  ) {
    problems.push("manifest: minimumCoveredPercentBp must be an integer from 0 to 10000");
  }
  if (!Array.isArray(top.contracts)) return [...problems, "manifest: contracts must be an array"];

  const seen = new Set();
  top.contracts.forEach((entry, index) => {
    const label = `contract[${index}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      problems.push(`${label}: must be an object`);
      return;
    }
    const contract = /** @type {Record<string, unknown>} */ (entry);
    for (const key of Object.keys(contract)) {
      if (!CONTRACT_KEYS.includes(key)) problems.push(`${label}: unknown key "${key}"`);
    }
    for (const key of CONTRACT_KEYS) {
      if (!(key in contract)) problems.push(`${label}: missing key "${key}"`);
    }
    if (typeof contract.file !== "string" || contract.file === "")
      problems.push(`${label}: file must be a non-empty string`);
    if (typeof contract.type !== "string" || contract.type === "")
      problems.push(`${label}: type must be a non-empty string`);
    if (typeof contract.area !== "string" || contract.area === "")
      problems.push(`${label}: area must be a non-empty string`);
    if (typeof contract.issue !== "string" || !/^#\d+$/u.test(contract.issue))
      problems.push(`${label}: issue must look like "#123"`);
    for (const key of ["covered", "exempt"]) {
      const value = contract[key];
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        problems.push(`${label}: ${key} must be an object`);
        continue;
      }
      for (const [field, detail] of Object.entries(value)) {
        if (typeof detail !== "string" || detail.trim() === "")
          problems.push(`${label}: ${key}["${field}"] must be a non-empty string`);
      }
    }
    const identity = `${String(contract.file)}::${String(contract.type)}`;
    if (seen.has(identity)) problems.push(`${label}: duplicate contract ${identity}`);
    seen.add(identity);
  });
  return problems;
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {(path: string) => string} readSource
 * @returns {{ covered: number, exempt: number, total: number, percentBp: number, problems: string[] }}
 */
export function evaluateCoverage(manifest, readSource) {
  const problems = [];
  let covered = 0;
  let exempt = 0;
  let total = 0;
  for (const contract of /** @type {Record<string, any>[]} */ (manifest.contracts)) {
    const fields = scanContracts(readSource(contract.file)).get(contract.type);
    if (fields === undefined) {
      problems.push(`${contract.file}: contract type "${contract.type}" not found`);
      continue;
    }
    const rows = new Map(
      fields.map((field) => [field.name.slice(contract.type.length + 1), field.kind]),
    );
    for (const [name, kind] of rows) {
      total++;
      const hasCovered = Object.hasOwn(contract.covered, name);
      const hasExempt = Object.hasOwn(contract.exempt, name);
      if (hasCovered && hasExempt) {
        problems.push(`${contract.file}: ${name} is both covered and exempt`);
        continue;
      }
      if (hasCovered) {
        covered++;
        continue;
      }
      if (kind === "explanation") {
        problems.push(`${contract.file}: explanation field ${name} has no covered formula`);
        continue;
      }
      if (hasExempt) {
        exempt++;
        continue;
      }
      problems.push(
        `${contract.file}: numeric field ${name ?? "?"} has no explanation and no recorded exemption`,
      );
    }
    for (const name of Object.keys(contract.covered)) {
      const kind = rows.get(name);
      if (kind === undefined) problems.push(`${contract.file}: stale covered field "${name}"`);
      else if (kind !== "explanation") {
        problems.push(`${contract.file}: covered field "${name}" is not an ExplanationTree`);
      }
    }
    for (const name of Object.keys(contract.exempt)) {
      if (!rows.has(name)) problems.push(`${contract.file}: stale exempt field "${name}"`);
    }
  }
  const percentBp = total === 0 ? 10_000 : Math.floor((covered * 10_000) / total);
  if (percentBp < manifest.minimumCoveredPercentBp) {
    problems.push(
      `coverage dropped to ${formatPercentBp(percentBp)} (minimum ${formatPercentBp(manifest.minimumCoveredPercentBp)}); cover more fields or raise the ratchet with an approved ADR`,
    );
  }
  return { covered, exempt, total, percentBp, problems };
}

function formatPercentBp(basisPoints) {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  try {
    if (!existsSync(resolve(ROOT, MANIFEST_PATH))) {
      throw new Error(`${MANIFEST_PATH} is missing`);
    }
    const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_PATH), "utf8"));
    const malformed = validateManifest(manifest);
    if (malformed.length > 0) throw new Error(malformed.join("\n"));
    const result = evaluateCoverage(manifest, (path) => readFileSync(resolve(ROOT, path), "utf8"));
    if (result.problems.length > 0) throw new Error(result.problems.join("\n"));
    console.log(
      `explanation-coverage: ${result.covered}/${result.total} fields explained ` +
        `(${formatPercentBp(result.percentBp)}, ${result.exempt} exempt, minimum ` +
        `${formatPercentBp(manifest.minimumCoveredPercentBp)})`,
    );
  } catch (error) {
    console.error(
      `explanation-coverage: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
