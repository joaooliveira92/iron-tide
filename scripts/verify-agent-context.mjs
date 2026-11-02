#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isEntryPoint } from "./lib/paths.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const POLICY_PATH = "scripts/data/agent-context-policy.json";
const MAX_REPORTED = 20;
const NUMERIC_POLICY_KEYS = [
  "catMaxLines",
  "readRangeMaxLines",
  "overrideMinReasonChars",
  "contextAdvisorTokens",
  "contextWarnTokens",
  "contextBlockTokens",
  "idleResumeMinutes",
  "transcriptTailBytes",
  "maxFileBytesForLineCount",
  "handoffMaxWords",
  "taskPromptMaxWords",
  "hookStderrMaxChars",
];
const HOOK_SOURCES = [
  "scripts/hooks/pre-tool-use-bash.mjs",
  "scripts/hooks/user-prompt-context.mjs",
  "scripts/lib/agent-guard.mjs",
  "scripts/lib/transcript-context.mjs",
];
const THRESHOLD_KEYS_TO_KEEP_OUT_OF_SOURCE = [
  "catMaxLines",
  "contextAdvisorTokens",
  "contextWarnTokens",
  "contextBlockTokens",
  "idleResumeMinutes",
  "handoffMaxWords",
];
const REQUIRED_AGENTS = ["search", "grep", "audit", "runner"];
const HANDOFF_HEADINGS = [
  "Goal",
  "Done",
  "Next",
  "Decisions",
  "Blockers",
  "Validation",
  "Files",
  "Do not redo",
];
const TASK_PROMPT_HEADINGS = ["Task", "Reference", "Acceptance", "Autonomy", "Done"];
const TASK_BRIEF_HEADINGS = ["Delivery authority", "Blockers that need a human"];
const STOP_CONDITION_PHRASES = ["golden hash", "credentials", "destructive"];

