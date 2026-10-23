import assert from "node:assert/strict";
import test from "node:test";

import { checkReleaseRef } from "../verify-release-ref.mjs";

const ok = { refType: "tag", refName: "v4.0.0", desktopVersion: "4.0.0", onMaster: true };

void test("a tag matching the desktop version on main passes", () => {
  assert.deepEqual(checkReleaseRef(ok), []);
});

void test("a pre-release tag matches its full version", () => {
  assert.deepEqual(
    checkReleaseRef({ ...ok, refName: "v4.1.0-rc.1", desktopVersion: "4.1.0-rc.1" }),
    [],
  );
});

void test("a branch ref is refused", () => {
  const problems = checkReleaseRef({ ...ok, refType: "branch", refName: "dev" });
  assert.ok(problems.some((p) => /must run from a tag/u.test(p)));
});

void test("a tag that is not a version is refused", () => {
  for (const refName of ["vnext", "v4", "v4.0", "release-4.0.0", "v4.0.0.1"]) {
    const problems = checkReleaseRef({ ...ok, refName });
    assert.ok(
      problems.some((p) => /not a release version/u.test(p)),
      refName,
    );
  }
});

void test("a tag that disagrees with the desktop version is refused", () => {
  const problems = checkReleaseRef({ ...ok, desktopVersion: "4.0.1" });
  assert.ok(problems.some((p) => /does not match/u.test(p)));
});

void test("a tag whose commit is not on main is refused", () => {
  const problems = checkReleaseRef({ ...ok, onMaster: false });
  assert.ok(problems.some((p) => /not reachable from origin\/main/u.test(p)));
});

void test("every problem is reported, not only the first", () => {
  const problems = checkReleaseRef({
    refType: "branch",
    refName: "dev",
    desktopVersion: "4.0.0",
    onMaster: false,
  });
  assert.ok(problems.length >= 3);
});
