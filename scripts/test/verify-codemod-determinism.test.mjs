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