const countWords = (text) => text.split(/\s+/u).filter(Boolean).length;
const headingsOf = (text) => [...text.matchAll(/^##\s+(.+?)\s*$/gmu)].map((match) => match[1]);

function readText(root, path) {
  const absolute = resolve(root, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
}

function trackedPaths(root, pathspec) {
  try {
    return execFileSync("git", ["-C", root, "ls-files", "--", pathspec], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function checkHandoff(text, policy) {
  const failures = [];
  const words = countWords(text);
  if (words > policy.handoffMaxWords) {
    failures.push(`handoff has ${words} words, limit ${policy.handoffMaxWords}`);
  }
  const present = new Set(headingsOf(text));
  for (const heading of HANDOFF_HEADINGS) {
    if (!present.has(heading)) failures.push(`handoff is missing "## ${heading}"`);
  }
  if (/<[a-z][^>\n]{2,}>/u.test(text.replace(/`[^`]*`/gu, ""))) {
    failures.push("handoff still contains <placeholder> text");
  }
  return failures;
}

function requireHeadings(failures, label, text, headings) {
  if (text === null) {
    failures.push(`${label} is missing`);
    return;
  }
  const present = new Set(headingsOf(text));
  for (const heading of headings) {
    if (!present.has(heading)) failures.push(`${label} is missing "## ${heading}"`);
  }
}

function checkPolicy(root, failures) {
  const raw = readText(root, POLICY_PATH);
  if (raw === null) {
    failures.push(`${POLICY_PATH} is missing`);
    return null;
  }
  let policy;
  try {
    policy = JSON.parse(raw);
  } catch {
    failures.push(`${POLICY_PATH} is not valid JSON`);
    return null;
  }
  for (const key of NUMERIC_POLICY_KEYS) {
    if (!Number.isInteger(policy[key]) || policy[key] <= 0) {
      failures.push(`${POLICY_PATH}: ${key} must be a positive integer`);
    }
  }
  if (!(policy.contextAdvisorTokens < policy.contextWarnTokens)) {
    failures.push("policy: contextAdvisorTokens must be below contextWarnTokens");
  }
  if (!(policy.contextWarnTokens < policy.contextBlockTokens)) {
    failures.push("policy: contextWarnTokens must be below contextBlockTokens");
  }
  return policy;
}

function checkSettings(root, failures) {
  const raw = readText(root, ".claude/settings.json");
  if (raw === null) {
    failures.push(".claude/settings.json is missing");
    return;
  }
  let settings;
  try {
    settings = JSON.parse(raw);
  } catch {
    failures.push(".claude/settings.json is not valid JSON");
    return;
  }
  const expectations = [
    ["PreToolUse", "scripts/hooks/pre-tool-use-bash.mjs", "Bash"],
    ["UserPromptSubmit", "scripts/hooks/user-prompt-context.mjs", undefined],
  ];
  for (const [event, script, matcher] of expectations) {
    const groups = settings.hooks?.[event];
    const commands = Array.isArray(groups)
      ? groups.flatMap((group) =>
          (matcher === undefined || group.matcher === matcher ? (group.hooks ?? []) : []).map(
            (hook) => hook.command ?? "",
          ),
        )
      : [];
    if (!commands.some((command) => command.includes(`$CLAUDE_PROJECT_DIR/${script}`))) {
      failures.push(`.claude/settings.json: ${event} does not run ${script}`);
    }
    if (!existsSync(resolve(root, script))) failures.push(`${script} does not exist`);
  }
  if (!trackedPaths(root, ".claude/settings.json").length) {
    failures.push(".claude/settings.json is not tracked (check .gitignore)");
  }
}

function checkAgents(root, failures) {
  const tracked = new Set(trackedPaths(root, ".claude/agents"));
  for (const name of REQUIRED_AGENTS) {
    const path = `.claude/agents/${name}.md`;
    const text = readText(root, path);
    if (text === null || !tracked.has(path)) {
      failures.push(`${path} must exist and be tracked so worktrees can use it`);
      continue;
    }
    for (const field of ["name", "description", "tools", "model"]) {
      if (!new RegExp(`^${field}:\\s*\\S`, "mu").test(text))
        failures.push(`${path} lacks ${field}:`);
    }
  }
  const ignore = readText(root, ".gitignore") ?? "";
  for (const line of [".claude/*", "!.claude/settings.json", "!.claude/agents/"]) {
    if (!ignore.split("\n").includes(line)) failures.push(`.gitignore must contain ${line}`);
  }
}

function checkInstructions(root, failures) {
  const claude = readText(root, "CLAUDE.md");
  if (claude === null || !trackedPaths(root, "CLAUDE.md").length) {
    failures.push("CLAUDE.md must exist and be tracked");
  } else {
    if (!claude.startsWith("@AGENTS.md")) failures.push("CLAUDE.md must import @AGENTS.md first");
    if (!claude.includes("Standing user authorization")) {
      failures.push("CLAUDE.md lacks the standing subagent authorization");
    }
    for (const name of REQUIRED_AGENTS) {
      if (!claude.includes(`\`${name}\``))
        failures.push(`CLAUDE.md does not name the ${name} agent`);
    }
  }
  const agents = readText(root, "AGENTS.md");
  if (agents === null) {
    failures.push("AGENTS.md is missing");
    return;
  }
  const present = new Set(headingsOf(agents));
  for (const heading of ["Agent workflow", "Stop conditions"]) {
    if (!present.has(heading)) failures.push(`AGENTS.md is missing "## ${heading}"`);
  }
  const stop = agents.slice(agents.indexOf("## Stop conditions"));
  for (const phrase of STOP_CONDITION_PHRASES) {
    if (!stop.includes(phrase)) failures.push(`AGENTS.md stop conditions lack "${phrase}"`);
  }
  for (const link of ["docs/agents/context-efficiency.md", ".ai/templates/task-prompt.md"]) {
    if (!agents.includes(link)) failures.push(`AGENTS.md does not link ${link}`);
  }
}

function checkTemplates(root, policy, failures) {
  const prompt = readText(root, ".ai/templates/task-prompt.md");
  requireHeadings(failures, "task-prompt template", prompt, TASK_PROMPT_HEADINGS);
  if (prompt !== null) {
    const words = countWords(prompt);
    if (words > policy.taskPromptMaxWords) {
      failures.push(`task-prompt template has ${words} words, limit ${policy.taskPromptMaxWords}`);
    }
    if (!prompt.includes("AGENTS.md#stop-conditions")) {
      failures.push("task-prompt template must link AGENTS.md#stop-conditions");
    }
    if (/^(name|description|license):/mu.test(prompt)) {
      failures.push("task-prompt template embeds skill frontmatter; reference the skill instead");
    }
  }
  requireHeadings(
    failures,
    "task-brief template",
    readText(root, ".ai/templates/task-brief.md"),
    TASK_BRIEF_HEADINGS,
  );
  const handoff = readText(root, ".ai/templates/handoff.md");
  if (handoff === null) failures.push("handoff template is missing");
  else {
    for (const failure of checkHandoff(handoff, policy).filter((f) => !f.includes("placeholder"))) {
      failures.push(`handoff template: ${failure}`);
    }
  }
}

function checkSnap(root, failures) {
  const args = readText(root, "apps/desktop/scripts/snap-args.ts");
  const doc = readText(root, "docs/agents/desktop-snap.md");
  const size =
    args === null
      ? null
      : /DEFAULT_SNAP_SIZE\s*=\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)/u.exec(args);
  if (size === null) {
    failures.push("snap-args.ts must export DEFAULT_SNAP_SIZE");
    return;
  }
  if (!args.includes('"full-res"')) failures.push("snap-args.ts lacks the --full-res override");
  if (doc === null || !doc.includes(`${size[1]}x${size[2]}`) || !doc.includes("--full-res")) {
    failures.push(`desktop-snap.md must state ${size[1]}x${size[2]} and --full-res`);
  }
}

function checkNoDuplicatedThresholds(root, policy, failures) {
  for (const path of HOOK_SOURCES) {
    const text = readText(root, path);
    if (text === null) {
      failures.push(`${path} is missing`);
      continue;
    }
    for (const key of THRESHOLD_KEYS_TO_KEEP_OUT_OF_SOURCE) {
      const pattern = new RegExp(`(?<![\\w.])${policy[key]}(?![\\w.])`, "u");
      if (pattern.test(text))
        failures.push(`${path} hardcodes ${key}=${policy[key]}; read the policy`);
    }
  }
}

export function checkRepo(root = ROOT) {
  const failures = [];
  const policy = checkPolicy(root, failures);
  checkSettings(root, failures);
  checkAgents(root, failures);
  checkInstructions(root, failures);
  checkSnap(root, failures);
  if (policy !== null) {
    checkTemplates(root, policy, failures);
    checkNoDuplicatedThresholds(root, policy, failures);
  }
  return failures;
}

export function run(argv, root = ROOT) {
  const handoffIndex = argv.indexOf("--handoff");
  if (handoffIndex !== -1) {
    const file = argv[handoffIndex + 1];
    if (file === undefined) {
      process.stderr.write("usage: verify-agent-context.mjs --handoff <file>\n");
      return 2;
    }
    const text = readText(process.cwd(), file);
    const policyText = readText(root, POLICY_PATH);
    if (text === null || policyText === null) {
      process.stderr.write(`cannot read ${text === null ? file : POLICY_PATH}\n`);
      return 2;
    }
    const failures = checkHandoff(text, JSON.parse(policyText));
    for (const failure of failures.slice(0, MAX_REPORTED)) process.stderr.write(`${failure}\n`);
    if (failures.length === 0) process.stdout.write("handoff ok\n");
    return failures.length === 0 ? 0 : 1;
  }
  if (argv.length > 0 && !argv.includes("--check")) {
    process.stderr.write("usage: verify-agent-context.mjs [--check | --handoff <file>]\n");
    return 2;
  }
  const failures = checkRepo(root);
  for (const failure of failures.slice(0, MAX_REPORTED))
    process.stderr.write(`agent-context: ${failure}\n`);
  if (failures.length > MAX_REPORTED) {
    process.stderr.write(`agent-context: +${failures.length - MAX_REPORTED} more\n`);
  }
  if (failures.length === 0) process.stdout.write("agent-context: ok\n");
  return failures.length === 0 ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) process.exit(run(process.argv.slice(2)));
