import { describe, expect, it } from "vite-plus/test";
import { REFERENCE_PROVENANCE_FIELDS, REFERENCE_VALUE_STATUSES } from "@bluewave/content-schema";

import type { RawReferenceDesign } from "../src/index.js";
import { readReferenceDesignEntries } from "./helpers/earlyContext.js";
import { REFERENCE_DESIGN_CLASSIFICATIONS } from "./helpers/referenceClassifications.js";

/**
 * Machine-readable provenance on reference designs (ticket 39). The exact rule,
 * enforced over every authored design:
 *
 *   1. A design with `historical: true` reconstructs a documented real ship and
 *      MUST carry all six provenance facts (`REFERENCE_PROVENANCE_FIELDS`), each
 *      with a non-empty value, a status in {VERIFIED, DERIVED, ESTIMATE}, and at
 *      least one real source.
 *   2. A design with `historical !== true` (absent or false) is non-historical
 *      and MUST NOT carry provenance.
 *   3. The designs the classification (`REFERENCE_DESIGN_CLASSIFICATIONS`) marks
 *      HISTORICAL_RECONSTRUCTION, plus the pre-1880 in-service ships in the
 *      `historical.yaml` files, are exactly the design set that must be
 *      `historical: true` — checked against the canonical list below so a new
 *      historical design cannot be added without provenance.
 *
 * The structural half (unknown status, missing fact, empty source) is pinned in
 * `@bluewave/content-schema`'s `reference-design-provenance.test.ts`.
 */

/** The 18 historical reconstructions: the five pre-1880 in-service ships plus the 13 promoted national starters. */
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

/** Non-historical illustrative designs that must carry an explicit `historical: false` marker. */
const EXPLICITLY_NON_HISTORICAL = ["havock_like", "majestic_like", "torpedo_cruiser_1880"] as const;

const designs = readReferenceDesignEntries();

const byId = (id: string): RawReferenceDesign => {
  const design = designs.find((d) => d.id === id);
  if (design === undefined) throw new Error(`reference design '${id}' not found`);
  return design;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The structural facts a design presents to the rule (loose so a test can feed it a broken shape). */
interface DesignLike {
  readonly id: string;
  readonly historical?: unknown;
  readonly provenance?: unknown;
}

/** Every way a design can violate the rule above; empty for a conforming design. */
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

  // Negative controls: the rule the test above enforces actually rejects the two failure modes.
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
