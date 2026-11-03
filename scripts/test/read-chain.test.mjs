import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";

import { rangeReadTargets, trailingChainLength } from "../lib/read-chain.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const HOOK = join(ROOT, "scripts/hooks/pre-tool-use-bash.mjs");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);
const CWD = resolve("/work/repo");
const FILE = join(CWD, "src", "a.ts");
const posix = (path) => path.replaceAll("\\", "/");

const toolUse = (name, input, id) => ({ type: "tool_use", id, name, input });
const assistantLine = (...blocks) =>
  JSON.stringify({ type: "assistant", cwd: CWD, message: { content: blocks } });
const bashRead = (command, id = command) => assistantLine(toolUse("Bash", { command }, id));
const nativeRead = (input, id = JSON.stringify(input)) => assistantLine(toolUse("Read", input, id));

void describe("rangeReadTargets", () => {
  const targets = (command) => rangeReadTargets(command, CWD);

  void test("recognises sed, head and tail ranges", () => {
    assert.deepEqual(targets("sed -n 10,40p src/a.ts"), [FILE]);
    assert.deepEqual(targets("sed -n '10,40p' src/a.ts"), [FILE]);
    assert.deepEqual(targets("head -n 30 src/a.ts"), [FILE]);
    assert.deepEqual(targets("head -30 src/a.ts"), [FILE]);
    assert.deepEqual(targets("tail -n 30 src/a.ts"), [FILE]);
  });
  void test("resolves absolute paths and leading cd", () => {
    assert.deepEqual(targets(`sed -n 1,5p ${posix(FILE)}`), [FILE]);
    assert.deepEqual(targets("cd src && sed -n 1,5p a.ts"), [FILE]);
  });
  void test("ignores whole-file reads, searches and piped input", () => {
    assert.deepEqual(targets("cat src/a.ts"), []);
    assert.deepEqual(targets("rg -n foo src/a.ts"), []);
    assert.deepEqual(targets("git log | head -20"), []);
    assert.deepEqual(targets("sed -i s/a/b/ src/a.ts"), []);
  });
  void test("ignores dynamic paths", () => {
    assert.deepEqual(targets("sed -n 1,5p $FILE"), []);
    assert.deepEqual(targets("sed -n 1,5p src/*.ts"), []);
  });
});

void describe("trailingChainLength", () => {
  const chain = (lines, current = {}) =>
    trailingChainLength({ lines, path: FILE, cwd: CWD, currentToolUseId: "now", ...current });

  void test("counts consecutive Bash and native range reads of the file", () => {
    const lines = [
      bashRead("sed -n 1,50p src/a.ts"),
      nativeRead({ file_path: FILE, offset: 50, limit: 50 }),
    ];
    assert.equal(chain(lines), 2);
  });
  void test("any other tool call resets the chain", () => {
    const lines = [
      bashRead("sed -n 1,50p src/a.ts"),
      bashRead("pnpm test"),
      bashRead("sed -n 50,90p src/a.ts"),
    ];
    assert.equal(chain(lines), 1);
  });
  void test("a range read of another file resets the chain", () => {
    const lines = [
      bashRead("sed -n 1,50p src/a.ts"),
      bashRead("sed -n 1,50p src/b.ts"),
      bashRead("sed -n 50,90p src/a.ts"),
    ];
    assert.equal(chain(lines), 1);
  });
  void test("a native read without a range resets the chain", () => {
    const lines = [bashRead("sed -n 1,50p src/a.ts"), nativeRead({ file_path: FILE })];
    assert.equal(chain(lines), 0);
  });
  void test("text-only and user records do not break the chain", () => {
    const lines = [
      bashRead("sed -n 1,50p src/a.ts"),
      assistantLine({ type: "text", text: "next" }),
      JSON.stringify({ type: "user", message: { content: [] } }),
      bashRead("sed -n 50,90p src/a.ts"),
    ];
    assert.equal(chain(lines), 2);
  });
  void test("sidechain records and malformed lines are skipped", () => {
    const lines = [
      bashRead("sed -n 1,50p src/a.ts"),
      JSON.stringify({ type: "assistant", isSidechain: true, message: { content: [] } }),
      "not json",
      "",
    ];
    assert.equal(chain(lines), 1);
  });
  void test("excludes the current tool call when it is already in the transcript", () => {
    const lines = [bashRead("sed -n 1,50p src/a.ts"), bashRead("sed -n 50,90p src/a.ts", "now")];
    assert.equal(chain(lines), 1);
  });
});

void describe("hook deny on the third consecutive range read", () => {
  let sandbox;
  let transcript;

  before(() => {
    mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
    sandbox = mkdtempSync(join(ROOT, "node_modules/.cache", "read-chain-"));
    writeFileSync(join(sandbox, "a.ts"), "x\n");
    transcript = join(sandbox, "transcript.jsonl");
  });
  after(() => rmSync(sandbox, { recursive: true, force: true }));

  const target = () => posix(join(sandbox, "a.ts"));
  const run = (command, history) => {
    writeFileSync(transcript, history.map((line) => `${line}\n`).join(""));
    const result = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({
        tool_name: "Bash",
        cwd: sandbox,
        transcript_path: transcript,
        tool_use_id: "now",
        tool_input: { command },
      }),
      encoding: "utf8",
      env: { ...process.env, [POLICY.guardAuditLogEnv]: join(sandbox, "overrides.log") },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  };
  const read = (from) => `sed -n ${from},${from + 40}p ${target()}`;

  void test("allows the second range read", () => {
    const result = run(read(41), [bashRead(read(1))]);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });
  void test("denies the third with a permissionDecision payload", () => {
    const result = run(read(81), [bashRead(read(1)), bashRead(read(41))]);
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(output.hookEventName, "PreToolUse");
    assert.equal(output.permissionDecision, "deny");
    assert.match(output.permissionDecisionReason, /rg -n/u);
    assert.match(output.permissionDecisionReason, /agent-guard: allow/u);
  });
  void test("denies when the earlier reads were native range reads", () => {
    const result = run(read(81), [
      nativeRead({ file_path: target(), offset: 1, limit: 40 }),
      nativeRead({ file_path: target(), offset: 41, limit: 40 }),
    ]);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, "deny");
  });
  void test("allows when another call interrupts the chain", () => {
    const result = run(read(81), [bashRead(read(1)), bashRead("pnpm test"), bashRead(read(41))]);
    assert.equal(result.stdout, "");
  });
  void test("an audited override lets the third read through", () => {
    const result = run(`${read(81)} # agent-guard: allow need contiguous block`, [
      bashRead(read(1)),
      bashRead(read(41)),
    ]);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });
  void test("fails open on an unreadable transcript", () => {
    const result = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({
        tool_name: "Bash",
        cwd: sandbox,
        transcript_path: join(sandbox, "missing.jsonl"),
        tool_input: { command: read(1) },
      }),
      encoding: "utf8",
      env: { ...process.env, [POLICY.guardAuditLogEnv]: join(sandbox, "overrides.log") },
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });
});
