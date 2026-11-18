import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";

import { evaluateBashCommand } from "../lib/agent-guard.mjs";
import { isReassessmentCommand } from "../lib/mutation-streak.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const BASH_HOOK = join(ROOT, "scripts/hooks/pre-tool-use-bash.mjs");
const EDIT_HOOK = join(ROOT, "scripts/hooks/pre-tool-use-edit.mjs");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);

let sandbox;
let counter = 0;

before(() => {
  mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
  sandbox = mkdtempSync(join(ROOT, "node_modules/.cache", "mutation-streak-"));
  mkdirSync(join(sandbox, "src"));
  writeFileSync(join(sandbox, "src", "a.ts"), "export const a = 1;\n");
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

function session() {
  counter += 1;
  const stateDir = join(sandbox, `state-${counter}`);
  const sessionId = `session-${process.pid}-${counter}`;
  const run = (hook, payload) => {
    const result = spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ session_id: sessionId, cwd: sandbox, ...payload }),
      encoding: "utf8",
      env: {
        ...process.env,
        [POLICY.guardStateDirEnv]: stateDir,
        [POLICY.guardAuditLogEnv]: join(stateDir, "audit.log"),
      },
    });
    return { status: result.status, stderr: result.stderr, stdout: result.stdout };
  };
  return {
    bash: (command) => run(BASH_HOOK, { tool_name: "Bash", tool_input: { command } }),
    tool: (name, input = {}) => run(EDIT_HOOK, { tool_name: name, tool_input: input }),
    edit: (file = join(sandbox, "src", "a.ts")) =>
      run(EDIT_HOOK, { tool_name: "Edit", tool_input: { file_path: file } }),
    write: (file = join(sandbox, "src", "new.ts")) =>
      run(EDIT_HOOK, { tool_name: "Write", tool_input: { file_path: file } }),
  };
}

const PY_WRITE = `python3 - <<'EOF'\nopen('src/a.ts', 'w').write('x')\nEOF`;
const NODE_WRITE = `node -e "require('fs').writeFileSync('src/a.ts', 'x')"`;
const SED_WRITE = "sed -i 's/a/b/' src/a.ts";

void describe("read-only scripts stay allowed", () => {
  void test("python and node reads pass", () => {
    const s = session();
    assert.equal(s.bash(`python3 - <<'EOF'\nprint(open('src/a.ts').read())\nEOF`).status, 0);
    assert.equal(
      s.bash(`node -e "console.log(require('fs').readFileSync('src/a.ts','utf8'))"`).status,
      0,
    );
    assert.equal(s.bash("perl -Mstrict -ne 'print if /a/' src/a.ts").status, 0);
  });
});

void describe("mutation detection", () => {
  void test("python and node file writes are blocked without advertising the override", () => {
    const s = session();
    for (const command of [PY_WRITE, NODE_WRITE]) {
      const fresh = session();
      const result = fresh.bash(command);
      assert.equal(result.status, 2, command);
      assert.match(result.stderr, /next mutation must use Edit/u);
      assert.match(result.stderr, /Write for a new file/u);
      assert.doesNotMatch(result.stderr, /agent-guard: allow/u);
    }
    assert.equal(s.bash("python3 -c \"import shutil; shutil.copyfile('a','b')\"").status, 2);
    assert.equal(s.bash(`node -e "require('fs').copyFileSync('/tmp/x','src/a.ts')"`).status, 2);
  });

  void test("sed -i and perl -i are blocked", () => {
    for (const command of [
      SED_WRITE,
      "perl -pi -e 's/a/b/' src/a.ts",
      "perl -i.bak -pe 's/a/b/' src/a.ts",
      "perl -i -ne 'print' src/a.ts",
    ]) {
      assert.equal(session().bash(command).status, 2, command);
    }
  });

  void test("redirects and tee into source files are blocked", () => {
    for (const command of [
      "echo hi > src/a.ts",
      "echo hi >> src/a.ts",
      "printf x > src/b.json",
      "cat src/a.ts > src/copy.ts",
      "sed 's/a/b/' src/a.ts > src/out.ts",
      "echo hi | tee src/b.md",
      "cat > src/a.ts <<'EOF'\nhello\nEOF",
      "cd src && echo hi > c.yaml",
    ]) {
      const result = session().bash(command);
      assert.equal(result.status, 2, command);
      assert.match(result.stderr, /next mutation must use Edit/u);
    }
  });

  void test("cp, mv and install into source files are blocked", () => {
    for (const command of [
      "cp /tmp/x.ts src/a.ts",
      "mv /tmp/x.ts src/a.ts",
      "install -m 644 /tmp/x.ts src/a.ts",
    ]) {
      assert.equal(session().bash(command).status, 2, command);
    }
  });

  void test("scratch paths, non-source extensions and non-content programs stay allowed", () => {
    const s = session();
    for (const command of [
      "git diff dev > /tmp/x",
      "git diff dev > /tmp/x.ts",
      "git diff dev > out.patch",
      "git diff dev -- src > src/out.diff",
      "echo hi > /tmp/a.ts",
      "echo hi > /private/tmp/a.json",
      "echo hi > run.log",
      "echo hi > /dev/null",
      "cat src/a.ts > /dev/null",
      "pnpm test > run.log 2>&1",
      "pnpm test 2>&1 | tee /tmp/run.log",
      "echo hi 2>/dev/null",
      "echo hi >&2",
      "cp /tmp/x.ts /tmp/y.ts",
      "mv /tmp/x /tmp/y",
      "cp src/a.ts src/dir/",
      "rg -n a src > /tmp/hits.txt",
      "git diff dev | tee /tmp/d.diff",
      "echo hi > .git/probe.json",
      "cat > src/brand-new.ts <<'EOF'\nhello\nEOF",
    ]) {
      assert.equal(s.bash(command).status, 0, command);
    }
  });

  void test("verdicts carry the mutation flag", () => {
    const base = { cwd: sandbox, policy: POLICY };
    assert.equal(evaluateBashCommand({ ...base, command: SED_WRITE }).mutation, true);
    assert.equal(evaluateBashCommand({ ...base, command: "git status" }).mutation, false);
  });

  void test("an overridden mutation is allowed before any block", () => {
    const result = session().bash(`${SED_WRITE} # agent-guard: allow one-off migration`);
    assert.equal(result.status, 0);
  });
});

