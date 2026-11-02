import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";

import { evaluateBashCommand, tokenizeCommand } from "../lib/agent-guard.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const HOOK = join(ROOT, "scripts/hooks/pre-tool-use-bash.mjs");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);

let sandbox;
let auditLog;

const lines = (count) => `${Array.from({ length: count }, (_, i) => `line ${i}`).join("\n")}\n`;

before(() => {
  mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
  sandbox = mkdtempSync(join(ROOT, "node_modules/.cache", "agent-guard-"));
  auditLog = join(sandbox, "overrides.log");
  mkdirSync(join(sandbox, "my dir"));
  writeFileSync(join(sandbox, "small.ts"), lines(10));
  writeFileSync(join(sandbox, "big.ts"), lines(POLICY.catMaxLines + 50));
  writeFileSync(join(sandbox, "my dir", "big file.ts"), lines(POLICY.catMaxLines + 50));
  writeFileSync(join(sandbox, "existing.ts"), lines(5));
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

function runHook(input) {
  const stdin = typeof input === "string" ? input : JSON.stringify(input);
  const result = spawnSync(process.execPath, [HOOK], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, [POLICY.guardAuditLogEnv]: auditLog },
  });
  return { status: result.status, stderr: result.stderr };
}

const bash = (command, cwd = sandbox) =>
  runHook({ tool_name: "Bash", cwd, tool_input: { command } });

describe("cat dumps", () => {
  test("allows a small file", () => assert.equal(bash("cat small.ts").status, 0));
  test("blocks a file above the line limit with the safe alternative", () => {
    const result = bash("cat big.ts");
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Read tool/u);
    assert.match(result.stderr, /agent-guard: allow/u);
  });
  test("blocks through a leading cd", () =>
    assert.equal(bash("cd .. && cat big.ts", join(sandbox, "my dir")).status, 2));
  test("handles paths with spaces", () => {
    assert.equal(bash('cat "my dir/big file.ts"').status, 2);
    assert.equal(bash("cd 'my dir' && cat 'big file.ts'").status, 2);
  });
  test("allows bounded and ranged reads", () => {
    assert.equal(bash("sed -n 1,50p big.ts").status, 0);
    assert.equal(bash("head -50 big.ts").status, 0);
    assert.equal(bash("cat big.ts | head -20").status, 0);
    assert.equal(bash("rg -n line big.ts | head -60").status, 0);
  });
  test("allows redirecting cat output and stderr merging on small files", () => {
    assert.equal(bash("cat big.ts > copy.txt").status, 0);
    assert.equal(bash("cat small.ts 2>&1").status, 0);
  });
  test("fails open on a missing file or dynamic path", () => {
    assert.equal(bash("cat nope.ts").status, 0);
    assert.equal(bash("cat $HOME/big.ts").status, 0);
  });
});

describe("write patterns", () => {
  test("allows a read-only python heredoc", () =>
    assert.equal(
      bash("python3 - <<'EOF'\nimport json\nprint(json.dumps({'a': 1}))\nEOF").status,
      0,
    ));
  test("blocks a python heredoc that writes", () => {
    assert.equal(bash("python3 - <<'EOF'\nopen('a.ts', 'w').write('x')\nEOF").status, 2);
    assert.equal(
      bash("python3 - <<'EOF'\nfrom pathlib import Path\nPath('a').write_text('x')\nEOF").status,
      2,
    );
    assert.equal(bash("node -e \"require('fs').writeFileSync('a','b')\"").status, 2);
  });
  test("blocks sed -i in its common spellings", () => {
    assert.equal(bash("sed -i '' 's/a/b/' x.ts").status, 2);
    assert.equal(bash("sed -i.bak 's/a/b/' x.ts").status, 2);
    assert.equal(bash("sed --in-place 's/a/b/' x.ts").status, 2);
    assert.equal(bash("sed -ni 's/a/b/p' x.ts").status, 2);
    assert.equal(bash("sed -n -e 's/a/b/p' x.ts").status, 0);
  });
  test("blocks a heredoc overwrite of an existing file but not a new or scratch file", () => {
    assert.equal(bash("cat > existing.ts <<'EOF'\nx\nEOF").status, 2);
    assert.equal(bash("cat > brand-new.ts <<'EOF'\nx\nEOF").status, 0);
    assert.equal(bash("cat > /tmp/agent-guard-scratch.txt <<'EOF'\nx\nEOF").status, 0);
  });
  test("allows commit-message heredocs", () =>
    assert.equal(bash("git commit -q -F - <<'EOF'\nfix: x\n\nbody\nEOF").status, 0));
});

describe("override", () => {
  test("allows a blocked command with a reason and writes an audit line", () => {
    const result = bash("cat big.ts # agent-guard: allow need the full file for a diff");
    assert.equal(result.status, 0);
    const entry = JSON.parse(readFileSync(auditLog, "utf8").trim().split("\n").at(-1));
    assert.equal(entry.rule, "cat-dump");
    assert.match(entry.reason, /full file/u);
  });
  test("rejects an override without a reason", () =>
    assert.equal(bash("cat big.ts # agent-guard: allow").status, 2));
});

describe("fail-safe behaviour", () => {
  test("malformed hook input exits 0", () => {
    for (const input of ["", "not json", "[]", "null", '{"tool_input":{"command":42}}']) {
      const result = runHook(input);
      assert.equal(result.status, 0, input);
    }
  });
  test("unterminated quotes and heredocs do not crash", () => {
    assert.equal(bash("cat 'unterminated").status, 0);
    assert.equal(bash("python3 - <<'EOF'\nprint(1)").status, 0);
  });
});

describe("tokenizer", () => {
  test("splits operators, keeps quoted words whole and captures redirects", () => {
    const segments = tokenizeCommand("cd 'a b' && cat \"c d\" | head -3; echo hi 2>&1 > out.txt");
    assert.deepEqual(segments[0].words, ["cd", "a b"]);
    assert.deepEqual(segments[1].words, ["cat", "c d"]);
    assert.equal(segments[1].pipedOut, true);
    assert.deepEqual(
      segments[3].redirects.map((r) => [r.fd, r.target]),
      [
        ["2", "&1"],
        ["", "out.txt"],
      ],
    );
  });
  test("evaluate is a pure function of its inputs", () => {
    const fsApi = { exists: () => true, lineCount: () => 999 };
    const input = { command: "cat x.ts", cwd: "/work", policy: POLICY, fsApi };
    assert.deepEqual(evaluateBashCommand(input), evaluateBashCommand(input));
  });
});
