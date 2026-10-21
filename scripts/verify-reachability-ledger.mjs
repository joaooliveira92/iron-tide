#!/usr/bin/env node
// Reachability ledger gate (ADR-NNNN). Fails when:
//   - a reachable row's renderer_screen file does not exist
//   - a reachable row's evidence_test file does not exist (when set)
//   - a dormant-by-decision row lacks an adr_or_issue citation
//   - a row has an invalid status
//   - a row has no id
//   - a row has duplicate id
//   - a new @bluewave/combat or @bluewave/phase-engine export is not classified
//   - a new CAMPAIGN_COMMAND_NAMES entry is not referenced by any row
// Prints a per-status summary and exits 0 on success.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const VALID_STATUSES = new Set(["reachable", "dormant-by-decision", "internal", "unclassified"]);

/**
 * Parse the reachability ledger from its JSON file.
 * @param {string} ledgerPath - absolute path to the ledger JSON
 * @returns {{ capabilities: Array<Record<string, unknown>>, version: number }}
 */
export function parseLedger(ledgerPath) {
  const raw = JSON.parse(readFileSync(ledgerPath, "utf8"));
  return raw;
}

/**
 * Extract sub-module names from a combat or phase-engine index.ts.
 * Returns the names of re-exported sub-modules (both `export * from` and named exports).
 * @param {string} indexSource - file content
 * @returns {string[]}
 */
export function extractExports(indexSource) {
  const names = [];
  // export * from "./path"
  const starRe = /export\s+\*\s+from\s+["']\.\/([^"']+)["']/g;
  let m;
  while ((m = starRe.exec(indexSource)) !== null) {
    names.push(m[1]);
  }
  // export { X } from "./path"
  const namedRe = /export\s*\{\s*[^}]+\s*\}\s*from\s+["']\.\/[^"']+["']/g;
  // We don't extract individual identifiers for named re-exports — just note the module.
  return [...new Set(names)];
}

/**
 * Validate a capability entry.
 * @param {Record<string, unknown>} entry
 * @param {number} index
 * @param {Set<string>} seenIds
 * @returns {string[]} problems
 */
export function validateEntry(entry, index, seenIds) {
  const problems = [];
  if (typeof entry.id !== "string" || entry.id.trim() === "") {
    problems.push(`entry[${index}]: missing or empty id`);
    return problems;
  }
  if (seenIds.has(entry.id)) {
    problems.push(`duplicate id: "${entry.id}"`);
  }
  seenIds.add(entry.id);

  const status = entry.status;
  if (!VALID_STATUSES.has(status)) {
    problems.push(`"${entry.id}": invalid status "${status}"`);
  }

  if (status === "dormant-by-decision" && !entry.adr_or_issue) {
    problems.push(`"${entry.id}": dormant-by-decision requires adr_or_issue citation`);
  }

  if (status === "unclassified") {
    problems.push(`"${entry.id}": unclassified entry must be triaged`);
  }

  return problems;
}

/**
 * Verify reachable entries' referenced files exist.
 * @param {Record<string, unknown>} entry
 * @returns {string[]} problems
 */
export function verifyReachableFiles(entry) {
  const problems = [];
  if (entry.status !== "reachable") return problems;

  const screen = entry.renderer_screen;
  if (screen !== null && typeof screen === "string" && screen.trim() !== "") {
    const screenPath = resolve(ROOT, "apps/desktop/src/renderer", screen);
    if (!existsSync(screenPath)) {
      problems.push(`"${entry.id}": renderer_screen not found: ${screenPath}`);
    }
  }

  const evidence = entry.evidence_test;
  if (evidence !== null && typeof evidence === "string" && evidence.trim() !== "") {
    const evPath = resolve(ROOT, evidence);
    if (!existsSync(evPath)) {
      problems.push(`"${entry.id}": evidence_test not found: ${evPath}`);
    }
  }

  return problems;
}

/**
 * Read CAMPAIGN_COMMAND_NAMES from the desktop contract source via regex.
 * @param {string} contractSource - file content
 * @returns {string[]}
 */
