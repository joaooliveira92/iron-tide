import { readFileSync } from "node:fs";
import { describe, it, expect } from "vite-plus/test";
import {
  compileDesign,
  decodeDesignFile,
  encodeDesignFile,
  PersistenceError,
  DESIGN_SCHEMA_VERSION,
} from "../src/index.js";
import { ctx, draft } from "./fixtures/gunboat.js";

const compiled = compileDesign(draft, ctx);

describe("baseline name in the design file", () => {
  const withBaseline = (value: unknown) =>
    JSON.stringify({
      format: "bwdesign",
      schemaVersion: 2,
      draft,
      componentHashes: {},
      compiledHash: null,
      baselineName: value,
    });
  it("round-trips the baseline name beside the class name without touching the draft or its hash", () => {
    const file = encodeDesignFile(draft, ctx.catalogue, compiled, "Gunboat Mk II", "Gunboat");
    const d = decodeDesignFile(file, ctx.catalogue);
    expect(d.baselineName).toBe("Gunboat");
    expect(d.className).toBe("Gunboat Mk II");
    expect(d.draft).toEqual(draft);
    expect(d.compiledHash).toBe(compiled.hash);
    expect(
      encodeDesignFile(
        d.draft,
        ctx.catalogue,
        compiled,
        d.className ?? undefined,
        d.baselineName ?? undefined,
      ),
    ).toBe(file);
  });
  it("omits the field when there is no baseline, leaving the file byte-identical", () => {
    const named = encodeDesignFile(draft, ctx.catalogue, compiled, "Gunboat Mk II");
    expect(encodeDesignFile(draft, ctx.catalogue, compiled, "Gunboat Mk II", "")).toBe(named);
    expect(encodeDesignFile(draft, ctx.catalogue, compiled, "Gunboat Mk II", "   ")).toBe(named);
    expect(named).not.toContain("baselineName");
    expect(decodeDesignFile(named, ctx.catalogue).baselineName).toBeNull();
  });
  it("opens the v1 fixture and a v2 file written before the field existed with no baseline and no schema bump", () => {
    const fixture = readFileSync(
      new URL("./fixtures/v1-ironclad-turret-and-barbette.bwdesign.json", import.meta.url),
      "utf8",
    );
    expect(decodeDesignFile(fixture, ctx.catalogue).baselineName).toBeNull();
    const v2 = encodeDesignFile(draft, ctx.catalogue, compiled, "Gunboat Mk II");
    expect(decodeDesignFile(v2, ctx.catalogue).baselineName).toBeNull();
    expect(DESIGN_SCHEMA_VERSION).toBe(2);
  });
  it("trims the baseline name and refuses one that is not a string or is too long", () => {
    expect(decodeDesignFile(withBaseline("  Gunboat  "), ctx.catalogue).baselineName).toBe(
      "Gunboat",
    );
    expect(decodeDesignFile(withBaseline("   "), ctx.catalogue).baselineName).toBeNull();
    for (const bad of [1, null, true, {}, "x".repeat(61)])
      expect(() => decodeDesignFile(withBaseline(bad), ctx.catalogue)).toThrow(PersistenceError);
    expect(() =>
      encodeDesignFile(draft, ctx.catalogue, compiled, "Gunboat", "x".repeat(61)),
    ).toThrow(PersistenceError);
  });
});
