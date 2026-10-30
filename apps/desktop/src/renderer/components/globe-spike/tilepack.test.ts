import { describe, expect, it } from "vite-plus/test";

import { TilePack, TilePackError, crc32, encodeTilePack } from "./tilepack.js";

const TILES = [
  { z: 1, x: 1, y: 0, data: Uint8Array.from([5, 6, 7]) },
  { z: 0, x: 0, y: 0, data: Uint8Array.from([1, 2, 3, 4]) },
  { z: 3, x: 5, y: 2, data: new Uint8Array(0) },
];

describe("tile pack", () => {
  it("matches the standard CRC-32 check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("round-trips tiles in sorted order and finds them by address", () => {
    const pack = TilePack.parse(encodeTilePack(TILES));
    expect(pack.count).toBe(3);
    expect([...pack.entries()].map((entry) => `${entry.z}/${entry.x}/${entry.y}`)).toEqual([
      "0/0/0",
      "1/1/0",
      "3/5/2",
    ]);
    expect([...(pack.get(0, 0, 0) ?? [])]).toEqual([1, 2, 3, 4]);
    expect([...(pack.get(1, 1, 0) ?? [])]).toEqual([5, 6, 7]);
    expect(pack.get(3, 5, 2)?.length).toBe(0);
    expect(pack.get(2, 0, 0)).toBeNull();
  });

  it("encodes identically regardless of input order", () => {
    expect(encodeTilePack(TILES)).toEqual(encodeTilePack([...TILES].reverse()));
  });

  it("rejects duplicates, bad magic, truncation and corrupt tiles with a reason", () => {
    expect(() => encodeTilePack([TILES[0]!, TILES[0]!])).toThrow(TilePackError);
    const bytes = encodeTilePack(TILES);
    const reasonOf = (action: () => unknown): string => {
      try {
        action();
        return "none";
      } catch (error) {
        return error instanceof TilePackError ? error.reason : "other";
      }
    };
    const badMagic = bytes.slice();
    badMagic[0] = 0;
    expect(reasonOf(() => TilePack.parse(badMagic))).toBe("magic");
    expect(reasonOf(() => TilePack.parse(bytes.subarray(0, 8)))).toBe("truncated");
    expect(reasonOf(() => TilePack.parse(bytes.subarray(0, bytes.length - 2)))).toBe("truncated");
    const corrupt = bytes.slice();
    corrupt[corrupt.length - 1] = (corrupt[corrupt.length - 1] ?? 0) ^ 0xff;
    const pack = TilePack.parse(corrupt);
    expect(reasonOf(() => pack.get(1, 1, 0))).toBe("crc");
    expect(reasonOf(() => pack.get(0, 0, 0))).toBe("none");
  });
});
