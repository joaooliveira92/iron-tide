import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import {
  COMPATIBILITY_MISMATCH_CODE,
  CURRENT_COMPATIBILITY_VERSION,
} from "../src/compatibility.js";
import { SaveStore } from "../src/store.js";
import { expectFailureTag, runExit, unwrapSuccess } from "./harness.js";

const corpusDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "save-corpus");

const versions = readdirSync(corpusDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe("save-compatibility corpus (ADR-0113 §5)", () => {
  const store = new SaveStore();

  it("contains a fixture for the current release version", () => {
    expect(versions).toContain(CURRENT_COMPATIBILITY_VERSION);
  });

  for (const version of versions) {
    const dir = join(corpusDir, version);

    if (version === CURRENT_COMPATIBILITY_VERSION) {
      it(`loads the released ${version} save`, () => {
        const loaded = unwrapSuccess(runExit(store.load(dir)));

        expect(loaded.state.snapshot.compatibilityVersion).toBe(CURRENT_COMPATIBILITY_VERSION);
      });
    } else {
      it(`rejects the superseded ${version} save with the stable mismatch code`, () => {
        const error = expectFailureTag(
          runExit(store.load(dir)),
          "PERSISTENCE_COMPATIBILITY_MISMATCH",
        );

        expect(error.code).toBe(COMPATIBILITY_MISMATCH_CODE);
      });
    }
  }
});
