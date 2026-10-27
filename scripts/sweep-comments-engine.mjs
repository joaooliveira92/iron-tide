// Report-first comment classifier behind scripts/sweep-comments.mjs. Classifier
// output (candidates) is kept apart from human review (reviews): regenerating a
// report can never fabricate or erase an approval, and --apply only acts on an
// explicit APPROVE whose candidateId and contextHash still match the live source.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as nodeFs from "node:fs";
import path from "node:path";

import { RUNTIME_FREE_ROOTS } from "./assert-runtime-free.mjs";
import { toPosixPath } from "./lib/paths.mjs";

export const SCHEMA_VERSION = 1;
export const RULES = ["determinism-pure-restatement", "name-restating-doc", "scratch-reasoning"];
export const CLASSES = ["AUTO_EXCLUDE", "REVIEW_REQUIRED", "HIGH_CONFIDENCE_CANDIDATE"];
export const DECISIONS = ["APPROVE", "REJECT", "DEFER"];
export const EXIT = { OK: 0, VALIDATION: 1, USAGE: 2, IO: 3 };

const EXTS = new Set([".ts", ".tsx", ".mjs", ".cjs"]);
export const SKIP_DIRS = new Set(["node_modules", "dist", "generated", "vendor", "repos"]);
const CONTEXT_RADIUS = 3;

export class CliError extends Error {
  /** @param {number} exitCode @param {string} message */
  constructor(exitCode, message) {
    super(message);
    this.exitCode = exitCode;
  }
}
const usage = (m) => new CliError(EXIT.USAGE, m);
const invalid = (m) => new CliError(EXIT.VALIDATION, m);

