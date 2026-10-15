import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

describe("parseOptions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("defaults without extended", async () => {
    const { parseOptions } = await import("../src/options.js");
    expect(parseOptions([], false)).toEqual({
      manifest: "pack.json",
      contentDir: "content",
      outputDir: "out",
      outputMode: "human",
    });
  });

  it("parses all flags extended", async () => {
    const { parseOptions } = await import("../src/options.js");
    const opts: any = parseOptions(
      [
        "--manifest",
        "m.json",
        "--content-dir",
        "c",
        "--output-dir",
        "o",
        "--save-dir",
        "s",
        "--seed",
        "abc",
        "--json",
      ],
      true,
    );
    expect(opts).toMatchObject({
      manifest: "m.json",
      contentDir: "c",
      outputDir: "o",
      saveDir: "s",
      seed: "abc",
      outputMode: "json",
    });
  });

  it("extended false omits campaign fields", async () => {
    const { parseOptions } = await import("../src/options.js");
    const opts: any = parseOptions(["--save-dir", "s", "--seed", "x"], false);
    expect(opts.saveDir).toBeUndefined();
  });

  it("ignores unknown flag", async () => {
    const { parseOptions } = await import("../src/options.js");
    expect(parseOptions(["--unknown", "foo"], false).manifest).toBe("pack.json");
  });

  it("exitCodes map correctly", async () => {
    const { exitCodes } = await import("../src/options.js");
    expect(exitCodes).toEqual({
      success: 0,
      "validation-error": 1,
      "compile-error": 2,
      aborted: 3,
      "internal-error": 4,
      "usage-error": 5,
    });
  });
});
