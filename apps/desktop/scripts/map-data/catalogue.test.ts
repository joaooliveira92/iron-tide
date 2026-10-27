import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { decodeCatalogue, REQUIRED_FEATURE_IDS } from "./catalogue.ts";
import { CatalogueError } from "./errors.ts";

const RAW: unknown = JSON.parse(
  readFileSync(join(process.cwd(), "map-data", "protected-features.v1.json"), "utf8"),
);

function clone(): Record<string, unknown> {
  return structuredClone(RAW) as Record<string, unknown>;
}

function features(value: Record<string, unknown>): Record<string, unknown>[] {
  return value.features as Record<string, unknown>[];
}

function messageOf(value: unknown): string {
  try {
    decodeCatalogue(value);
    return "accepted";
  } catch (error) {
    return error instanceof CatalogueError ? error.message : `other: ${String(error)}`;
  }
}

describe("protected feature catalogue", () => {
  it("accepts the committed catalogue and covers every required feature", () => {
    const catalogue = decodeCatalogue(RAW);
    const ids = catalogue.features.map((feature) => feature.id);
    for (const id of REQUIRED_FEATURE_IDS) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every feature provenance, licence status and a gameplay reason", () => {
    for (const feature of decodeCatalogue(RAW).features) {
      expect(feature.provenance.source.length).toBeGreaterThan(9);
      expect(["public-domain", "bluewave-authored"]).toContain(feature.license.status);
      expect(feature.gameplayReason.length).toBeGreaterThan(19);
      expect(feature.edgeSemantics).toBe("lonlat-linear");
    }
  });

  it("rejects duplicate identifiers", () => {
    const value = clone();
    features(value).push(structuredClone(features(value)[0] as Record<string, unknown>));
    expect(messageOf(value)).toContain("duplicate feature id 'suez-canal'");
  });

  it("rejects unsupported edge semantics", () => {
    const value = clone();
    (features(value)[0] as Record<string, unknown>).edgeSemantics = "great-circle";
    expect(messageOf(value)).toContain("unsupported edge semantics 'great-circle'");
  });

  it("rejects excess properties", () => {
    const value = clone();
    (features(value)[0] as Record<string, unknown>).extra = 1;
    expect(messageOf(value)).not.toBe("accepted");
  });

  it("rejects a missing required feature", () => {
    const value = clone();
    value.features = features(value).filter((feature) => feature.id !== "kiel-canal");
    expect(messageOf(value)).toContain("missing required features: kiel-canal");
  });

  it("rejects authored geometry that claims a dataset provenance", () => {
    const value = clone();
    const corinth = features(value).find((feature) => feature.id === "corinth-canal") as Record<
      string,
      unknown
    >;
    (corinth.provenance as Record<string, unknown>).method = "derived-from-dataset";
    expect(messageOf(value)).toContain("authored geometry must declare provenance.method");
  });

  it("rejects coordinates outside the projection domain", () => {
    const value = clone();
    const corinth = features(value).find((feature) => feature.id === "corinth-canal") as Record<
      string,
      unknown
    >;
    (corinth.geometry as { lines: number[][][] }).lines[0] = [
      [22.9, 90],
      [23, 37.9],
    ];
    expect(messageOf(value)).toContain("outside longitude/latitude bounds");
  });
});
