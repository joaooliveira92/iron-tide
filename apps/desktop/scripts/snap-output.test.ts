import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { clearStaleArtifacts } from "./snap-output.ts";

describe("clearStaleArtifacts", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "snap-output-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const seed = (names: readonly string[]) =>
    Promise.all(names.map((name) => writeFile(join(dir, name), "x")));

  it("removes the fixed artifacts and this run's shot names", async () => {
    await seed(["screenshot.png", "aria.txt", "text.txt", "console.log", "steps.json", "a.png"]);
    await clearStaleArtifacts(dir, ["a"]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("removes shots the previous manifest produced but leaves unrelated files alone", async () => {
    await seed(["old.png", "notes.md", "keep.png"]);
    await writeFile(
      join(dir, "steps.json"),
      JSON.stringify({ artifacts: ["old.png", "../escape.png", 7, "screenshot.png"] }),
    );
    await clearStaleArtifacts(dir, []);
    expect((await readdir(dir)).sort()).toEqual(["keep.png", "notes.md"]);
  });

  it("tolerates a missing or corrupt manifest", async () => {
    await expect(clearStaleArtifacts(dir, [])).resolves.toBeDefined();
    await writeFile(join(dir, "steps.json"), "{not json");
    await seed(["screenshot.png"]);
    await clearStaleArtifacts(dir, []);
    expect(await readdir(dir)).toEqual([]);
  });
});
