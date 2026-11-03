import { hasDynamicText, resolvePath, tokenizeCommand } from "./agent-guard.mjs";

const SED_RANGE = /^(?:\d+|\$)(?:,(?:\d+|\$))?p$/u;
const COUNT = /^\d+$/u;

function sedOperands(words) {
  const rest = words.slice(1);
  if (!rest.includes("-n")) return null;
  const operands = rest.filter((w) => !w.startsWith("-"));
  const [script, ...files] = operands;
  return script !== undefined && SED_RANGE.test(script) ? files : null;
}

function headTailOperands(words) {
  const rest = words.slice(1);
  const operands = [];
  let counted = false;
  for (let k = 0; k < rest.length; k += 1) {
    const word = rest[k];
    if (word === "-n" && COUNT.test(rest[k + 1] ?? "")) {
      counted = true;
      k += 1;
    } else if (/^-n\d+$/u.test(word) || /^-\d+$/u.test(word)) {
      counted = true;
    } else if (!word.startsWith("-")) {
      operands.push(word);
    }
  }
  return counted ? operands : null;
}

export function rangeReadTargets(command, cwd) {
  let workdir = cwd;
  let workdirKnown = typeof cwd === "string" && cwd.length > 0;
  const targets = [];
  for (const segment of tokenizeCommand(command)) {
    const [program] = segment.words;
    if (program === "cd" && segment.words.length >= 2 && !segment.pipedOut) {
      const target = segment.words[1];
      if (!workdirKnown || target === "-" || hasDynamicText(target)) workdirKnown = false;
      else workdir = resolvePath(workdir, target);
      continue;
    }
    let operands = null;
    if (program === "sed") operands = sedOperands(segment.words);
    else if (program === "head" || program === "tail") operands = headTailOperands(segment.words);
    if (operands === null || operands.length !== 1 || !workdirKnown) continue;
    if (hasDynamicText(operands[0])) continue;
    targets.push(resolvePath(workdir, operands[0]));
  }
  return targets;
}

function toolUsesOf(lines, currentToolUseId) {
  const uses = [];
  for (const line of lines) {
    if (line === "") continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record === null || typeof record !== "object" || record.isSidechain === true) continue;
    if (record.type !== "assistant") continue;
    const content = record.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use" || block.id === currentToolUseId) continue;
      uses.push({ name: block.name, input: block.input ?? {}, cwd: record.cwd });
    }
  }
  return uses;
}

function readsRangeOf(use, path, fallbackCwd) {
  const base = typeof use.cwd === "string" ? use.cwd : fallbackCwd;
  if (use.name === "Bash" && typeof use.input.command === "string") {
    return rangeReadTargets(use.input.command, base).includes(path);
  }
  if (use.name === "Read" && typeof use.input.file_path === "string") {
    const ranged = use.input.offset !== undefined || use.input.limit !== undefined;
    return ranged && resolvePath(base, use.input.file_path) === path;
  }
  return false;
}

export function trailingChainLength({ lines, path, cwd, currentToolUseId }) {
  const uses = toolUsesOf(lines, currentToolUseId);
  let length = 0;
  for (let k = uses.length - 1; k >= 0; k -= 1) {
    if (!readsRangeOf(uses[k], path, cwd)) break;
    length += 1;
  }
  return length;
}
