import { describe, it, expect } from "vite-plus/test";
import { safePath, toPosixPath } from "../src/safePath.js";

// Canonical content paths are `/`-separated on every host (AGENTS.md
// determinism: no platform path separators). These run on any host: a Windows
// separator in the input must come out as `/`, so the guard is not vacuous on
// POSIX where `node:path` already uses `/`.
describe("canonical content paths are host-independent", () => {
  it("toPosixPath converts Windows separators to '/'", () => {
    expect(toPosixPath("ship-building\\parts\\alpha.yaml")).toBe("ship-building/parts/alpha.yaml");
  });

  it("safePath returns '/' separators regardless of the host separator", () => {
    expect(safePath("ship-building\\naval-profiles\\a.yaml")).toBe(
      "ship-building/naval-profiles/a.yaml",
    );
  });

  it("still rejects traversal across either separator", () => {
    expect(() => safePath("a\\..\\b")).toThrow();
    expect(() => safePath("a/../b")).toThrow();
  });
});
