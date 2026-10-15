// Tests for scripts/link-claude-skills.mjs — recreating the `.claude/skills` →
// `.agents/skills` symlinks that Claude Code discovers, without clobbering real
// files and without modifying anything under `--check`.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { syncSkillLinks } from "../link-claude-skills.mjs";

/** Windows `readlink` returns a backslash target; compare in POSIX form. */
const posix = (p) => p.replace(/\\/gu, "/");

/** Build a throwaway root with three skills under `.agents/skills`. */
function scaffold(t) {
  const root = mkdtempSync(join(tmpdir(), "link-claude-skills-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const agentsDir = join(root, ".agents", "skills");
  const claudeDir = join(root, ".claude", "skills");
  for (const name of ["implement", "tdd", "resolving-merge-conflicts"]) {
    mkdirSync(join(agentsDir, name), { recursive: true });
    writeFileSync(join(agentsDir, name, "SKILL.md"), `---\nname: ${name}\n---\n`);
  }
  return { root, claudeDir };
}

void test("creates a relative symlink for every skill on a fresh tree", (t) => {
  const { root, claudeDir } = scaffold(t);
  const result = syncSkillLinks({ root });

  assert.deepEqual(result.created, ["implement", "resolving-merge-conflicts", "tdd"]);
  assert.deepEqual(result.missing, []);
  assert.equal(posix(readlinkSync(join(claudeDir, "implement"))), "../../.agents/skills/implement");
});

void test("is idempotent — a second run only reports present", (t) => {
  const { root } = scaffold(t);
  syncSkillLinks({ root });
  const result = syncSkillLinks({ root });

  assert.deepEqual(result.created, []);
  assert.deepEqual(result.repaired, []);
  assert.deepEqual(result.present, ["implement", "resolving-merge-conflicts", "tdd"]);
});

void test("repairs a link pointing somewhere else", (t) => {
  const { root, claudeDir } = scaffold(t);
  mkdirSync(claudeDir, { recursive: true });
  symlinkSync("../../.agents/skills/tdd", join(claudeDir, "implement"));

  const result = syncSkillLinks({ root });
  assert.deepEqual(result.repaired, ["implement"]);
  assert.equal(posix(readlinkSync(join(claudeDir, "implement"))), "../../.agents/skills/implement");
});

void test("leaves a real file/dir in place (never clobbers)", (t) => {
  const { root, claudeDir } = scaffold(t);
  mkdirSync(join(claudeDir, "implement"), { recursive: true });
  writeFileSync(join(claudeDir, "implement", "SKILL.md"), "local copy\n");

  const result = syncSkillLinks({ root });
  assert.ok(result.skipped.includes("implement"));
  assert.equal(posix(readlinkSync(join(claudeDir, "tdd"))), "../../.agents/skills/tdd");
});

void test("--check reports missing links without touching the tree", (t) => {
  const { root, claudeDir } = scaffold(t);
  const result = syncSkillLinks({ root, check: true });

  assert.deepEqual(result.missing, ["implement", "resolving-merge-conflicts", "tdd"]);
  assert.ok(!existsSync(join(claudeDir, "implement")), "check mode must not create links");
});

void test("no `.agents/skills` directory yields an empty result", (t) => {
  const root = mkdtempSync(join(tmpdir(), "link-claude-skills-empty-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(syncSkillLinks({ root, check: true }).missing, []);
});
