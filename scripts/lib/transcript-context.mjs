import { closeSync, fstatSync, openSync, readSync } from "node:fs";

export function readTail(path, maxBytes) {
  const fd = openSync(path, "r");
  try {
    const { size } = fstatSync(fd);
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    const text = buffer.toString("utf8");
    const lines = text.split("\n");
    return size > maxBytes ? lines.slice(1) : lines;
  } finally {
    closeSync(fd);
  }
}

export function contextTokensOf(usage) {
  const iterations = Array.isArray(usage.iterations)
    ? usage.iterations.filter(
        (it) => it !== null && typeof it === "object" && it.type === "message",
      )
    : [];
  const source = iterations.length > 0 ? iterations[iterations.length - 1] : usage;
  const total =
    (source.input_tokens ?? 0) +
    (source.cache_read_input_tokens ?? 0) +
    (source.cache_creation_input_tokens ?? 0);
  return Number.isFinite(total) ? total : 0;
}

export function latestContext(lines) {
  let tokens = null;
  let lastActivityMs = null;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line === "") continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record === null || typeof record !== "object" || record.isSidechain === true) continue;
    const stamp = typeof record.timestamp === "string" ? Date.parse(record.timestamp) : Number.NaN;
    const conversational = record.type === "assistant" || record.type === "user";
    if (lastActivityMs === null && conversational && Number.isFinite(stamp)) lastActivityMs = stamp;
    const message = record.message;
    if (
      tokens === null &&
      record.type === "assistant" &&
      message !== null &&
      typeof message === "object" &&
      message.model !== "<synthetic>" &&
      message.usage !== null &&
      typeof message.usage === "object"
    ) {
      tokens = contextTokensOf(message.usage);
    }
    if (tokens !== null && lastActivityMs !== null) break;
  }
  return { tokens, lastActivityMs };
}

export function evaluatePrompt({ prompt, tokens, lastActivityMs, nowMs, policy }) {
  if (tokens === null) return { action: "none", message: "" };
  const text = typeof prompt === "string" ? prompt : "";
  const trimmed = text.trimStart();
  if (policy.handoffExemptPromptPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    return { action: "none", message: "" };
  }
  const overridden = text.includes(policy.contextOverrideToken);
  const idleMinutes = lastActivityMs === null ? 0 : Math.max(0, (nowMs - lastActivityMs) / 60000);
  const resuming =
    new RegExp(policy.resumePromptPattern, "iu").test(text) ||
    idleMinutes >= policy.idleResumeMinutes;
  const k = Math.round(tokens / 1000);
  if (tokens >= policy.contextBlockTokens && resuming && !overridden) {
    return {
      action: "block",
      message:
        `Context is ${k}k tokens (limit ${Math.round(policy.contextBlockTokens / 1000)}k) and this prompt resumes after ` +
        `${Math.round(idleMinutes)} idle minutes. Run /handoff and start a fresh session. ` +
        `To continue anyway, include \`${policy.contextOverrideToken} <reason>\` in the prompt.`,
    };
  }
  if (tokens >= policy.contextWarnTokens) {
    return {
      action: "warn",
      message:
        `Context is ${k}k tokens (cap ${Math.round(policy.contextWarnTokens / 1000)}k). Finish the current step, commit, ` +
        "run /handoff, and recommend a fresh session. Do not start a new slice or call the advisor in this thread.",
    };
  }
  if (tokens >= policy.contextAdvisorTokens) {
    return {
      action: "advise",
      message: `Context is ${k}k tokens. Call the advisor now if needed: it forwards the whole transcript.`,
    };
  }
  return { action: "none", message: "" };
}
