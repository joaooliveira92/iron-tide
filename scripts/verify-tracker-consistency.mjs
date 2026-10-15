#!/usr/bin/env node
// Lightweight tracker-consistency gate (production-hardening WS5).
//
// The `.scratch/` tracker is hand-maintained markdown, and an autonomous agent
// reads it to decide what to do. Stale statuses have already sent agents to
// re-implement finished work, so this checks the tractable invariants:
//
//   A. (warning) a ticket that declares no status / an unrecognised status;
//   B. (error) every `Blocked by:` reference resolves to a sibling ticket file;
//   C. (error) a spec that still advertises itself `ready-for-agent`/`ready for
//      slicing` must have at least one non-terminal ticket (otherwise the work
//      is done and the spec should be marked done/archived).
//
// A is a warning because older tracker formats predate the canonical marker and
// git history is the archive; B and C are objective contradictions that mislead
// an agent, so they fail.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SCRATCH = join(ROOT, ".scratch");

export const TERMINAL = new Set(["resolved", "closed", "done", "superseded", "deferred"]);
export const NON_TERMINAL = new Set([
  "open",
  "claimed",
  "in-progress",
  "in progress",
  "ready-for-agent",
  "ready for agent",
  "blocked",
]);
/** Key spellings the tracker uses for the progress marker. */
const STATUS_KEYS = ["status", "state", "progress"];

function fieldValue(text, keys) {
  for (const key of keys) {
    // Reads `**Key:** value`, tolerating a packed line that separates fields
    // with `·` (e.g. `**State:** open · **Frontier:** yes · **Blocked by:** none`).
    const match = new RegExp(`\\*\\*\\s*${key}\\s*:?\\s*\\*\\*\\s*:?\\s*([^·\\n]*)`, "iu").exec(
      text,
    );
    if (match) return match[1].replace(/\*\*/gu, "").trim();
  }
  return undefined;
}

/** @returns {{ status?: string, frontier?: string, blockedBy?: string }} */
export function ticketFields(text) {
  return {
    status: fieldValue(text, STATUS_KEYS),
    frontier: fieldValue(text, ["frontier"]),
    blockedBy: fieldValue(text, ["blocked by"]),
  };
}

export function normalizeStatus(raw) {
  if (raw === undefined) return undefined;
  const first = raw
    .replace(/[`*]/gu, "")
    .split(/[·|,.]/u)[0]
    .trim()
    .replace(/_/gu, "-")
    .replace(/\s+/gu, "-")
    .toLowerCase();
  if (TERMINAL.has(first) || NON_TERMINAL.has(first)) return first;
  // e.g. "in progress …" already handled; anything else is unrecognised.
  return undefined;
}

/** Ticket ids referenced by a `Blocked by:` value (ignores dates and ADR/DESIGN refs). */
export function blockerRefs(raw) {
  if (raw === undefined) return [];
  const cleaned = raw
    .replace(/\b\d{4}-\d{2}-\d{2}\b/gu, " ") // dates
    .replace(/\b(?:ADR|DESIGN)-?\d+\b/giu, " ") // unrelated numbered records
    .replace(/\bnone\b/giu, "");
  return [...cleaned.matchAll(/\b(?:INC-)?\d{1,3}[a-z]?\b/giu)].map((m) => m[0]);
}

function listTickets(dir) {
  try {
    return readdirSync(dir).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }
}

function idMatches(file, ref) {
  const base = file.replace(/\.issue\.md$/u, "").replace(/\.md$/u, "");
  const normalizedRef = ref.replace(/^INC-/iu, "");
  const prefix = base.match(/^(?:INC-)?(\d+[a-z]?)/iu)?.[1];
  return (
    prefix !== undefined &&
    prefix.replace(/^0+(?=\d)/u, "") === normalizedRef.replace(/^0+(?=\d)/u, "")
  );
}

/**
 * @param {string} scratch - the `.scratch` directory.
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function auditTracker(scratch) {
  const errors = [];
  const warnings = [];
  let efforts;
  try {
    efforts = readdirSync(scratch).filter((name) => {
      try {
        return statSync(join(scratch, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return { errors: [`cannot read tracker at ${scratch}`], warnings };
  }

  for (const effort of efforts) {
    const dir = join(scratch, effort);
    const issuesDir = join(dir, "issues");
    const tickets = listTickets(issuesDir);
    const statuses = [];

    for (const ticket of tickets) {
      const path = join(issuesDir, ticket);
      const text = readFileSync(path, "utf8");
      const fields = ticketFields(text);
      const status = normalizeStatus(fields.status);
      const rel = `.scratch/${effort}/issues/${ticket}`;

      if (fields.status === undefined) {
        warnings.push(`${rel}: missing a **Status:**/**State:** marker`);
        statuses.push("open");
      } else if (status === undefined) {
        warnings.push(`${rel}: unrecognised status "${fields.status}"`);
        statuses.push("open");
      } else {
        statuses.push(status);
      }

      for (const ref of blockerRefs(fields.blockedBy)) {
        if (!tickets.some((other) => idMatches(other, ref))) {
          errors.push(`${rel}: **Blocked by:** references missing ticket ${ref}`);
        }
      }
    }

    const specPath = join(dir, "spec.md");
    let specText;
    try {
      specText = readFileSync(specPath, "utf8");
    } catch {
      specText = undefined;
    }
    if (specText !== undefined) {
      const specStatusRaw = fieldValue(specText, STATUS_KEYS);
      const specStatus = (specStatusRaw ?? "").toLowerCase();
      const advertisesReady = /ready[- ]for[- ]agent|ready for slicing/.test(specStatus);
      const anyOpen = statuses.some((status) => NON_TERMINAL.has(status));
      if (advertisesReady && tickets.length > 0 && !anyOpen) {
        errors.push(
          `.scratch/${effort}/spec.md: advertised as ready-for-agent but every one of its ` +
            `${tickets.length} ticket(s) is terminal — mark it done/archived`,
        );
      }
      if (tickets.length === 0 && advertisesReady) {
        warnings.push(`.scratch/${effort}/spec.md: advertised ready but has no tickets yet`);
      }
    }
  }

  return { errors, warnings };
}

function main() {
  const report = process.argv.includes("--report");
  const { errors, warnings } = auditTracker(SCRATCH);
  for (const warning of warnings) console.warn(`tracker warning: ${warning}`);
  if (errors.length > 0) {
    console.error(`tracker-consistency: ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  ${error}`);
    if (!report) process.exit(1);
  }
  console.log(`tracker-consistency: ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (report) process.exit(0);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();
