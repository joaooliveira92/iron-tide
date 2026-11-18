import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { tokenizeCommand } from "./agent-guard.mjs";

const SESSION_ID = /^[\w.-]{1,128}$/u;
const SEARCH_PROGRAMS = new Set(["rg", "grep"]);
const PIPE_CONSUMERS = new Set(["head", "tail", "wc"]);

export function isReassessmentCommand(command) {
  const segments = tokenizeCommand(command);
  if (segments.length === 0) return false;
  return segments.every((segment, index) => {
    const [program, first] = segment.words;
    const toFile = segment.redirects.some(
      (r) => (r.fd === "" || r.fd === "1") && r.target !== "/dev/null" && !r.target.startsWith("&"),
    );
    if (toFile || segment.heredocs.length > 0) return false;
    const pipedIn = index > 0 && segments[index - 1].pipedOut;
    if (index === 0) {
      return SEARCH_PROGRAMS.has(program) || (program === "pnpm" && first === "agent:map");
    }
    return pipedIn && PIPE_CONSUMERS.has(program);
  });
}

export const lockedMessage = (policy) =>
  `Mutations are locked after ${policy.mutationLockAt} blocked attempts. Reassess with \`pnpm agent:map <symbol>\` or an \`rg\` search, then use Edit (Write for a new file).`;

export function openStreak({ policy, env, sessionId }) {
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return null;
  const dir = env[policy.guardStateDirEnv] ?? join(tmpdir(), "bluewave-agent-guard");
  const file = join(dir, `${sessionId}.json`);
  const count = () => {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      return Number.isInteger(parsed.blocks) && parsed.blocks > 0 ? parsed.blocks : 0;
    } catch {
      return 0;
    }
  };
  const write = (blocks) => {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, JSON.stringify({ blocks }));
    } catch {
      process.stderr.write("agent-guard: streak state unavailable\n");
    }
  };
  return {
    count,
    locked: () => count() >= policy.mutationLockAt,
    recordBlock: () => {
      const next = count() + 1;
      write(next);
      return next;
    },
    reset: () => {
      if (count() > 0) write(0);
    },
  };
}
