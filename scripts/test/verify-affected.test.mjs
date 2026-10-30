import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import {
  execute,
  parseArguments,
  planAffected,
  run,
  unitCommands,
  VerifyError,
} from "../verify-affected.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");

const WORKSPACES = [
  {
    dir: "packages/a",
    name: "@x/a",
    kind: "package",
    scripts: { build: "tsc -b", test: "vp test run", lint: "vp lint ." },
    dependencies: [],
    exports: null,
  },
  {
    dir: "packages/b",
    name: "@x/b",
    kind: "package",
    scripts: { build: "tsc -b" },
    dependencies: ["@x/a"],
    exports: null,
  },
  {
    dir: "content",
    name: "content",
    kind: "content",
    scripts: {},
    dependencies: [],
    exports: null,
  },
];

function sink() {
  const chunks = [];
  return {
    stream: {
      write(chunk) {
        chunks.push(String(chunk));
        return true;
      },
    },
    text: () => chunks.join(""),
  };
}

void test("verify:affected parses its arguments", () => {
  assert.deepEqual(parseArguments(["--base", "main", "--dry-run", "--verbose"]), {
    help: false,
    base: "main",
    dryRun: true,
    verbose: true,
  });
  assert.deepEqual(parseArguments(["--help"]), { help: true });
  assert.throws(
    () => parseArguments(["--base", " "]),
    (error) => error instanceof VerifyError && error.code === 2,
  );
  assert.throws(
    () => parseArguments(["--nope"]),
    (error) => error instanceof VerifyError && error.code === 2,
  );
});

void test("verify:affected has nothing to do without changes", () => {
  assert.deepEqual(planAffected({ paths: [], workspaces: WORKSPACES }), {
    full: false,
    reasons: {},
    units: [],
  });
});

void test("verify:affected selects one package and its dependents", () => {
  const plan = planAffected({ paths: ["packages/a/src/x.ts"], workspaces: WORKSPACES });
  assert.equal(plan.full, false);
  assert.deepEqual(
    plan.units.map((unit) => unit.name),
    ["@x/a", "@x/b"],
  );
  assert.deepEqual(plan.reasons["@x/b"], ["depends on a changed package"]);
  assert.deepEqual(
    unitCommands(plan.units[0]).map((command) => command.label),
    ["build", "test", "lint"],
  );
});

void test("verify:affected selects multiple packages deterministically", () => {
  const plan = planAffected({
    paths: ["packages/b/src/y.ts", "packages/a/src/x.ts"],
    workspaces: WORKSPACES,
  });
  assert.deepEqual(
    plan.units.map((unit) => unit.dir),
    ["packages/a", "packages/b"],
  );
});

void test("verify:affected routes shared configuration to full scope", () => {
  const plan = planAffected({ paths: ["package.json"], workspaces: WORKSPACES });
  assert.equal(plan.full, true);
  assert.deepEqual(
    plan.units.map((unit) => unit.kind),
    ["content", "docs", "golden", "package", "package", "scripts"],
  );
  assert.equal(plan.units.find((unit) => unit.name === "@x/a").scripts.lint, undefined);
  assert.deepEqual(
    unitCommands(plan.units.find((unit) => unit.kind === "golden")).map((command) => command.label),
    ["check:golden"],
  );
});

void test("verify:affected routes docs, scripts, goldens and content to their own units", () => {
  const docs = planAffected({ paths: ["docs/agents/repo-map.md"], workspaces: WORKSPACES });
  assert.deepEqual(
    docs.units.map((unit) => unit.kind),
    ["docs"],
  );
  const scripts = planAffected({ paths: ["scripts/heavy.mjs"], workspaces: WORKSPACES });
  assert.deepEqual(
    scripts.units.map((unit) => unit.kind),
    ["scripts"],
  );
  const golden = planAffected({ paths: ["golden/hashes.json"], workspaces: WORKSPACES });
  assert.deepEqual(
    golden.units.map((unit) => unit.kind),
    ["golden"],
  );
  const content = planAffected({ paths: ["content/production/x.yaml"], workspaces: WORKSPACES });
  assert.deepEqual(
    content.units.map((unit) => unit.kind),
    ["content"],
  );
});

void test("verify:affected falls back to full scope for an unowned path", () => {
  const plan = planAffected({ paths: ["Makefile"], workspaces: WORKSPACES });
  assert.equal(plan.full, true);
  assert.deepEqual(plan.reasons.unowned, ["Makefile"]);
});

void test("verify:affected prints the plan without executing it", async () => {
  const output = sink();
  const plan = planAffected({ paths: ["packages/a/src/x.ts"], workspaces: WORKSPACES });
  const code = await execute(plan, {
    root: tmpdir(),
    dryRun: true,
    verbose: false,
    out: output.stream,
    err: output.stream,
  });
  assert.equal(code, 0);
  assert.match(output.text(), /PLAN packages\/a \(build,test,lint\)/u);
  assert.match(output.text(), /2 unit\(s\) planned/u);
});

void test("verify:affected reports a failure, keeps the log and releases the lock", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bw-verify-affected-"));
  const output = sink();
  let released = 0;
  try {
    const plan = planAffected({ paths: ["packages/a/src/x.ts"], workspaces: WORKSPACES });
    const code = await execute(
      plan,
      { root: dir, dryRun: false, verbose: false, out: output.stream, err: output.stream },
      {
        acquireLock: async () => () => {
          released += 1;
        },
        registerSignal: () => {},
        spawnCommand: async ({ logPath, onChild }) => {
          writeFileSync(logPath, "boom: expected 1\n");
          onChild({ kill: () => {} });
          return { code: 1 };
        },
      },
    );
    assert.equal(code, 1);
    assert.equal(released, 1);
    assert.match(output.text(), /FAIL packages\/a build \(exit 1\)/u);
    assert.match(output.text(), /boom: expected 1/u);
    assert.match(output.text(), /2 of 2 unit\(s\) failed/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("verify:affected cancels the running command and releases the lock", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bw-verify-cancel-"));
  const output = sink();
  const handlers = new Map();
  let released = 0;
  try {
    const plan = planAffected({ paths: ["packages/a/src/x.ts"], workspaces: WORKSPACES });
    const running = execute(
      plan,
      { root: dir, dryRun: false, verbose: false, out: output.stream, err: output.stream },
      {
        acquireLock: async () => () => {
          released += 1;
        },
        registerSignal: (signal, handler) => handlers.set(signal, handler),
        spawnCommand: ({ logPath, onChild }) =>
          new Promise((resolvePromise) => {
            writeFileSync(logPath, "");
            onChild({ kill: () => resolvePromise({ code: 143, signal: "SIGINT" }) });
          }),
      },
    );
    await new Promise((done) => setImmediate(done));
    handlers.get("SIGINT")();
    assert.equal(await running, 130);
    assert.equal(released, 1);
    assert.match(output.text(), /cancelled/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("verify:affected rejects a base that does not resolve", async () => {
  const code = await run(["--base", "definitely-not-a-ref", "--dry-run"], ROOT);
  assert.equal(code, 2);
});
