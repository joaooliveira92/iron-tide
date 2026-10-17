// Tests for scripts/assert-presentation-formatting.mjs — the U-5 ticket 05
// storage rule in the presentation gate (map D6). A direct localStorage/
// sessionStorage reference in a settings/formatting/Options surface fails the
// gate; the preferences consumers stay clean.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { scan } from "../assert-presentation-formatting.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const RENDERER = "apps/desktop/src/renderer";

let workspace = null;

after(() => {
  if (workspace !== null) rmSync(workspace, { recursive: true, force: true });
});

function makeTree(files) {
  workspace = mkdtempSync(join(tmpdir(), "bw-presentation-gate-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(workspace, RENDERER, rel);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return workspace;
}

void test("flags a direct localStorage read in a guarded Options surface", () => {
  const root = makeTree({
    "screens/options/Leaky.tsx": 'const value = localStorage.getItem("bluewave");\n',
  });
  const findings = scan(root);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /screens\/options\/Leaky\.tsx:1:localStorage:/u);
});

void test("flags a direct sessionStorage write in a guarded settings string surface", () => {
  const root = makeTree({
    "lib/strings.ts": 'sessionStorage.setItem("k", "v");\n',
  });
  const findings = scan(root);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /lib\/strings\.ts:1:sessionStorage:/u);
});

void test("does not flag a storage mention in a guarded comment", () => {
  const root = makeTree({
    "screens/options/Commented.tsx":
      "// legacy localStorage key, never read here\n/* localStorage */\n",
  });
  assert.deepEqual(scan(root), []);
});

void test("does not flag storage outside the guarded surfaces", () => {
  const root = makeTree({
    "screens/campaign-file/utils/recent-files.ts": 'localStorage.setItem("recent", "[]");\n',
  });
  assert.deepEqual(scan(root), []);
});

void test("the preferences consumers have no storage finding in the real tree", () => {
  const findings = scan(ROOT);
  assert.ok(findings.length > 0, "found no renderer sources — discovery bug");
  const storageFindings = findings.filter((finding) => /:(?:local|session)Storage:/u.test(finding));
  const consumers = [
    "lib/preferences-context.tsx",
    "shell/ThemeContext.tsx",
    "shell/DensityContext.tsx",
    "shell/FontContext.tsx",
    "shell/BackgroundContext.tsx",
  ];
  for (const consumer of consumers) {
    assert.ok(
      !storageFindings.some((finding) => finding.includes(`/${consumer}:`)),
      `${consumer} has an unbaselined storage finding`,
    );
  }
  // Every remaining storage finding is the explicit legacy-migration baseline.
  assert.deepEqual(
    [...new Set(storageFindings.map((finding) => finding.split(":")[0]))].sort((a, b) =>
      a.localeCompare(b),
    ),
    ["apps/desktop/src/renderer/screens/campaign-preferences/hooks/useDisplayPreferences.ts"],
  );
});
