import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ProjectStore, projectStoreLayer } from "./projectStore.js";

describe("project store save listing", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bw-list-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("logs an unreadable save instead of dropping it silently", async () => {
    const unreadable = join(dir, "unreadable-save");
    mkdirSync(unreadable);
    writeFileSync(join(unreadable, "campaign.json"), "{ not json", "utf8");
    const messages: string[] = [];
    const collector = Logger.make((options) => {
      messages.push(String(options.message));
    });

    const saves = await Effect.runPromise(
      Effect.gen(function* () {
        const projects = yield* ProjectStore;
        return yield* projects.list(dir);
      }).pipe(Effect.provide(projectStoreLayer()), Effect.provide(Logger.layer([collector]))),
    );

    expect(saves).toEqual([]);
    expect(messages).toEqual([expect.stringContaining("persistence.list: Save unreadable-save")]);
  });
});
