import { describe, expect, it } from "vite-plus/test";

import {
  createBakedTileLoader,
  createDiagnostics,
  loadBakedTiles,
  parseBakedManifest,
  type FetchLike,
} from "./baked-tiles.js";
import { BakedTilesError } from "./globe-spike-errors.js";
import { TilePack, encodeTilePack } from "./tilepack.js";

const TILES = [
  { z: 0, x: 0, y: 0, data: Uint8Array.from([1, 2, 3, 4]) },
  { z: 1, x: 1, y: 0, data: Uint8Array.from([9, 8, 7]) },
];
const PACK = encodeTilePack(TILES);

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    manifestVersion: 2,
    pipelineVersion: "1.1.0",
    areaOutlines: {
      datasetVersion: "1.0.0",
      edgeSemantics: "lonlat-linear",
      sourceSha256: "def",
      geometryCount: { areas: 36 },
    },
    zoom: { tileMin: 0, tileMax: 7, fitForPurposeMax: 7, overscaleMax: 12 },
    bounds: [-180, -85, 180, 85],
    tileExtent: 4096,
    layers: { land: "land", protected: "protected", areas: "areas", areaOutlines: "area_outlines" },
    integrity: { packSha256: "abc" },
    sizes: { packBytes: PACK.length },
    attribution: "Made with Natural Earth.",
    ...overrides,
  };
}

function fakeFetch(files: Record<string, Uint8Array | string>): FetchLike {
  return async (url) => {
    const name = url.slice(url.lastIndexOf("/") + 1);
    const body = files[name];
    if (body === undefined)
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    return { ok: true, status: 200, arrayBuffer: async () => bytes.slice().buffer };
  };
}

const digest = async () => "abc";
const clock = () => 0;

async function reasonOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return "none";
  } catch (error) {
    return error instanceof BakedTilesError ? error.message : `other: ${String(error)}`;
  }
}

describe("baked tile loading", () => {
  it("parses a valid manifest and rejects missing or malformed fields", () => {
    expect(parseBakedManifest(manifest()).zoom.tileMax).toBe(7);
    expect(() => parseBakedManifest(manifest({ bounds: [1, 2] }))).toThrow(BakedTilesError);
    expect(() =>
      parseBakedManifest(
        manifest({ zoom: { tileMin: 3, tileMax: 1, fitForPurposeMax: 1, overscaleMax: 2 } }),
      ),
    ).toThrow(/inverted/);
    expect(() => parseBakedManifest({})).toThrow(BakedTilesError);
  });

  it("rejects a pack without the area outline layers or with an older manifest schema", () => {
    expect(() =>
      parseBakedManifest(manifest({ layers: { land: "land", protected: "protected" } })),
    ).toThrow(/areas/);
    expect(() => parseBakedManifest(manifest({ manifestVersion: 1 }))).toThrow(
      /manifest version 1 is not supported/,
    );
    const { manifestVersion: _omitted, ...unversioned } = manifest();
    expect(() => parseBakedManifest(unversioned)).toThrow(BakedTilesError);
  });

  it("requires explicit lonlat-linear edge semantics for the area outlines", () => {
    const areaOutlines = {
      datasetVersion: "1.0.0",
      sourceSha256: "def",
      geometryCount: { areas: 36 },
    };
    expect(() => parseBakedManifest(manifest({ areaOutlines }))).toThrow(/lonlat-linear/);
    for (const edgeSemantics of ["mercator-linear", "great-circle", ""]) {
      expect(() =>
        parseBakedManifest(manifest({ areaOutlines: { ...areaOutlines, edgeSemantics } })),
      ).toThrow(/lonlat-linear/);
    }
    expect(
      parseBakedManifest(
        manifest({ areaOutlines: { ...areaOutlines, edgeSemantics: "lonlat-linear" } }),
      ).areaOutlines.geometryCount,
    ).toBe(36);
  });

  it("loads the pack and serves tiles, empty ocean tiles and integrity failures distinctly", async () => {
    const files = { "manifest.json": JSON.stringify(manifest()), "land.bwtp": PACK };
    const loaded = await loadBakedTiles("app://x/", fakeFetch(files), digest, clock);
    expect(loaded.diagnostics.packVerified).toBe(true);
    const load = createBakedTileLoader(loaded.pack, loaded.diagnostics);
    expect([...new Uint8Array((await load({ url: "bwtiles://land/0/0/0" })).data)]).toEqual([
      1, 2, 3, 4,
    ]);
    expect((await load({ url: "bwtiles://land/5/3/3" })).data.byteLength).toBe(0);
    expect(loaded.diagnostics).toMatchObject({ requests: 2, served: 1, empty: 1 });
    expect(await reasonOf(() => load({ url: "bwtiles://land/not-a-tile" }))).toContain(
      "unrecognised tile url",
    );
  });

  it("fails with an actionable message when the pack is missing", async () => {
    const message = await reasonOf(() =>
      loadBakedTiles(
        "app://x/",
        fakeFetch({ "manifest.json": JSON.stringify(manifest()) }),
        digest,
        clock,
      ),
    );
    expect(message).toContain("cannot read app://x/land.bwtp: HTTP 404");
  });

  it("fails when the manifest is missing or not JSON", async () => {
    expect(
      await reasonOf(() => loadBakedTiles("app://x/", fakeFetch({}), digest, clock)),
    ).toContain("manifest.json: HTTP 404");
    expect(
      await reasonOf(() =>
        loadBakedTiles("app://x/", fakeFetch({ "manifest.json": "{nope" }), digest, clock),
      ),
    ).toContain("not valid JSON");
  });

  it("rejects a pack whose size or hash does not match the manifest", async () => {
    const wrongSize = fakeFetch({
      "manifest.json": JSON.stringify(manifest({ sizes: { packBytes: 5 } })),
      "land.bwtp": PACK,
    });
    expect(await reasonOf(() => loadBakedTiles("app://x/", wrongSize, digest, clock))).toContain(
      "manifest records 5",
    );
    const files = fakeFetch({ "manifest.json": JSON.stringify(manifest()), "land.bwtp": PACK });
    expect(
      await reasonOf(() => loadBakedTiles("app://x/", files, async () => "other", clock)),
    ).toContain("hash does not match");
  });

  it("reports a corrupt tile with its address and keeps serving the others", async () => {
    const corrupt = PACK.slice();
    corrupt[corrupt.length - 1] = (corrupt[corrupt.length - 1] ?? 0) ^ 0xff;
    const diagnostics = createDiagnostics();
    const load = createBakedTileLoader(TilePack.parse(corrupt), diagnostics);
    expect(await reasonOf(() => load({ url: "bwtiles://land/1/1/0" }))).toContain(
      "tile 1/1/0 failed integrity check (crc)",
    );
    expect((await load({ url: "bwtiles://land/0/0/0" })).data.byteLength).toBe(4);
    expect(diagnostics.failures).toEqual(["1/1/0 crc"]);
  });
});