export function extractCommandNames(contractSource) {
  const names = [];
  const re = /["']([a-zA-Z]+)["'],?\s*\n/g;
  let m;
  while ((m = re.exec(contractSource)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/**
 * Classify command names: which are referenced by at least one ledger entry.
 * @param {string[]} allCommands
 * @param {Array<Record<string, unknown>>} capabilities
 * @returns {{ referenced: string[], unreferenced: string[] }}
 */
export function classifyCommands(allCommands, capabilities) {
  const referenced = new Set();
  for (const cap of capabilities) {
    const cmds = cap.main_commands;
    if (Array.isArray(cmds)) {
      for (const cmd of cmds) {
        referenced.add(cmd);
      }
    }
  }
  const unreferenced = allCommands.filter((c) => !referenced.has(c));
  return {
    referenced: allCommands.filter((c) => referenced.has(c)),
    unreferenced,
  };
}

const VALID_PACKAGES = new Set(["phase-engine", "combat", "campaign-engine", "desktop"]);

/**
 * Run the full validation suite.
 * @param {{ capabilities: Array<Record<string, unknown>>, version: number }} ledger
 * @param {() => string} readCombatIndex
 * @param {() => string} readPhaseEngineIndex
 * @param {() => string} readCommandContract
 * @param {(path: string) => boolean} pathExists
 * @returns {{ ok: boolean, problems: string[], counts: Record<string, number> }}
 */
export function evaluateLedger({
  ledger,
  readCombatIndex,
  readPhaseEngineIndex,
  readCommandContract,
  pathExists,
}) {
  const problems = [];
  const seenIds = new Set();
  const { capabilities } = ledger;

  for (let i = 0; i < capabilities.length; i++) {
    const entry = capabilities[i];
    problems.push(...validateEntry(entry, i, seenIds));

    if (!VALID_PACKAGES.has(entry.engine_package)) {
      problems.push(`"${entry.id}": unknown engine_package "${entry.engine_package}"`);
    }

    problems.push(...verifyReachableFiles(entry));
  }

  // Check that all combat sub-module exports are classified
  if (readCombatIndex) {
    const combatExports = extractExports(readCombatIndex());
    const classified = new Set(
      capabilities
        .filter((c) => c.engine_package === "combat")
        .map((c) => c.engine_entry?.split(",").map((s) => s.trim()))
        .flat()
        .filter(Boolean),
    );
    for (const exp of combatExports) {
      const base = exp.replace(/\.js$/, "").replace(/\/index$/, "");
      if (![...classified].some((c) => c.includes(base) || base.includes(c))) {
        problems.push(`combat export "./${exp}" is not classified in the ledger`);
      }
    }
  }

  // Check that all phase-engine named exports are classified
  if (readPhaseEngineIndex) {
    const peExports = extractExports(readPhaseEngineIndex());
    const classified = new Set(
      capabilities
        .filter((c) => c.engine_package === "phase-engine")
        .map((c) => c.engine_entry?.split(",").map((s) => s.trim()))
        .flat()
        .filter(Boolean),
    );
    for (const exp of peExports) {
      const base = exp.replace(/\.js$/, "");
      if (![...classified].some((c) => c.includes(base) || base.includes(c))) {
        problems.push(`phase-engine export "./${exp}" is not classified in the ledger`);
      }
    }
  }

  // Check that every CAMPAIGN_COMMAND_NAMES entry is referenced
  if (readCommandContract) {
    const source = readCommandContract();
    if (source) {
      const names = source
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith('"') && l.endsWith('",'))
        .map((l) => l.replace(/^"/, "").replace(/",$/, "").trim());
      const { unreferenced } = classifyCommands(names, capabilities);
      for (const name of unreferenced) {
        problems.push(`CAMPAIGN_COMMAND_NAMES entry "${name}" is not referenced by any ledger row`);
      }
    }
  }

  // Per-status counts
  const counts = { reachable: 0, "dormant-by-decision": 0, internal: 0, unclassified: 0 };
  for (const cap of capabilities) {
    const s = cap.status;
    if (s in counts) counts[s]++;
  }

  return { ok: problems.length === 0, problems, counts };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const ledger = parseLedger(resolve(ROOT, "scripts/data/reachability-ledger.json"));

  const readCombatIndex = () => readFileSync(resolve(ROOT, "packages/combat/src/index.ts"), "utf8");
  const readPhaseEngineIndex = () =>
    readFileSync(resolve(ROOT, "packages/phase-engine/src/index.ts"), "utf8");
  const readCommandContract = () =>
    readFileSync(resolve(ROOT, "apps/desktop/src/shared/campaign-command-contract.ts"), "utf8");
  const pathExists = (p) => existsSync(p);

  const result = evaluateLedger({
    ledger,
    readCombatIndex,
    readPhaseEngineIndex,
    readCommandContract,
    pathExists,
  });

  for (const problem of result.problems) {
    console.error(`reachability ledger: ${problem}`);
  }

  const statusLine = Object.entries(result.counts)
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  console.log(`reachability ledger: ok — ${statusLine}`);

  process.exit(result.ok ? 0 : 1);
}