void describe("mutation streak", () => {
  void test("a block is followed by an allowed Edit and Write", () => {
    const s = session();
    assert.equal(s.bash(SED_WRITE).status, 2);
    assert.equal(s.edit().status, 0);
    assert.equal(s.write().status, 0);
  });

  void test("after a block, another Bash or interpreter mutation stays blocked even with an override", () => {
    const s = session();
    assert.equal(s.bash(SED_WRITE).status, 2);
    assert.equal(s.bash(PY_WRITE).status, 2);
    assert.equal(s.edit().status, 2);
    const overridden = session();
    assert.equal(overridden.bash(SED_WRITE).status, 2);
    assert.equal(overridden.bash(`${NODE_WRITE} # agent-guard: allow try again`).status, 2);
  });

  void test("an allowed Edit resets the count", () => {
    const s = session();
    assert.equal(s.bash(SED_WRITE).status, 2);
    assert.equal(s.edit().status, 0);
    assert.equal(s.bash(SED_WRITE).status, 2);
    assert.equal(s.edit().status, 0);
  });

  void test(`${POLICY.mutationLockAt} blocks lock Edit, Write and Bash mutations`, () => {
    const s = session();
    for (let i = 0; i < POLICY.mutationLockAt; i += 1) assert.equal(s.bash(SED_WRITE).status, 2);
    const edit = s.edit();
    assert.equal(edit.status, 2);
    assert.match(edit.stderr, /pnpm agent:map/u);
    assert.equal(s.write().status, 2);
    assert.equal(s.bash(`${PY_WRITE}\n# agent-guard: allow nope`).status, 2);
    assert.equal(s.bash("git status").status, 0);
    assert.equal(s.bash("pnpm verify:affected").status, 0);
  });

  void test("the lock is per session", () => {
    const locked = session();
    for (let i = 0; i < POLICY.mutationLockAt; i += 1) locked.bash(SED_WRITE);
    assert.equal(locked.edit().status, 2);
    assert.equal(session().edit().status, 0);
  });

  void test("agent:map, rg and grep unlock; a plain Read or cat does not", () => {
    for (const command of [
      "pnpm agent:map applyDamage",
      "rg -n -C3 applyDamage packages | head -120",
      "grep -rn applyDamage packages | wc -l",
    ]) {
      const s = session();
      for (let i = 0; i < POLICY.mutationLockAt; i += 1) s.bash(SED_WRITE);
      assert.equal(s.edit().status, 2);
      assert.equal(s.tool("Read", { file_path: join(sandbox, "src", "a.ts") }).status, 0);
      assert.equal(s.bash("cat src/a.ts").status, 0);
      assert.equal(s.edit().status, 2, "Read and cat must not unlock");
      assert.equal(s.bash(command).status, 0, command);
      assert.equal(s.edit().status, 0, `${command} must unlock`);
      assert.equal(s.bash(SED_WRITE).status, 2);
      assert.equal(s.edit().status, 0, "the count restarts after an unlock");
    }
  });

  void test("the Grep tool unlocks", () => {
    const s = session();
    for (let i = 0; i < POLICY.mutationLockAt; i += 1) s.bash(SED_WRITE);
    assert.equal(s.edit().status, 2);
    assert.equal(s.tool("Grep", { pattern: "applyDamage" }).status, 0);
    assert.equal(s.edit().status, 0);
  });

  void test("a search chained with a mutation does not unlock", () => {
    const s = session();
    for (let i = 0; i < POLICY.mutationLockAt; i += 1) s.bash(SED_WRITE);
    assert.equal(s.bash("rg -n a src && git status").status, 0);
    assert.equal(s.edit().status, 2);
    assert.equal(s.bash("rg -n a src > src/hits.txt").status, 0);
    assert.equal(s.edit().status, 2);
  });

  void test("a missing session id fails open", () => {
    const result = spawnSync(process.execPath, [EDIT_HOOK], {
      input: JSON.stringify({ tool_name: "Edit", tool_input: {} }),
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
  });
});

void describe("isReassessmentCommand", () => {
  void test("accepts searches and map lookups, optionally piped to head, tail or wc", () => {
    for (const command of [
      "pnpm agent:map foo",
      "rg -n foo packages",
      "rg -n foo packages | head -20",
      "grep -rn foo . | tail -5",
      "rg -c foo | wc -l",
    ]) {
      assert.equal(isReassessmentCommand(command), true, command);
    }
  });

  void test("rejects everything else", () => {
    for (const command of [
      "cat src/a.ts",
      "git status",
      "rg foo && sed -i 's/a/b/' x.ts",
      "rg foo | xargs sed -i 's/a/b/'",
      "rg foo > src/x.ts",
      "pnpm test",
      "",
    ]) {
      assert.equal(isReassessmentCommand(command), false, command);
    }
  });
});
