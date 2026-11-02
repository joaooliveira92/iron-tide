import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, test } from "node:test";

import { checkHandoff, checkRepo, run } from "../verify-agent-context.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);
const FILES = [
  ".gitignore",
  ".claude/settings.json",
  ".claude/agents/search.md",
  ".claude/agents/grep.md",
  ".claude/agents/audit.md",
  ".claude/agents/runner.md",
  "CLAUDE.md",
  "AGENTS.md",
  ".ai/templates/task-prompt.md",
  ".ai/templates/task-brief.md",
  ".ai/templates/handoff.md",
  "docs/agents/desktop-snap.md",
  "apps/desktop/scripts/snap-args.ts",
  "scripts/data/agent-context-policy.json",
  "scripts/hooks/pre-tool-use-bash.mjs",
  "scripts/hooks/user-prompt-context.mjs",
  "scripts/lib/agent-guard.mjs",
  "scripts/lib/transcript-context.mjs",
];
const created = [];

function copyTree() {
  const dir = mkdtempSync(join(tmpdir(), "bw-agent-context-"));
  created.push(dir);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  for (const file of FILES) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    copyFileSync(join(ROOT, file), join(dir, file));
  }
  execFileSync("git", ["add", "-f", "-A"], { cwd: dir });
  return dir;
}

const mutate = (dir, file, edit) => {
  const path = join(dir, file);
  writeFileSync(path, edit(readFileSync(path, "utf8")));
};

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("checkRepo", () => {
  test("passes on the real repository", () => assert.deepEqual(checkRepo(ROOT), []));
  test("passes on an exact copy of the governed files", () =>
    assert.deepEqual(checkRepo(copyTree()), []));
  test("fails when a hook script is not wired in settings", () => {
    const dir = copyTree();
    mutate(dir, ".claude/settings.json", (t) => t.replace("pre-tool-use-bash.mjs", "other.mjs"));
    assert.match(checkRepo(dir).join("\n"), /PreToolUse does not run/u);
  });
  test("fails when an agent lacks a model or is missing", () => {
    const dir = copyTree();
    mutate(dir, ".claude/agents/grep.md", (t) => t.replace(/^model:.*$/mu, ""));
    assert.match(checkRepo(dir).join("\n"), /grep\.md lacks model:/u);
    execFileSync("git", ["rm", "-q", "-f", ".claude/agents/runner.md"], { cwd: dir });
    assert.match(checkRepo(dir).join("\n"), /runner\.md must exist and be tracked/u);
  });
  test("fails when .claude is ignored again", () => {
    const dir = copyTree();
    mutate(dir, ".gitignore", (t) => t.replace("!.claude/agents/\n", ""));
    assert.match(checkRepo(dir).join("\n"), /\.gitignore must contain !\.claude\/agents\//u);
  });
  test("fails when the standing subagent authorization or autonomy sections vanish", () => {
    const dir = copyTree();
    mutate(dir, "CLAUDE.md", (t) => t.replace("Standing user authorization", "Maybe"));
    mutate(dir, ".ai/templates/task-prompt.md", (t) => t.replace("## Autonomy", "## Style"));
    mutate(dir, "AGENTS.md", (t) => t.replace("## Stop conditions", "## Halting"));
    const text = checkRepo(dir).join("\n");
    assert.match(text, /standing subagent authorization/u);
    assert.match(text, /task-prompt template is missing "## Autonomy"/u);
    assert.match(text, /AGENTS\.md is missing "## Stop conditions"/u);
  });
  test("fails when a prompt template embeds skill text or grows past the limit", () => {
    const dir = copyTree();
    mutate(
      dir,
      ".ai/templates/task-prompt.md",
      (t) => `---\nname: frontend-design\n---\n${t}${"word ".repeat(POLICY.taskPromptMaxWords)}`,
    );
    const text = checkRepo(dir).join("\n");
    assert.match(text, /embeds skill frontmatter/u);
    assert.match(text, /limit/u);
  });
  test("fails when a threshold is hardcoded outside the policy", () => {
    const dir = copyTree();
    mutate(
      dir,
      "scripts/lib/transcript-context.mjs",
      (t) => `${t}\nexport const LIMIT = ${POLICY.contextWarnTokens};\n`,
    );
    assert.match(checkRepo(dir).join("\n"), /hardcodes contextWarnTokens/u);
  });
  test("fails when the snap docs drift from the default size", () => {
    const dir = copyTree();
    mutate(dir, "docs/agents/desktop-snap.md", (t) => t.replaceAll("1280x800", "999x999"));
    assert.match(checkRepo(dir).join("\n"), /desktop-snap\.md must state 1280x800/u);
  });
});

describe("handoff validation", () => {
  const good = [
    "# Handoff: x (d)",
    ...["Goal", "Done", "Next", "Decisions", "Blockers", "Validation", "Files", "Do not redo"].map(
      (h) => `## ${h}\n\nfine`,
    ),
  ].join("\n\n");
  test("accepts a complete small handoff", () => assert.deepEqual(checkHandoff(good, POLICY), []));
  test("rejects missing sections, placeholders and oversize files", () => {
    assert.match(
      checkHandoff(good.replace("## Next", "## Later"), POLICY).join(),
      /missing "## Next"/u,
    );
    assert.match(checkHandoff(`${good}\n<fill this in>`, POLICY).join(), /placeholder/u);
    assert.match(
      checkHandoff(`${good}\n${"w ".repeat(POLICY.handoffMaxWords)}`, POLICY).join(),
      /limit/u,
    );
  });
  test("the CLI validates a file and reports usage errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-handoff-"));
    created.push(dir);
    const file = join(dir, "h.md");
    writeFileSync(file, good);
    const write = process.stdout.write.bind(process.stdout);
    const writeErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = () => true;
    process.stderr.write = () => true;
    try {
      assert.equal(run(["--handoff", file], ROOT), 0);
      assert.equal(run(["--handoff"], ROOT), 2);
      assert.equal(run(["--bogus"], ROOT), 2);
      writeFileSync(file, "# empty");
      assert.equal(run(["--handoff", file], ROOT), 1);
    } finally {
      process.stdout.write = write;
      process.stderr.write = writeErr;
    }
  });
});