const sha = (s) => `sha256:${createHash("sha256").update(s).digest("hex")}`;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const REFERENCE_CASE = /(DESIGN|ADR|§|AC-|INC|BW-|SPM|SB3-|CAH-|MIG-|IMP-|MIGRATION|RFC)/;
const REFERENCE_ANY = /(\bticket\b|\bspec\b|\bissue\b|https?:\/\/|#\d+|\blicen[sc]e\b|\(c\))/i;
const UNIT =
  /(\b(ms|kg|km|mm|cm|px|bp|bps|kn|knots?|tons?|tonnes?|metres?|meters?|degrees?|percent|permille|bytes?|seconds?|minutes?|hours?|micrometres?|newtons?)\b|[‰%°])/i;
const ORDERING =
  /\b(before|after|then|first|last|earlier|later|order|ordered|sort|sorted|tie|stable|precede[sd]?|follow(s|ed)?|until|once)\b/i;
const EXCLUSIVE =
  /\b(only|exclusive(ly)?|never|must|always|because|unless|except|since|otherwise|required?|caller|boundary)\b/i;

/** @param {string} text */
export function signalsOf(text) {
  return {
    hasDigit: /\d/.test(text),
    hasUnit: UNIT.test(text),
    hasReference: REFERENCE_CASE.test(text) || REFERENCE_ANY.test(text),
    hasOrderingLanguage: ORDERING.test(text),
    hasExclusiveLanguage: EXCLUSIVE.test(text),
  };
}
const anySignal = (s) => Object.values(s).some(Boolean);

const stripCr = (l) => l.replace(/\r$/, "");
const WHOLE_LINE_COMMENT = /^(\s*)\/\/(.*)$/;
const ONE_LINE_DOC = /^(\s*)\/\*\*\s*([^*@][^*]*?)\s*\*\/\s*$/;
const DECL =
  /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/;
const MEMBER =
  /^\s+(?:(?:readonly|public|private|protected|static)\s+)*([A-Za-z_$][\w$]*)\??\s*[:(]/;
const NOT_MEMBER = new Set([
  "if",
  "for",
  "while",
  "switch",
  "return",
  "catch",
  "function",
  "await",
]);

function declarationName(line) {
  const d = DECL.exec(line);
  if (d) return d[1];
  const m = MEMBER.exec(line);
  if (m && !NOT_MEMBER.has(m[1])) return m[1];
  return null;
}

function enclosingDeclaration(lines, index) {
  const indent = /^\s*/.exec(lines[index])[0].length;
  for (let i = index - 1; i >= 0; i--) {
    const d = DECL.exec(lines[i]);
    if (d && /^\s*/.exec(lines[i])[0].length <= indent) return d[1];
  }
  return "<module>";
}

const DETERMINISM_ALLOWED = new Set([
  "pure",
  "deterministic",
  "function",
  "functions",
  "no",
  "without",
  "ambient",
  "i",
  "o",
  "io",
  "clock",
  "random",
  "randomness",
  "date",
  "time",
  "or",
  "and",
  "network",
]);
const DETERMINISM_EXCLUDING = new Set([
  "only",
  "keyed",
  "seed",
  "seeded",
  "stream",
  "streams",
  "order",
  "ordering",
  "sort",
  "sorted",
  "tie",
  "round",
  "rounding",
  "floor",
  "fixed",
  "hash",
  "hashed",
  "hashing",
  "replay",
  "caller",
  "boundary",
  "must",
  "because",
  "unless",
  "except",
  "injected",
  "integer",
  "serialization",
]);
const OPEN_TAIL = new Set(["and", "or", "no", "without"]);

const gateCovers = (relPath) =>
  !/\.(test|spec)\.[cm]?[jt]sx?$/.test(relPath) &&
  RUNTIME_FREE_ROOTS.some((root) => relPath.startsWith(`${root}/`));

function determinismCandidate(relPath, lines, i) {
  if (!gateCovers(relPath)) return null;
  const m = WHOLE_LINE_COMMENT.exec(stripCr(lines[i]));
  if (!m || !/^\s*(pure|deterministic)\b/i.test(m[2])) return null;
  const text = m[2].trim();
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ");
  const prev = i > 0 ? WHOLE_LINE_COMMENT.exec(stripCr(lines[i - 1])) : null;
  const continuation =
    /[,:;-]$/.test(text) ||
    OPEN_TAIL.has(tokens[tokens.length - 1]) ||
    (prev && !/[.!?]\s*$/.test(prev[2]));
  const excluding = tokens.find((t) => DETERMINISM_EXCLUDING.has(t));
  const allAllowed = tokens.every((t) => DETERMINISM_ALLOWED.has(t));
  const negated = tokens.includes("no") || tokens.includes("without");
  if (excluding)
    return {
      enclosing: null,
      classification: "AUTO_EXCLUDE",
      reason: `claims beyond the gate: "${excluding}"`,
      action: "keep",
    };
  if (!allAllowed || !negated)
    return {
      enclosing: null,
      classification: "REVIEW_REQUIRED",
      reason: "extra content beyond a bare prohibition",
      action: "review",
    };
  if (continuation)
    return {
      enclosing: null,
      classification: "REVIEW_REQUIRED",
      reason: "part of a multi-line comment",
      action: "review",
    };
  return {
    enclosing: null,
    classification: "HIGH_CONFIDENCE_CANDIDATE",
    reason: "restates the authoritative-determinism gate",
    action: "delete",
  };
}

const ARTICLES = new Set(["a", "an", "the"]);
const VERBS = new Map([
  ["get", "get"],
  ["gets", "get"],
  ["create", "create"],
  ["creates", "create"],
  ["calculate", "calculate"],
  ["calculates", "calculate"],
]);

/** @param {string} identifier */
export function identifierWords(identifier) {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_$]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** @param {string} doc */
export function docWords(doc) {
  return doc
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !ARTICLES.has(w));
}

const canonicalVerb = (words) =>
  words.length && VERBS.has(words[0]) ? [VERBS.get(words[0]), ...words.slice(1)] : words;

/** True only when the doc says nothing the declaration name does not. */
export function restatesName(doc, name) {
  const d = canonicalVerb(docWords(doc));
  const n = canonicalVerb(identifierWords(name).filter((w) => !ARTICLES.has(w)));
  return d.length > 0 && d.length === n.length && d.every((w, k) => w === n[k]);
}

function nameDocCandidate(lines, i) {
  const m = ONE_LINE_DOC.exec(stripCr(lines[i]));
  if (!m || i + 1 >= lines.length) return null;
  const name = declarationName(stripCr(lines[i + 1]));
  if (!name || !restatesName(m[2], name)) return null;
  return {
    enclosing: name,
    classification: "HIGH_CONFIDENCE_CANDIDATE",
    reason: "doc only restates the declaration name",
    action: "delete",
    signalText: m[2],
  };
}

const SCRATCH = [/\bhmm+\b/i, /\bthis is complex\b/i, /\bnot sure\b/i, /\bmaybe\b/i];
function scratchCandidate(lines, i) {
  const line = stripCr(lines[i]);
  const m = WHOLE_LINE_COMMENT.exec(line) ?? /^\s*\*\s?(.*)$/.exec(line);
  if (!m || !SCRATCH.some((re) => re.test(m[2] ?? m[1]))) return null;
  return {
    enclosing: null,
    classification: "REVIEW_REQUIRED",
    reason: "deliberative phrasing; needs a semantic rewrite, not a delete",
    action: "review",
  };
}

const RULE_FNS = {
  "determinism-pure-restatement": (p, lines, i) => determinismCandidate(p, lines, i),
  "name-restating-doc": (_p, lines, i) => nameDocCandidate(lines, i),
  "scratch-reasoning": (_p, lines, i) => scratchCandidate(lines, i),
};

function contextHashOf(lines, i) {
  const from = Math.max(0, i - CONTEXT_RADIUS);
  const to = Math.min(lines.length, i + CONTEXT_RADIUS + 1);
  const window = lines
    .slice(from, to)
    .map((l) => stripCr(l).trimEnd())
    .join("\n");
  return sha(`${stripCr(lines[i]).trim()}\n${window}`);
}

/**
 * Pure: classify one file's text for the requested rules.
 * @param {string} relPath repository-relative, forward slashes
 * @param {string} src
 * @param {string[]} rules
 */
export function classifyFile(relPath, src, rules) {
  const lines = src.split("\n");
  const found = [];
  for (const rule of RULES.filter((r) => rules.includes(r))) {
    for (let i = 0; i < lines.length; i++) {
      const hit = RULE_FNS[rule](relPath, lines, i);
      if (!hit) continue;
      const originalText = stripCr(lines[i]).trim();
      const signals = signalsOf(hit.signalText ?? originalText);
      let classification = hit.classification;
      if (classification === "HIGH_CONFIDENCE_CANDIDATE" && anySignal(signals))
        classification = "REVIEW_REQUIRED";
      found.push({
        index: i,
        rule,
        originalText,
        enclosing: hit.enclosing ?? enclosingDeclaration(lines, i),
        classification,
        reason: hit.reason,
        signals,
        proposedAction:
          classification === "HIGH_CONFIDENCE_CANDIDATE"
            ? hit.action
            : classification === "AUTO_EXCLUDE"
              ? "keep"
              : "review",
        contextHash: contextHashOf(lines, i),
      });
    }
  }
  const seen = new Map();
  return found
    .toSorted((a, b) => a.index - b.index || cmp(a.rule, b.rule))
    .map((c) => {
      const normalized = c.originalText.replace(/\s+/g, " ");
      const key = `${c.rule}|${normalized}|${c.enclosing}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      return {
        candidateId: sha(`${SCHEMA_VERSION}|${key}|${relPath}|${n}`),
        path: relPath,
        line: c.index + 1,
        rule: c.rule,
        classification: c.classification,
        originalText: c.originalText,
        contextHash: c.contextHash,
        signals: c.signals,
        reason: c.reason,
        proposedAction: c.proposedAction,
        enclosing: c.enclosing,
      };
    });
}

const isMissing = (e) => e?.code === "ENOENT" || e?.code === "ENOTDIR";
const toPosix = toPosixPath;
const inside = (root, abs) => {
  const rel = path.relative(root, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/** Resolve --scope to a repository-relative path, refusing escapes and symlinks out. */
export function resolveScope(repoRoot, scope, fs = nodeFs) {
  let realRoot;
  let realScope;
  try {
    realRoot = fs.realpathSync(repoRoot);
    realScope = fs.realpathSync(path.resolve(repoRoot, scope));
  } catch (e) {
    if (isMissing(e)) throw usage(`--scope does not exist: ${scope}`);
    throw e;
  }
  if (!inside(realRoot, realScope)) throw usage(`--scope escapes the repository: ${scope}`);
  return { realRoot, realScope, rel: toPosix(path.relative(realRoot, realScope)) || "." };
}

function walk(fs, dir, out) {
  for (const name of fs.readdirSync(dir).toSorted(cmp)) {
    const full = path.join(dir, name);
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(fs, full, out);
    } else if (EXTS.has(path.extname(name))) {
      out.push(full);
    }
  }
}

export function scanScope(repoRoot, scope, rules, fs = nodeFs) {
  const { realRoot, realScope, rel } = resolveScope(repoRoot, scope, fs);
  const files = [];
  const st = fs.lstatSync(realScope);
  if (st.isDirectory()) walk(fs, realScope, files);
  else if (EXTS.has(path.extname(realScope))) files.push(realScope);
  const candidates = [];
  for (const abs of files) {
    const relPath = toPosix(path.relative(realRoot, abs));
    candidates.push(...classifyFile(relPath, fs.readFileSync(abs, "utf8"), rules));
  }
  const ordered = candidates.toSorted(
    (a, b) =>
      cmp(a.path, b.path) || a.line - b.line || RULES.indexOf(a.rule) - RULES.indexOf(b.rule),
  );
  return {
    scope: rel,
    files: files.map((f) => toPosix(path.relative(realRoot, f))),
    candidates: ordered,
  };
}

const CANDIDATE_KEYS = [
  "candidateId",
  "path",
  "line",
  "rule",
  "classification",
  "originalText",
  "contextHash",
  "signals",
  "reason",
  "enclosing",
  "proposedAction",
];
const SIGNAL_KEYS = [
  "hasDigit",
  "hasUnit",
  "hasReference",
  "hasOrderingLanguage",
  "hasExclusiveLanguage",
];

const ordered = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

export function buildReport({ commit, scope, rules, candidates, reviews = {} }) {
  const ids = new Set(candidates.map((c) => c.candidateId));
  const kept = Object.keys(reviews)
    .filter((id) => ids.has(id))
    .toSorted(cmp);
  return {
    schemaVersion: SCHEMA_VERSION,
    source: { commit, scope, rules: RULES.filter((r) => rules.includes(r)) },
    candidates: candidates.map((c) => ({
      ...ordered(c, CANDIDATE_KEYS),
      signals: ordered(c.signals, SIGNAL_KEYS),
    })),
    reviews: Object.fromEntries(kept.map((id) => [id, { decision: reviews[id].decision }])),
  };
}

export const serializeReport = (report) => `${JSON.stringify(report, null, 2)}\n`;

export function summarize(candidates) {
  const counts = {};
  for (const c of candidates) {
    const k = `${c.rule}\t${c.classification}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Object.keys(counts)
    .toSorted(cmp)
    .map((k) => `${k}\t${counts[k]}`);
}

function parseReport(text) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    throw invalid("report is not valid JSON");
  }
  if (report?.schemaVersion !== SCHEMA_VERSION)
    throw invalid(`unsupported report schemaVersion: ${String(report?.schemaVersion)}`);
  if (
    !Array.isArray(report.candidates) ||
    typeof report.reviews !== "object" ||
    report.reviews === null
  )
    throw invalid("report is missing candidates or reviews");
  if (typeof report.source?.scope !== "string" || !Array.isArray(report.source?.rules))
    throw invalid("report is missing source.scope or source.rules");
  return report;
}

function removalSet(lines, indexes) {
  const drop = new Set(indexes);
  const blank = (k) => k >= 0 && k < lines.length && lines[k].trim() === "";
  for (const i of [...indexes].toSorted((a, b) => a - b)) {
    if ((i === 0 || (blank(i - 1) && !drop.has(i - 1))) && blank(i + 1)) drop.add(i + 1);
  }
  return drop;
}

/**
 * Validate a reviewed report against the live tree and compute every edit in
 * memory. Throws before any write if any approved candidate is stale or unsafe.
 */
export function planApply(report, repoRoot, fs = nodeFs) {
  const { realRoot, realScope, rel: scopeRel } = resolveScope(repoRoot, report.source.scope, fs);
  for (const r of report.source.rules)
    if (!RULES.includes(r)) throw invalid(`unknown rule in report: ${String(r)}`);
  const byId = new Map();
  for (const c of report.candidates) {
    if (byId.has(c.candidateId)) throw invalid(`duplicate candidate: ${c.candidateId}`);
    if (!RULES.includes(c.rule) || !report.source.rules.includes(c.rule))
      throw invalid(`unknown rule on candidate: ${String(c.rule)}`);
    byId.set(c.candidateId, c);
  }
  for (const id of Object.keys(report.reviews)) {
    if (!byId.has(id)) throw invalid(`review references an unknown candidate: ${id}`);
    if (!DECISIONS.includes(report.reviews[id]?.decision))
      throw invalid(`invalid review decision for ${id}`);
  }
  const approved = report.candidates.filter(
    (c) => report.reviews[c.candidateId]?.decision === "APPROVE",
  );
  if (approved.length === 0) throw invalid("no candidate carries an APPROVE decision");

  const perFile = new Map();
  for (const c of approved) {
    if (c.classification !== "HIGH_CONFIDENCE_CANDIDATE")
      throw invalid(
        `only HIGH_CONFIDENCE_CANDIDATE can be applied: ${c.candidateId} is ${c.classification}`,
      );
    if (typeof c.path !== "string" || path.isAbsolute(c.path) || c.path.split("/").includes(".."))
      throw invalid(`unsafe candidate path: ${String(c.path)}`);
    const abs = path.resolve(realRoot, c.path);
    let real;
    try {
      if (fs.lstatSync(abs).isSymbolicLink())
        throw invalid(`candidate path is a symlink: ${c.path}`);
      real = fs.realpathSync(abs);
    } catch (e) {
      if (isMissing(e)) throw invalid(`candidate file no longer exists: ${c.path}`);
      throw e;
    }
    if (!inside(realRoot, real) || !inside(realScope, real))
      throw invalid(`candidate path is outside the report scope (${scopeRel}): ${c.path}`);
    if (toPosix(path.relative(realRoot, real)) !== c.path)
      throw invalid(`non-canonical candidate path: ${c.path}`);
    if (!perFile.has(real)) perFile.set(real, []);
    perFile.get(real).push(c);
  }

  const changes = [];
  for (const [abs, cands] of [...perFile].toSorted((a, b) => cmp(a[0], b[0]))) {
    const original = fs.readFileSync(abs);
    const src = original.toString("utf8");
    const rel = toPosix(path.relative(realRoot, abs));
    const live = classifyFile(rel, src, [...new Set(cands.map((c) => c.rule))]);
    const lines = src.split("\n");
    const indexes = [];
    for (const c of cands) {
      const hit = live.find((l) => l.candidateId === c.candidateId);
      if (!hit) throw invalid(`stale candidate (no longer found): ${c.candidateId} in ${rel}`);
      if (hit.contextHash !== c.contextHash || hit.originalText !== c.originalText)
        throw invalid(`stale candidate (context changed): ${c.candidateId} in ${rel}`);
      if (hit.classification !== "HIGH_CONFIDENCE_CANDIDATE")
        throw invalid(`candidate is no longer high confidence: ${c.candidateId} in ${rel}`);
      indexes.push(hit.line - 1);
    }
    const drop = removalSet(lines, indexes);
    const kept = lines.filter((_, k) => !drop.has(k));
    for (const k of drop) {
      if (!indexes.includes(k) && lines[k].trim() !== "")
        throw invalid(`refusing to remove an unapproved line in ${rel}`);
    }
    if (kept.length !== lines.length - drop.size)
      throw invalid(`internal line accounting mismatch in ${rel}`);
    changes.push({
      abs,
      rel,
      original,
      content: Buffer.from(kept.join("\n"), "utf8"),
      mode: fs.statSync(abs).mode,
      removed: drop.size,
    });
  }
  return changes;
}

const tempFor = (abs, tag) =>
  path.join(path.dirname(abs), `.${path.basename(abs)}.sweep-${String(process.pid)}-${tag}.tmp`);

/** Write every change via same-directory temp files + rename; restore all on failure. */
export function commitChanges(changes, fs = nodeFs) {
  const temps = [];
  const renamed = [];
  try {
    changes.forEach((c, k) => {
      const t = tempFor(c.abs, String(k));
      fs.writeFileSync(t, c.content, { mode: c.mode });
      temps.push(t);
    });
    changes.forEach((c, k) => {
      fs.renameSync(temps[k], c.abs);
      renamed.push(k);
    });
  } catch (cause) {
    const failures = [];
    for (const k of renamed) {
      try {
        const t = tempFor(changes[k].abs, `restore${String(k)}`);
        fs.writeFileSync(t, changes[k].original, { mode: changes[k].mode });
        fs.renameSync(t, changes[k].abs);
      } catch {
        failures.push(changes[k].rel);
      }
    }
    for (const t of temps) {
      try {
        fs.unlinkSync(t);
      } catch {
        /* already renamed or never written */
      }
    }
    const tail = failures.length ? ` (could not restore: ${failures.join(", ")})` : "";
    throw new CliError(
      EXIT.IO,
      `write failed, changes rolled back${tail}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

const SINGLE = ["--scope", "--report", "--format", "--review", "--decision"];
const REPEAT = ["--rule", "--id"];
const BOOL = ["--apply", "--fail-on-candidate"];
export const NEW_FLAGS = [...SINGLE, ...REPEAT, ...BOOL];

export function parseArgs(argv) {
  const opts = { rules: [], ids: [], apply: false, failOnCandidate: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (BOOL.includes(a)) {
      if (a === "--apply") opts.apply = true;
      else opts.failOnCandidate = true;
    } else if (SINGLE.includes(a) || REPEAT.includes(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw usage(`${a} needs a value`);
      if (REPEAT.includes(a)) opts[a === "--rule" ? "rules" : "ids"].push(v);
      else {
        const key = a.slice(2);
        if (opts[key] !== undefined) throw usage(`duplicate ${a}`);
        opts[key] = v;
      }
    } else throw usage(`unknown argument: ${a}`);
  }
  opts.format ??= "text";
  if (!["json", "text"].includes(opts.format))
    throw usage(`unsupported --format: ${String(opts.format)}`);
  for (const r of opts.rules) if (!RULES.includes(r)) throw usage(`unknown --rule: ${String(r)}`);
  if (new Set(opts.rules).size !== opts.rules.length) throw usage("duplicate --rule");
  if (opts.rules.length === 0) opts.rules = [...RULES];
  if (opts.review) {
    if (opts.apply || opts.scope)
      throw usage("--review cannot be combined with --apply or --scope");
    if (!DECISIONS.includes(opts.decision))
      throw usage(`--decision must be one of ${DECISIONS.join(", ")}`);
    if (opts.ids.length === 0) throw usage("--review needs at least one --id");
  } else if (opts.apply) {
    if (!opts.report) {
      throw usage(
        [
          "--apply requires --report <reviewed-report.json>.",
          "Generate a report, record review decisions, and apply that report.",
          "",
          "Example:",
          "  pnpm sweep:comments --scope packages/combat \\",
          "    --report /tmp/prune-comments/combat.json \\",
          "    --format json",
          "",
          "  pnpm sweep:comments --review /tmp/prune-comments/combat.json \\",
          "    --decision APPROVE --id <candidateId>",
          "",
          "  pnpm sweep:comments --apply \\",
          "    --report /tmp/prune-comments/combat.json",
        ].join("\n"),
      );
    }
    if (opts.scope) throw usage("--apply takes its scope from the report");
  } else if (!opts.scope) throw usage("--scope is required");
  return opts;
}

/** Canonical form of a possibly-not-yet-existing file path, so aliases compare equal. */
export function canonicalTarget(wanted, fs = nodeFs) {
  try {
    return fs.realpathSync(wanted);
  } catch {
    try {
      return path.join(fs.realpathSync(path.dirname(wanted)), path.basename(wanted));
    } catch {
      return wanted;
    }
  }
}

function gitCommit(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short=8", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Run the CLI. Returns the exit code; never calls process.exit.
 * @param {string[]} argv
 * @param {{ repoRoot: string, fs?: typeof nodeFs, stdout?: (s: string) => void, stderr?: (s: string) => void, commit?: string }} env
 */
export function runCli(argv, env) {
  const fs = env.fs ?? nodeFs;
  const out = env.stdout ?? ((s) => process.stdout.write(s));
  const err = env.stderr ?? ((s) => process.stderr.write(s));
  try {
    const opts = parseArgs(argv);
    const readReport = () => {
      try {
        return parseReport(fs.readFileSync(path.resolve(opts.report ?? opts.review), "utf8"));
      } catch (e) {
        if (e instanceof CliError) throw e;
        throw new CliError(EXIT.IO, `cannot read report: ${opts.report ?? opts.review}`);
      }
    };

    if (opts.review) {
      const report = readReport();
      const known = new Map(report.candidates.map((c) => [c.candidateId, c]));
      for (const id of opts.ids) {
        const c = known.get(id);
        if (!c) throw invalid(`unknown candidate: ${String(id)}`);
        if (opts.decision === "APPROVE" && c.classification !== "HIGH_CONFIDENCE_CANDIDATE")
          throw invalid(`cannot approve ${String(c.classification)}: ${String(id)}`);
        report.reviews[id] = { decision: opts.decision };
      }
      const sorted = {
        ...report,
        reviews: Object.fromEntries(
          Object.keys(report.reviews)
            .toSorted(cmp)
            .map((k) => [k, report.reviews[k]]),
        ),
      };
      fs.writeFileSync(path.resolve(opts.review), serializeReport(sorted));
      err(`recorded ${opts.decision} for ${String(opts.ids.length)} candidate(s)\n`);
      return EXIT.OK;
    }

    if (opts.apply) {
      const report = readReport();
      if (report.source.commit !== (env.commit ?? gitCommit(env.repoRoot)))
        err(
          "note: report was generated at a different commit; every approved candidate is revalidated against the live source\n",
        );
      const changes = planApply(report, env.repoRoot, fs);
      commitChanges(changes, fs);
      err(
        `applied ${String(changes.reduce((n, c) => n + c.removed, 0))} line removal(s) in ${String(changes.length)} file(s)\n`,
      );
      return EXIT.OK;
    }

    const { scope, files, candidates } = scanScope(env.repoRoot, opts.scope, opts.rules, fs);
    if (opts.report) {
      const { realRoot } = resolveScope(env.repoRoot, scope, fs);
      const target = canonicalTarget(path.resolve(opts.report), fs);
      if (files.some((f) => path.resolve(realRoot, f) === target))
        throw usage("--report overlaps a scanned source file");
    }
    let reviews = {};
    if (opts.report && fs.existsSync(path.resolve(opts.report))) {
      try {
        reviews = parseReport(fs.readFileSync(path.resolve(opts.report), "utf8")).reviews;
      } catch (e) {
        if (e instanceof CliError)
          throw invalid(`refusing to overwrite ${opts.report}: ${e.message}`);
        throw e;
      }
      const live = new Set(candidates.map((c) => c.candidateId));
      const dropped = Object.keys(reviews).filter((id) => !live.has(id)).length;
      if (dropped > 0)
        err(
          `note: ${String(dropped)} earlier review(s) no longer match a candidate and were dropped\n`,
        );
    }
    const report = buildReport({
      commit: env.commit ?? gitCommit(env.repoRoot),
      scope,
      rules: opts.rules,
      candidates,
      reviews,
    });
    const body =
      opts.format === "json"
        ? serializeReport(report)
        : `${candidates.map((c) => `${c.classification}\t${c.path}:${String(c.line)}\t${c.rule}\t${c.originalText}`).join("\n")}${candidates.length ? "\n" : ""}`;
    if (opts.report)
      fs.writeFileSync(
        path.resolve(opts.report),
        opts.format === "json" ? body : serializeReport(report),
      );
    else out(body);
    err(
      `${summarize(candidates).join("\n")}${candidates.length ? "\n" : ""}scanned ${String(files.length)} file(s)\n`,
    );
    const high = candidates.filter((c) => c.classification === "HIGH_CONFIDENCE_CANDIDATE").length;
    return opts.failOnCandidate && high > 0 ? EXIT.VALIDATION : EXIT.OK;
  } catch (e) {
    if (e instanceof CliError) {
      err(`Error: ${e.message}\n`);
      return e.exitCode;
    }
    err(`sweep-comments: internal error: ${e instanceof Error ? e.message : String(e)}\n`);
    return EXIT.IO;
  }
}
