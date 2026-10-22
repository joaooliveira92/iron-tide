import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { defineSidecar, prependBounded } from "./sidecar.js";

const Item = Schema.Struct({ n: Schema.Number });
const sidecar = defineSidecar<{ readonly n: number }, number, number>({
  filename: "item.json",
  schema: Item,
  decodeOptions: { onExcessProperty: "error" },
  space: 2,
  empty: (fallback) => fallback,
  resolve: (stored, offset) => stored.n + offset,
});

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sidecar-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("defineSidecar", () => {
  it("reads the empty value when the file is missing", () => {
    expect(sidecar.read(dir, -1)).toBe(-1);
  });

  it.each([
    ["unparseable JSON", "{not json"],
    ["a mis-shaped value", '{"n":"x"}'],
    ["excess keys when decoding strictly", '{"n":1,"extra":true}'],
  ])("falls back to empty on %s", (_label, contents) => {
    writeFileSync(sidecar.pathIn(dir), contents, "utf8");
    expect(sidecar.read(dir, -1)).toBe(-1);
  });

  it("falls back to empty when resolve throws", () => {
    const throwing = defineSidecar<{ readonly n: number }, number>({
      filename: "item.json",
      schema: Item,
      empty: () => -1,
      resolve: () => {
        throw new Error("rejected");
      },
    });
    writeFileSync(throwing.pathIn(dir), '{"n":1}', "utf8");
    expect(throwing.read(dir, undefined)).toBe(-1);
  });

  it("round-trips a write through resolve, leaving no tmp file", () => {
    sidecar.write(dir, { n: 4 });
    expect(sidecar.read(dir, 10)).toBe(14);
    expect(existsSync(`${sidecar.pathIn(dir)}.tmp`)).toBe(false);
  });

  it("throws AbortError before touching the filesystem when aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => sidecar.write(dir, { n: 1 }, controller.signal)).toThrowError(
      expect.objectContaining({ name: "AbortError" }),
    );
    expect(existsSync(sidecar.pathIn(dir))).toBe(false);
    expect(existsSync(`${sidecar.pathIn(dir)}.tmp`)).toBe(false);
  });

  it("removes the tmp file and rethrows when the write fails", () => {
    expect(() => sidecar.write(join(dir, "missing"), { n: 1 })).toThrow();
    expect(existsSync(join(dir, "missing", "item.json.tmp"))).toBe(false);
  });
});

describe("prependBounded", () => {
  it("prepends the newest and prunes to the limit", () => {
    expect(prependBounded([2, 1], 3, 2)).toEqual([3, 2]);
  });

  it("replaces an entry the matcher treats as the same", () => {
    expect(prependBounded([{ id: 1 }, { id: 2 }], { id: 2 }, 5, (a, b) => a.id === b.id)).toEqual([
      { id: 2 },
      { id: 1 },
    ]);
  });
});
