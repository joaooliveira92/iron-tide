import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SaveStore } from "@bluewave/persistence";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ProjectStore, projectStoreLayer } from "./projectStore.js";
import { PROVISIONAL_RETAINED_SAVES } from "./saveRetention.js";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { GENERATED_ARTIFACT } from "../commands/warSessionFixture.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { toSaveableState } from "../saveHelpers.js";

describe("project store save retention", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bw-retention-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const productionState = () => {
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      new DiagnosticCollector(),
    );
    if (!output) throw new Error("production pack failed to compile");
    return toSaveableState(output.state);
  };

  it("prunes saves beyond the retention count", async () => {
    const state = productionState();
    const program = Effect.gen(function* () {
      const projects = yield* ProjectStore;
      for (let i = 0; i < PROVISIONAL_RETAINED_SAVES + 5; i += 1) {
        yield* projects.save(state, dir, {});
      }
    }).pipe(Effect.provide(projectStoreLayer()));
    await Effect.runPromise(program);
    expect(new SaveStore().list(dir)).toHaveLength(PROVISIONAL_RETAINED_SAVES);
  });
});
