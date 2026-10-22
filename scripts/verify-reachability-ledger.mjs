#!/usr/bin/env node
// Reachability ledger gate (ADR-0267). `scripts/data/reachability-ledger.json` maps each
// player-facing engine capability (a player verb, backed by package exports) to its desktop
// path: engine entry -> main command (CAMPAIGN_COMMAND_NAMES) -> renderer screen -> evidence
// test. This gate fails when:
//   - the ledger does not match its strict schema (unknown keys, bad status/id, duplicates);
//   - a row is `unclassified`;
//   - a `combat` module, a `phase-engine` index module or an `apply*` verb, or a
//     CAMPAIGN_COMMAND_NAMES entry is not classified (exact match, no substring matching),
//     or is classified twice, or a row names something that no longer exists;
//   - a `reachable` row lacks a production renderer screen, a registered main handler, a
//     renderer call site for each command, or an existing test that cites the path;
//   - a `dormant-by-decision` row does not cite a resolvable ADR or issue.
// It also fails when `docs/reachability-report.md` drifts from the ledger.
// Usage: `node scripts/verify-reachability-ledger.mjs [--write]` (`--write` regenerates the report).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LEDGER_PATH = "scripts/data/reachability-ledger.json";
const REPORT_PATH = "docs/reachability-report.md";
const CONTRACT_PATH = "apps/desktop/src/shared/campaign-command-contract.ts";
const BRIDGE_PATH = "apps/desktop/src/main/campaignBridge.ts";
const REGISTRY_PATH = "apps/desktop/src/renderer/shell/campaign-screen-registry.tsx";
const RENDERER_DIR = "apps/desktop/src/renderer";

export const LEDGER_VERSION = 2;
export const STATUSES = ["reachable", "dormant-by-decision", "internal", "unclassified"];
const PACKAGES = ["phase-engine", "combat", "campaign-engine", "desktop"];
const ROW_KEYS = {
  id: "string",
  player_verb: "string",
  status: "string",
  engine_package: "string",
  engine_modules: "string[]",
  engine_symbols: "string[]",
  main_commands: "string[]",
  renderer_screen: "string|null",
  evidence_test: "string|null",
  adr_or_issue: "string|null",
};
const OPTIONAL_ROW_KEYS = { note: "string" };

/**
 * Strict structural validation of the ledger (excess keys rejected, like
 * `onExcessProperty: "error"`). Scripts stay dependency-free, so this is the hand-rolled
 * counterpart of a `Schema.Struct` decode.
 * @param {unknown} ledger
 * @returns {string[]} problems
 */
