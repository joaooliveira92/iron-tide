// Per-version save-compatibility corpus (release-readiness WS3 / ADR-0113 §5):
// every released compatibility version contributes a frozen save under
// `test/fixtures/save-corpus/<version>/`. Loading it is the regression net for
// the next format bump — a future change to the on-disk schema, the envelope,
// the canonical serializer or the compatibility gate must keep every released
// save either loadable (migration) or rejected with the *stable* mismatch
// diagnostic, never a generic corruption code.

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  COMPATIBILITY_MISMATCH_CODE,
  CURRENT_COMPATIBILITY_VERSION,
} from "../src/compatibility.js";
import { CORRUPT_SAVE_CODE } from "../src/errors.js";
import { SaveStore } from "../src/store.js";

const corpusDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "save-corpus");

const versions = readdirSync(corpusDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe("save-compatibility corpus (ADR-0113 §5)", () => {
  let store: SaveStore;
  let diagnostics: DiagnosticCollector;

  beforeEach(() => {
    store = new SaveStore();
    diagnostics = new DiagnosticCollector();
  });

  afterEach(() => {
    diagnostics = new DiagnosticCollector();
  });

  it("contains a fixture for the current release version", () => {
    expect(versions).toContain(CURRENT_COMPATIBILITY_VERSION);
  });

  for (const version of versions) {
    const dir = join(corpusDir, version);

    if (version === CURRENT_COMPATIBILITY_VERSION) {
      it(`loads the released ${version} save`, () => {
        const loaded = store.load(dir, diagnostics);

        expect(diagnostics.hasErrors).toBe(false);
        expect(loaded).not.toBeNull();
        expect(loaded?.snapshot.compatibilityVersion).toBe(CURRENT_COMPATIBILITY_VERSION);
      });
    } else {
      it(`rejects the superseded ${version} save with the stable mismatch code`, () => {
        const loaded = store.load(dir, diagnostics);

        expect(loaded).toBeNull();
        expect(diagnostics.errors.map((d) => d.code)).toEqual([COMPATIBILITY_MISMATCH_CODE]);
        expect(diagnostics.errors.some((d) => d.code === CORRUPT_SAVE_CODE)).toBe(false);
      });
    }
  }
});
