import { describe, expect, it } from "vite-plus/test";

import { uniqueLicenceFiles } from "./pipeline.ts";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("uniqueLicenceFiles", () => {
  it("keeps one file per distinct content, preferring the first name in sorted order", () => {
    const layers = [
      {
        licenceFiles: new Map([
          ["ne_10m_land.VERSION.txt", bytes("5.1.1")],
          ["ne_10m_bathymetry_K_200.VERSION.txt", bytes("4.1.0")],
          ["ne_10m_bathymetry_K_200.README.html", bytes("shared readme")],
        ]),
      },
      {
        licenceFiles: new Map([
          ["ne_10m_bathymetry_G_4000.VERSION.txt", bytes("4.1.0")],
          ["ne_10m_bathymetry_G_4000.README.html", bytes("shared readme")],
          ["ne_10m_reefs.VERSION.txt", bytes("4.1.0")],
        ]),
      },
    ];
    expect([...uniqueLicenceFiles(layers).keys()]).toEqual([
      "ne_10m_bathymetry_G_4000.README.html",
      "ne_10m_bathymetry_G_4000.VERSION.txt",
      "ne_10m_land.VERSION.txt",
    ]);
  });

  it("returns no two byte-identical files for the same layers regardless of input order", () => {
    const a = { licenceFiles: new Map([["b.txt", bytes("x")]]) };
    const b = { licenceFiles: new Map([["a.txt", bytes("x")]]) };
    expect([...uniqueLicenceFiles([a, b]).keys()]).toEqual(["a.txt"]);
    expect([...uniqueLicenceFiles([b, a]).keys()]).toEqual(["a.txt"]);
  });
});
