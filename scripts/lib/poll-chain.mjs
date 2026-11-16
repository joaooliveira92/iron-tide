import { tokenizeCommand } from "./agent-guard.mjs";

const POLL_PROGRAMS = new Set([
  "cd",
  "cat",
  "date",
  "echo",
  "grep",
  "head",
  "ls",
  "pgrep",
  "ps",
  "rg",
  "sleep",
  "stat",
  "tail",
  "wc",
]);
const WAIT_PROGRAMS = new Set(["date", "pgrep", "ps", "sleep"]);
const LOG_OPERAND = /(?:\.log$|^\/(?:private\/)?tmp\/)/u;

export function isPollCommand(command) {
  if (typeof command !== "string") return false;
  const segments = tokenizeCommand(command).filter((segment) => segment.words.length > 0);
  if (segments.length === 0) return false;
  if (!segments.every((segment) => POLL_PROGRAMS.has(segment.words[0]))) return false;
  return segments.some(
    (segment) =>
      WAIT_PROGRAMS.has(segment.words[0]) ||
      segment.words.slice(1).some((word) => LOG_OPERAND.test(word)),
  );
}

function bashCommandsOf(lines, currentToolUseId) {
  const commands = [];
  for (const line of lines) {
    if (line === "") continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record === null || typeof record !== "object" || record.type !== "assistant") continue;
    const content = record.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use" || block.id === currentToolUseId) continue;
      commands.push(block.name === "Bash" ? (block.input?.command ?? "") : null);
    }
  }
  return commands;
}

export function trailingPollLength({ lines, currentToolUseId }) {
  const commands = bashCommandsOf(lines, currentToolUseId);
  let length = 0;
  for (let k = commands.length - 1; k >= 0; k -= 1) {
    if (commands[k] === null || !isPollCommand(commands[k])) break;
    length += 1;
  }
  return length;
}
