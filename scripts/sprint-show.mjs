#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { isEntryPoint } from "./lib/paths.mjs";

export const PLAN_PATH = ".ai/SPRINT-PLAN.md";
export const DEFAULT_MAX_LINES = 120;
const USAGE = "usage: pnpm sprint:show <selector> [--max-lines N]\n       pnpm sprint:show --list";

export class SprintError extends Error {
  constructor(message, code, details = []) {
    super(message);
    this.name = "SprintError";
    this.code = code;
    this.details = details;
  }
}

export function parseArguments(argv) {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        list: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        "max-lines": { type: "string", default: String(DEFAULT_MAX_LINES) },
      },
    }));
  } catch (error) {
    throw new SprintError(`${error.message}\n${USAGE}`, 2);
  }
  if (values.help) return { help: true };
  const maxLines = Number(values["max-lines"]);
  if (!Number.isInteger(maxLines) || maxLines < 1) {
    throw new SprintError("--max-lines must be a positive integer", 2);
  }
  if (values.list) return { list: true, maxLines };
  if (positionals.length === 0) throw new SprintError(USAGE, 2);
  return { list: false, selector: positionals.join(" "), maxLines };
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/u;
const FENCE = /^[ \t]{0,3}(?:```|~~~)/u;

export function parseSections(text) {
  const lines = text.split("\n");
  const headings = [];
  let fenced = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = HEADING.exec(line);
    if (match === null) continue;
    headings.push({ level: match[1].length, title: match[2].trim(), start: index });
  }
  return headings.map((heading, index) => {
    let end = lines.length;
    for (const next of headings.slice(index + 1)) {
      if (next.level <= heading.level) {
        end = next.start;
        break;
      }
    }
    return {
      level: heading.level,
      title: heading.title,
      start: heading.start,
      end,
      lineCount: end - heading.start,
    };
  });
}

function normalize(value) {
  return value.toLowerCase().replace(/^#+/u, "").replace(/\s+/gu, " ").trim();
}

export function selectSections(sections, selector) {
  const wanted = normalize(selector);
  for (const mode of ["exact", "prefix", "contains"]) {
    const matches = sections.filter((section) => {
      const title = normalize(section.title);
      if (mode === "exact") return title === wanted;
      if (mode === "prefix") return title.startsWith(wanted);
      return title.includes(wanted);
    });
    if (matches.length > 0) return matches;
  }
  return [];
}

export function renderList(sections) {
  return `${sections
    .map(
      (section) =>
        `${"  ".repeat(section.level - 1)}${section.title} (${String(section.lineCount)} lines)`,
    )
    .join("\n")}\n`;
}

export function renderSection(text, section, maxLines) {
  const lines = text.split("\n");
  const body = lines.slice(section.start, section.end);
  const shown = body.slice(0, maxLines);
  if (body.length > shown.length) {
    shown.push(`... ${String(body.length - shown.length)} more lines; rerun with --max-lines`);
  }
  return `${shown.join("\n").replace(/\s+$/u, "")}\n`;
}

function reportError(error) {
  process.stderr.write(`sprint:show: ${error.message}\n`);
  for (const detail of error.details ?? []) process.stderr.write(`  ${detail}\n`);
}

export function run(argv, root = resolve(import.meta.dirname, "..")) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    if (error instanceof SprintError) {
      reportError(error);
      return error.code;
    }
    throw error;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const path = resolve(root, PLAN_PATH);
  if (!existsSync(path)) {
    process.stderr.write(`sprint:show: ${PLAN_PATH} not found\n`);
    return 4;
  }
  const text = readFileSync(path, "utf8");
  const sections = parseSections(text);
  if (options.list) {
    process.stdout.write(renderList(sections));
    return 0;
  }
  const matches = selectSections(sections, options.selector);
  if (matches.length === 0) {
    process.stderr.write(`sprint:show: no section matches ${JSON.stringify(options.selector)}\n`);
    process.stderr.write("sprint:show: run `pnpm sprint:show --list`\n");
    return 4;
  }
  if (matches.length > 1) {
    process.stderr.write(
      `sprint:show: ${JSON.stringify(options.selector)} matches ${String(matches.length)} sections; be specific\n`,
    );
    for (const match of matches) process.stderr.write(`  ${match.title}\n`);
    return 3;
  }
  process.stdout.write(renderSection(text, matches[0], options.maxLines));
  return 0;
}

if (isEntryPoint(import.meta.url)) process.exit(run(process.argv.slice(2)));
