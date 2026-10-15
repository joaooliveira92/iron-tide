import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSubject, renderChangelog } from "../changelog.mjs";

void test("parses conventional subjects with and without a scope", () => {
  assert.deepEqual(parseSubject("feat(combat): add torpedo spread"), {
    type: "feat",
    scope: "combat",
    description: "add torpedo spread",
  });
  assert.deepEqual(parseSubject("fix: repair the ledger"), {
    type: "fix",
    scope: undefined,
    description: "repair the ledger",
  });
  assert.equal(parseSubject("not a conventional commit"), null);
});

void test("groups user-facing commits by section and omits the rest", () => {
  const draft = renderChangelog(
    [
      { hash: "a", subject: "feat(map): draw coastlines" },
      { hash: "b", subject: "fix(combat): stop the crash" },
      { hash: "c", subject: "perf: speed up month advance" },
      { hash: "d", subject: "docs: edit a readme" },
      { hash: "e", subject: "chore: bump a dep" },
    ],
    "v1.2.0",
  );
  assert.match(draft, /^## v1\.2\.0\n/);
  assert.match(draft, /### Added\n\n- \*\*map:\*\* draw coastlines/);
  assert.match(draft, /### Changed\n\n- speed up month advance/);
  assert.match(draft, /### Fixed\n\n- \*\*combat:\*\* stop the crash/);
  assert.doesNotMatch(draft, /readme|bump a dep/u);
});

void test("notes when a release has no user-facing changes", () => {
  const draft = renderChangelog([{ hash: "a", subject: "docs: tweak" }], "v1.2.0");
  assert.match(draft, /No user-facing changes/);
});
