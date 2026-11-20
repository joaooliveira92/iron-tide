// Tests for scripts/verify-codemod-determinism.mjs — the build plan that makes the gate
// self-contained. The regression it guards: the content-codemod tests load
// @bluewave/content-authoring through its built dist/, which sits outside the
// content-codemod build closure, so the gate passed only when a sibling gate won a race.
import assert from "node:assert/strict";
import { test } from "node:test";

import { CODEMOD_BUILD_ARGS } from "../verify-codemod-determinism.mjs";

void test("the gate builds the content-authoring closure as well as the content-codemod closure", () => {
  assert.deepEqual(CODEMOD_BUILD_ARGS, [
    "--filter",
    "@bluewave/content-codemod...",
    "--filter",
    "@bluewave/content-authoring...",
    "build",
  ]);
});
