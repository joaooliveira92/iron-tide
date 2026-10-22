import { describe, expect, it } from "vite-plus/test";
import { REFERENCE_PROVENANCE_FIELDS, REFERENCE_VALUE_STATUSES } from "@bluewave/content-schema";

import type { RawReferenceDesign } from "../src/index.js";
import { readReferenceDesignEntries } from "./helpers/earlyContext.js";
import { REFERENCE_DESIGN_CLASSIFICATIONS } from "./helpers/referenceClassifications.js";

const HISTORICAL_IDS = [
  "devastator_1873",
  "dreadnought_1875",
  "iris_1879",
  "tb2_1879",
  "alexandra_1877",
  "redoutable_1878",
  "kaiser_1875",
  "sachsen_1878",
  "canonicus_1879",
  "fuso_1878",
  "principe_amedeo_1874",
  "petr_velikiy_1876",
  "kaiser_max_1876",
  "numancia_1864",
  "mesudiye_1875",
  "matador_1879",
  "vasco_da_gama_1876",
  "sete_de_setembro_1874",
] as const;

const EXPLICITLY_NON_HISTORICAL = ["havock_like", "majestic_like", "torpedo_cruiser_1880"] as const;

const designs = readReferenceDesignEntries();

const byId = (id: string): RawReferenceDesign => {
  const design = designs.find((d) => d.id === id);
  if (design === undefined) throw new Error(`reference design '${id}' not found`);
  return design;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface DesignLike {
  readonly id: string;
  readonly historical?: unknown;
  readonly provenance?: unknown;
}

const provenanceIssues = (design: DesignLike): string[] => {
  const historical = design.historical === true;
  const provenance = design.provenance;
  if (historical && provenance === undefined)
    return [`${design.id}: historical design has no provenance`];
  if (!historical && provenance !== undefined)
    return [`${design.id}: non-historical design carries provenance`];
  if (provenance === undefined) return [];
  if (!isRecord(provenance)) return [`${design.id}: provenance is not a mapping`];
  const issues: string[] = [];
  for (const field of REFERENCE_PROVENANCE_FIELDS) {
    const value = provenance[field];
    if (!isRecord(value)) {
      issues.push(`${design.id}.${field}: missing`);
      continue;
    }
    if (typeof value["value"] !== "string" || value["value"].trim() === "")
      issues.push(`${design.id}.${field}: empty value`);
    const status = value["status"];
    if (
      typeof status !== "string" ||
      !(REFERENCE_VALUE_STATUSES as readonly string[]).includes(status)
    )
      issues.push(`${design.id}.${field}: unknown status '${String(status)}'`);
    const sources = value["sources"];
    if (!Array.isArray(sources) || sources.length === 0) {
      issues.push(`${design.id}.${field}: no source`);
      continue;
    }
    for (const source of sources)
      if (!isRecord(source) || typeof source["title"] !== "string" || source["title"].trim() === "")
        issues.push(`${design.id}.${field}: empty source title`);
  }
  return issues;
};

describe("reference-design provenance over the authored content (ticket 39)", () => {
  it("reads every authored reference design", () => {
    expect(designs.length).toBeGreaterThanOrEqual(HISTORICAL_IDS.length);
    expect(designs.map((d) => d.id)).toContain("torpedo_cruiser_1880");
  });

  it("marks exactly the canonical historical set as historical", () => {
    const marked = designs
      .filter((d) => d.historical === true)
      .map((d) => d.id)
      .sort();
    expect(marked).toEqual([...HISTORICAL_IDS].sort());
  });

  it.each(HISTORICAL_IDS)("%s is a historical design with full, well-formed provenance", (id) => {
    expect(provenanceIssues(byId(id))).toEqual([]);
  });

  it("agrees with the historical reconstruction classification", () => {
    for (const [id, classification] of Object.entries(REFERENCE_DESIGN_CLASSIFICATIONS)) {
      if (classification !== "HISTORICAL_RECONSTRUCTION") continue;
      expect(byId(id).historical, `${id} must be historical`).toBe(true);
      expect(provenanceIssues(byId(id))).toEqual([]);
    }
  });

  it("leaves every other design non-historical and carries no provenance on it", () => {
    const historical = new Set<string>(HISTORICAL_IDS);
    for (const design of designs) {
      if (historical.has(design.id)) continue;
      expect(design.historical, `${design.id} must not be historical`).not.toBe(true);
      expect(design.provenance, `${design.id} must carry no provenance`).toBeUndefined();
    }
  });

  it.each(EXPLICITLY_NON_HISTORICAL)("%s is explicitly marked non-historical", (id) => {
    expect(byId(id).historical).toBe(false);
  });

  it("every provenance value cites at least one real source with no blank title", () => {
    for (const design of designs) {
      if (design.provenance === undefined) continue;
      for (const value of Object.values(design.provenance))
        expect(value.sources.length).toBeGreaterThan(0);
    }
  });

  it("REGRESSION: a historical design missing provenance fails the rule", () => {
    const { provenance: _drop, ...withoutProvenance } = byId("devastator_1873");
    expect(provenanceIssues(withoutProvenance)).toEqual([
      "devastator_1873: historical design has no provenance",
    ]);
  });

  it("REGRESSION: an unknown provenance status fails the rule", () => {
    const design = byId("devastator_1873");
    const broken = {
      ...design,
      provenance: {
        ...design.provenance,
        speed: { ...design.provenance!.speed, status: "SINGLE-SOURCE" },
      },
    };
    expect(provenanceIssues(broken)).toContain(
      "devastator_1873.speed: unknown status 'SINGLE-SOURCE'",
    );
  });
});
