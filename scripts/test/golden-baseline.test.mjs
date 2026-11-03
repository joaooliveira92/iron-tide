import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const GOLDEN = resolve(import.meta.dirname, "..", "..", "golden/hashes.json");

void test("golden/hashes.json is a successful reference run of valid digests", () => {
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.equal(golden.success, true, "golden does not record a successful reference run");
  const hashKeys = Object.keys(golden).filter((key) => key !== "success");
  assert.ok(hashKeys.length > 0, "golden has no hash keys");
  for (const key of hashKeys) {
    assert.match(golden[key], /^[0-9a-f]{64}$/u, `golden.${key} is not a SHA-256 hex digest`);
  }
});
