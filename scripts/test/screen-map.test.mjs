import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";

import { parseArguments, run } from "../agent-map.mjs";
import { describeScreen, listScreens } from "../lib/screen-map.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const created = [];

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "bw-screen-map-"));
  created.push(dir);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  const files = {
    "apps/desktop/src/renderer/screens/alpha/AlphaScreen.tsx": "a\nb\nc\n",
    "apps/desktop/src/renderer/screens/alpha/parts/Deep.tsx": "x\n",
    "apps/desktop/src/renderer/screens/alpha/AlphaScreen.test.tsx": "t\n",
    "apps/desktop/src/renderer/screens/beta/BetaWorkspace.tsx": "b\n",
    "apps/desktop/src/renderer/shell/App.tsx": "import AlphaScreen from 'x'; AlphaScreen;\n",
    "apps/desktop/e2e/alpha.spec.ts": "e\n",
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

test("lists screens with their entry file and test counts", () => {
  const screens = listScreens(fixture());
  assert.deepEqual(
    screens.map((s) => [s.name, s.entry?.split("/").pop(), s.tests]),
    [
      ["alpha", "AlphaScreen.tsx", 1],
      ["beta", "BetaWorkspace.tsx", 0],
    ],
  );
});

test("describes a screen: routes, largest files, tests and e2e", () => {
  const report = describeScreen(fixture(), "alpha", 5);
  assert.equal(report.routes[0], "apps/desktop/src/renderer/shell/App.tsx");
  assert.equal(report.largest[0].lines, 3);
  assert.equal(report.tests.length, 1);
  assert.deepEqual(report.e2e, ["apps/desktop/e2e/alpha.spec.ts"]);
  assert.equal(describeScreen(fixture(), "missing", 5), null);
});

test("argument parsing accepts --screen with an optional name only", () => {
  assert.deepEqual(parseArguments(["--screen"]), {
    help: false,
    screen: true,
    query: null,
    json: false,
    limit: 8,
  });
  assert.equal(parseArguments(["--screen", "fleet"]).query, "fleet");
  assert.throws(() => parseArguments(["--screen", "a", "b"]));
});

test("run returns 4 for an unknown screen and 0 for a known one in the real repo", () => {
  const realWrite = process.stdout.write.bind(process.stdout);
  const realError = process.stderr.write.bind(process.stderr);
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  try {
    assert.equal(run(["--screen", "definitely-not-a-screen"], ROOT), 4);
    assert.equal(run(["--screen", "fleet"], ROOT), 0);
  } finally {
    process.stdout.write = realWrite;
    process.stderr.write = realError;
  }
});

test("every screen documented in desktop-view.md exists in the generated map", () => {
  const names = new Set(listScreens(ROOT).map((s) => s.name));
  for (const name of ["fleet", "shipbuilding", "strategic-map", "options"])
    assert.ok(names.has(name), name);
});