export function validateLedgerShape(ledger) {
  const problems = [];
  if (typeof ledger !== "object" || ledger === null || Array.isArray(ledger)) {
    return ["ledger: must be an object"];
  }
  const top = /** @type {Record<string, unknown>} */ (ledger);
  for (const key of Object.keys(top)) {
    if (key !== "version" && key !== "capabilities") problems.push(`ledger: unknown key "${key}"`);
  }
  if (top.version !== LEDGER_VERSION) problems.push(`ledger: version must be ${LEDGER_VERSION}`);
  if (!Array.isArray(top.capabilities))
    return [...problems, "ledger: capabilities must be an array"];

  const seen = new Set();
  top.capabilities.forEach((entry, index) => {
    const label = `row[${index}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      problems.push(`${label}: must be an object`);
      return;
    }
    const rec = /** @type {Record<string, unknown>} */ (entry);
    const name = typeof rec.id === "string" && rec.id !== "" ? `"${rec.id}"` : label;
    for (const key of Object.keys(rec)) {
      if (!(key in ROW_KEYS) && !(key in OPTIONAL_ROW_KEYS)) {
        problems.push(`${name}: unknown key "${key}"`);
      }
    }
    for (const [key, type] of Object.entries(ROW_KEYS)) {
      if (!(key in rec)) {
        problems.push(`${name}: missing key "${key}"`);
        continue;
      }
      if (!matchesType(rec[key], type)) problems.push(`${name}: "${key}" must be ${type}`);
    }
    if ("note" in rec && typeof rec.note !== "string")
      problems.push(`${name}: "note" must be string`);
    if (typeof rec.id === "string") {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/u.test(rec.id))
        problems.push(`${name}: id must be kebab-case`);
      if (seen.has(rec.id)) problems.push(`${name}: duplicate id`);
      seen.add(rec.id);
    }
    if (typeof rec.status === "string" && !STATUSES.includes(rec.status)) {
      problems.push(`${name}: invalid status "${rec.status}"`);
    }
    if (typeof rec.engine_package === "string" && !PACKAGES.includes(rec.engine_package)) {
      problems.push(`${name}: unknown engine_package "${rec.engine_package}"`);
    }
  });
  return problems;
}

/** @param {unknown} value @param {string} type */
function matchesType(value, type) {
  if (type === "string") return typeof value === "string" && value.trim() !== "";
  if (type === "string|null")
    return value === null || (typeof value === "string" && value.trim() !== "");
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item !== "");
}

/**
 * Names in `export const CAMPAIGN_COMMAND_NAMES = [...] as const`.
 * @param {string} source
 * @returns {string[]}
 */
export function extractCommandNames(source) {
  const match = /CAMPAIGN_COMMAND_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/u.exec(source);
  if (match === null) return [];
  return [...match[1].matchAll(/["']([A-Za-z0-9]+)["']/gu)].map((m) => m[1]);
}

/**
 * Module keys (first path segment, extension stripped) of every `from "./x"` in an index.
 * @param {string} indexSource
 * @returns {Set<string>}
 */
export function extractModuleKeys(indexSource) {
  const keys = new Set();
  for (const m of indexSource.matchAll(/from\s+["']\.\/([^"']+)["']/gu)) keys.add(moduleKey(m[1]));
  return keys;
}

/** @param {string} path */
function moduleKey(path) {
  return path.split("/")[0].replace(/\.(js|ts)$/u, "");
}

/**
 * Exported `apply*` command verbs declared in a source file.
 * @param {string} source
 * @returns {Set<string>}
 */
export function extractApplyVerbs(source) {
  const verbs = new Set();
  for (const m of source.matchAll(/^export\s+(?:function|const)\s+(apply[A-Z]\w*)/gmu))
    verbs.add(m[1]);
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}\s*from/gmu)) {
    for (const name of m[1].split(",")) {
      const bare =
        name
          .trim()
          .split(/\s+as\s+/u)
          .pop() ?? "";
      if (/^apply[A-Z]\w*$/u.test(bare)) verbs.add(bare);
    }
  }
  return verbs;
}

/**
 * Screen ids the registry only registers under `DEBUG_MODE` or `import.meta.env.DEV`.
 * @param {string} registrySource
 * @returns {Set<string>}
 */
export function extractDebugOnlyScreens(registrySource) {
  const gated = new Set();
  for (const m of registrySource.matchAll(/(?:DEBUG_MODE|env\.DEV)\s*\?\s*\[([^\]]*)\]/gu)) {
    for (const name of m[1].split(",")) if (name.trim() !== "") gated.add(name.trim());
  }
  const ids = new Set();
  for (const name of gated) {
    const def = new RegExp(`const\\s+${name}\\b[\\s\\S]*?id:\\s*["']([^"']+)["']`, "u").exec(
      registrySource,
    );
    if (def !== null) ids.add(def[1]);
  }
  return ids;
}

const isTestFile = (path) => /\.(test|spec)\.[cm]?[jt]sx?$/u.test(path);
const isSource = (path) => /\.[cm]?[jt]sx?$/u.test(path) && !isTestFile(path);
const basenameNoExt = (path) => (path.split("/").pop() ?? "").replace(/\.[^.]+$/u, "");

/**
 * Run every ledger check against a repository port.
 * @param {{ ledger: any, repo: { exists(p: string): boolean, read(p: string): string | undefined, list(dir: string): string[] } }} input
 * @returns {{ ok: boolean, problems: string[], counts: Record<string, number> }}
 */
export function evaluateLedger({ ledger, repo }) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const problems = validateLedgerShape(ledger);
  if (problems.length > 0) return { ok: false, problems, counts };
  const rows = ledger.capabilities;
  for (const row of rows) counts[row.status]++;

  const names = extractCommandNames(repo.read(CONTRACT_PATH) ?? "");
  if (names.length === 0)
    problems.push(`could not read CAMPAIGN_COMMAND_NAMES from ${CONTRACT_PATH}`);
  const bridge = repo.read(BRIDGE_PATH) ?? "";
  const debugOnly = extractDebugOnlyScreens(repo.read(REGISTRY_PATH) ?? "");
  const rendererSources = repo.list(RENDERER_DIR).filter(isSource);
  const rendererText = new Map(rendererSources.map((p) => [p, repo.read(p) ?? ""]));
  const adrFiles = repo.list("docs/adr");

  const surface = readSurface(repo);
  for (const row of rows)
    checkRow(row, { problems, repo, names, bridge, debugOnly, rendererText, adrFiles, surface });
  checkCoverage(rows, surface, names, problems);
  return { ok: problems.length === 0, problems, counts };
}

/** @param {{ exists(p: string): boolean, read(p: string): string | undefined, list(dir: string): string[] }} repo */
function readSurface(repo) {
  const combatModules = new Set(extractModuleKeys(repo.read("packages/combat/src/index.ts") ?? ""));
  for (const file of repo.list("packages/combat/src")) {
    const rest = file.slice("packages/combat/src/".length);
    if (rest !== "index.ts" && isSource(file)) combatModules.add(moduleKey(rest));
  }
  const phaseModules = extractModuleKeys(repo.read("packages/phase-engine/src/index.ts") ?? "");
  const phaseVerbs = new Set();
  for (const file of repo.list("packages/phase-engine/src").filter(isSource)) {
    for (const verb of extractApplyVerbs(repo.read(file) ?? "")) phaseVerbs.add(verb);
  }
  return { combatModules, phaseModules, phaseVerbs };
}

function checkRow(row, ctx) {
  const { problems, repo, names, bridge, debugOnly, rendererText, adrFiles, surface } = ctx;
  const id = `"${row.id}"`;
  if (row.status === "unclassified") problems.push(`${id}: unclassified rows must be triaged`);

  for (const cmd of row.main_commands) {
    if (!names.includes(cmd))
      problems.push(`${id}: command "${cmd}" is not in CAMPAIGN_COMMAND_NAMES`);
  }

  // Engine entries must exist (stale-row detection).
  const modulePool = { combat: surface.combatModules, "phase-engine": surface.phaseModules }[
    row.engine_package
  ];
  if (row.engine_modules.length > 0 && modulePool === undefined) {
    problems.push(`${id}: engine_modules is only valid for combat and phase-engine`);
  }
  for (const mod of row.engine_modules) {
    if (modulePool !== undefined && !modulePool.has(mod)) {
      problems.push(`${id}: ${row.engine_package} module "${mod}" does not exist`);
    }
  }
  if (row.engine_symbols.length > 0 && row.engine_package === "combat") {
    problems.push(`${id}: combat rows classify modules, not symbols`);
  }
  for (const sym of row.engine_symbols) {
    if (row.engine_package === "phase-engine" && !surface.phaseVerbs.has(sym)) {
      problems.push(`${id}: phase-engine symbol "${sym}" does not exist`);
    } else if (row.engine_package === "campaign-engine" || row.engine_package === "desktop") {
      const dirs =
        row.engine_package === "desktop" ? ["apps/desktop/src"] : ["packages/campaign-engine/src"];
      const found = dirs.some((d) =>
        repo
          .list(d)
          .some((f) => isSource(f) && new RegExp(`\\b${sym}\\b`, "u").test(repo.read(f) ?? "")),
      );
      if (!found) problems.push(`${id}: ${row.engine_package} symbol "${sym}" does not exist`);
    }
  }

  if (row.status !== "dormant-by-decision" && row.adr_or_issue !== null) {
    problems.push(`${id}: adr_or_issue is only valid on dormant-by-decision rows`);
  }
  if (row.status !== "reachable" && (row.renderer_screen !== null || row.evidence_test !== null)) {
    problems.push(`${id}: only reachable rows may set renderer_screen or evidence_test`);
  }
  if (row.status === "dormant-by-decision") checkCitation(row, repo, adrFiles, problems);
  if (row.status === "reachable")
    checkReachable(row, { problems, repo, names, bridge, debugOnly, rendererText });
}

function checkCitation(row, repo, adrFiles, problems) {
  const id = `"${row.id}"`;
  const cite = row.adr_or_issue;
  if (cite === null) {
    problems.push(`${id}: dormant-by-decision requires adr_or_issue`);
    return;
  }
  if (!/^(ADR-\d{4}|#\d+)(, (ADR-\d{4}|#\d+))*$/u.test(cite)) {
    problems.push(`${id}: adr_or_issue must cite ADR-NNNN or #N (comma separated), got "${cite}"`);
    return;
  }
  for (const adr of cite.match(/ADR-\d{4}/gu) ?? []) {
    if (!adrFiles.some((f) => f.startsWith(`docs/adr/${adr}-`))) {
      problems.push(`${id}: ${adr} does not exist in docs/adr`);
    }
  }
}

function checkReachable(row, { problems, repo, names, bridge, debugOnly, rendererText }) {
  const id = `"${row.id}"`;
  if (row.main_commands.length === 0)
    problems.push(`${id}: reachable requires at least one main command`);
  for (const cmd of row.main_commands) {
    if (!names.includes(cmd)) continue;
    if (!new RegExp(`(^|\\s)${cmd}:\\s`, "mu").test(bridge)) {
      problems.push(`${id}: command "${cmd}" has no handler in ${BRIDGE_PATH}`);
    }
    const called = [...rendererText.values()].some((text) =>
      new RegExp(`["'\`]${cmd}["'\`]`, "u").test(text),
    );
    if (!called) problems.push(`${id}: command "${cmd}" is never called by renderer source`);
  }

  const screen = row.renderer_screen;
  if (screen === null) {
    problems.push(`${id}: reachable requires renderer_screen`);
  } else {
    if (!repo.exists(`${RENDERER_DIR}/${screen}`)) {
      problems.push(`${id}: renderer_screen not found: ${RENDERER_DIR}/${screen}`);
    }
    const segment = /^screens\/([^/]+)\//u.exec(screen)?.[1];
    if (segment !== undefined && debugOnly.has(segment)) {
      problems.push(
        `${id}: renderer_screen "${screen}" is debug-only or dev-only, so it cannot make a row reachable`,
      );
    }
  }

  const evidence = row.evidence_test;
  if (evidence === null) {
    problems.push(`${id}: reachable requires evidence_test`);
    return;
  }
  if (!repo.exists(evidence)) {
    problems.push(`${id}: evidence_test not found: ${evidence}`);
  } else if (!isTestFile(evidence)) {
    problems.push(`${id}: evidence_test "${evidence}" is not a test file`);
  } else {
    const text = repo.read(evidence) ?? "";
    const cites = [...row.main_commands, ...(screen === null ? [] : [basenameNoExt(screen)])];
    if (!cites.some((c) => text.includes(c))) {
      problems.push(
        `${id}: evidence_test "${evidence}" does not mention any of: ${cites.join(", ")}`,
      );
    }
  }
}

function checkCoverage(rows, surface, names, problems) {
  /** @type {Array<[string, string, Iterable<string>, (r: any) => string[]]>} */
  const kinds = [
    ["combat module", "combat", surface.combatModules, (r) => r.engine_modules],
    ["phase-engine module", "phase-engine", surface.phaseModules, (r) => r.engine_modules],
    ["phase-engine verb", "phase-engine", surface.phaseVerbs, (r) => r.engine_symbols],
  ];
  for (const [label, pkg, all, pick] of kinds) {
    const owners = new Map();
    for (const row of rows.filter((r) => r.engine_package === pkg)) {
      for (const item of pick(row)) owners.set(item, [...(owners.get(item) ?? []), row.id]);
    }
    for (const item of [...all].sort()) {
      if (!owners.has(item)) problems.push(`${label} "${item}" is not classified in the ledger`);
    }
    for (const [item, ids] of owners) {
      if (ids.length > 1)
        problems.push(`${label} "${item}" is classified by more than one row: ${ids.join(", ")}`);
    }
  }
  const referenced = new Set(rows.flatMap((r) => r.main_commands));
  for (const name of names) {
    if (!referenced.has(name))
      problems.push(`command "${name}" is not referenced by any ledger row`);
  }
}

/**
 * Deterministic markdown report generated from the ledger.
 * @param {{ capabilities: any[] }} ledger
 * @returns {string}
 */
export function renderReport(ledger) {
  const rows = ledger.capabilities;
  const count = (s) => rows.filter((r) => r.status === s).length;
  const out = [
    "# Reachability report",
    "",
    `Generated from \`${LEDGER_PATH}\` by \`node scripts/verify-reachability-ledger.mjs --write\`; do not edit.`,
    "Rules and statuses: ADR-0267.",
    "",
    "| Status | Rows |",
    "| --- | --- |",
    ...STATUSES.filter((s) => s !== "unclassified").map((s) => `| ${s} | ${count(s)} |`),
    "",
  ];
  const section = (title, status, columns, cells) => {
    const list = rows.filter((r) => r.status === status);
    if (list.length === 0) return;
    out.push(
      `## ${title}`,
      "",
      `| ${columns.join(" | ")} |`,
      `| ${columns.map(() => "---").join(" | ")} |`,
    );
    for (const r of list) out.push(`| ${cells(r).join(" | ")} |`);
    out.push("");
  };
  const cmds = (r) =>
    r.main_commands.length === 0 ? "-" : r.main_commands.map((c) => `\`${c}\``).join(", ");
  section("Reachable", "reachable", ["Row", "Player verb", "Screen", "Evidence"], (r) => [
    r.id,
    r.player_verb,
    `\`${r.renderer_screen}\``,
    `\`${r.evidence_test}\``,
  ]);
  section("Dormant by decision", "dormant-by-decision", ["Row", "Player verb", "Decision"], (r) => [
    r.id,
    r.player_verb,
    r.adr_or_issue,
  ]);
  section("Internal", "internal", ["Row", "Capability", "Commands"], (r) => [
    r.id,
    r.player_verb,
    cmds(r),
  ]);
  return `${out.join("\n")}\n`;
}

/**
 * The report is generated; drift from the ledger fails the gate.
 * @param {{ capabilities: any[] }} ledger
 * @param {string | undefined} current
 * @returns {string[]}
 */
export function checkReportFresh(ledger, current) {
  return current === renderReport(ledger)
    ? []
    : [
        `${REPORT_PATH} is out of date; run \`node scripts/verify-reachability-ledger.mjs --write\``,
      ];
}

function realRepo() {
  const abs = (p) => resolve(ROOT, p);
  return {
    exists: (p) => existsSync(abs(p)),
    read: (p) => (existsSync(abs(p)) ? readFileSync(abs(p), "utf8") : undefined),
    list: (dir) => {
      if (!existsSync(abs(dir))) return [];
      return readdirSync(abs(dir), { recursive: true, withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) =>
          `${dir}/${resolve(d.parentPath, d.name).slice(abs(dir).length + 1)}`.replaceAll(
            "\\",
            "/",
          ),
        )
        .filter((p) => !p.includes("/node_modules/") && !p.includes("/dist/"))
        .sort();
    },
  };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const repo = realRepo();
  const ledger = JSON.parse(repo.read(LEDGER_PATH) ?? "null");
  const result = evaluateLedger({ ledger, repo });
  if (process.argv.includes("--write") && result.ok) {
    writeFileSync(resolve(ROOT, REPORT_PATH), renderReport(ledger));
  }
  const problems = [...result.problems];
  if (result.ok) problems.push(...checkReportFresh(ledger, repo.read(REPORT_PATH)));
  for (const problem of problems) console.error(`reachability ledger: ${problem}`);
  if (problems.length === 0) {
    const line = Object.entries(result.counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ");
    console.log(`reachability ledger: ok (${line})`);
  }
  process.exit(problems.length === 0 ? 0 : 1);
}
