import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkCoherence,
  readCompatibilityVersion,
  readDesktopVersion,
} from "../verify-version-coherence.mjs";

void test("reads the desktop version and the compatibility constant", () => {
  assert.equal(readDesktopVersion('{"version":"1.2.0"}'), "1.2.0");
  assert.equal(
    readCompatibilityVersion('export const CURRENT_COMPATIBILITY_VERSION = "1.2.0";'),
    "1.2.0",
  );
});

void test("coherent versions pass", () => {
  assert.deepEqual(checkCoherence({ desktopVersion: "1.2.0", compatibilityVersion: "1.2.0" }), []);
});

void test("a mismatch is reported", () => {
  const problems = checkCoherence({ desktopVersion: "1.3.0", compatibilityVersion: "1.2.0" });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /1\.3\.0.*1\.2\.0/);
});
