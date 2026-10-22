import { describe, expect, it } from "vite-plus/test";
import {
  applyEdit,
  buildShipBuildingContent,
  compileDesign,
  decodeDesignFile,
  EditError,
  encodeDesignFile,
  headerFromDraft,
  validateDraftShape,
  type DesignDraft,
} from "../src/index.js";
import {
  earlyContext,
  readReferenceDesignEntries,
  shipBuildingData,
} from "./helpers/earlyContext.js";

const refs = readReferenceDesignEntries();
const base = refs.find((r) => r.id === "starter_corvette_1880")!.draft as DesignDraft;
const dormant = earlyContext("1880-01");
const FIXTURE_BP = 137;
const configured = { ...dormant, colonialFitting: { displacementBp: FIXTURE_BP } };
const fitted: DesignDraft = { ...base, colonialServiceFitted: true };

describe("colonial-service fitting", () => {
  it("leaves an unfitted draft untouched: an explicit false hashes like an absent flag", () => {
    const plain = compileDesign(base, dormant);
    const explicit = compileDesign({ ...base, colonialServiceFitted: false }, configured);
    expect(plain.colonialService).toBeUndefined();
    expect(explicit.colonialService).toBeUndefined();
    expect(explicit.hash).toBe(plain.hash);
  });

  it("records the fitting without any displacement change while the ruleset section is dormant", () => {
    const plain = compileDesign(base, dormant);
    const result = compileDesign(fitted, dormant);
    expect(result.colonialService).toEqual({
      fitted: true,
      configured: false,
      proportionBp: null,
      displacementKg: 0,
    });
    expect(result.ledger).toEqual(plain.ledger);
    expect(result.totalKg).toBe(plain.totalKg);
    expect(result.valid).toBe(plain.valid);
    const flag = result.findings.find((f) => f.id === "COLONIAL_SERVICE_NOT_CONFIGURED");
    expect(flag?.severity).toBe("ADVISORY");
    expect(result.hash).not.toBe(plain.hash);
  });

  it("takes the fixture proportion of target displacement, rounded up, into the auxiliary line", () => {
    const plain = compileDesign(base, dormant);
    const result = compileDesign(fitted, configured);
    const expectedKg = Math.ceil((base.hull.targetDisplacementKg * FIXTURE_BP) / 10_000);
    expect(expectedKg).toBeGreaterThan(0);
    expect(result.colonialService).toEqual({
      fitted: true,
      configured: true,
      proportionBp: FIXTURE_BP,
      displacementKg: expectedKg,
    });
    expect(result.ledger.auxiliary - plain.ledger.auxiliary).toBe(expectedKg);
    expect(result.totalKg).toBeGreaterThanOrEqual(plain.totalKg + expectedKg);
    expect(result.findings.some((f) => f.id === "COLONIAL_SERVICE_NOT_CONFIGURED")).toBe(false);
  });

  it("is independent of the corvette eligibility advisory", () => {
    const small: DesignDraft = {
      ...fitted,
      requirement: { ...fitted.requirement, accommodationStandard: "SPARTAN" },
    };
    const ids = compileDesign(small, configured).findings.map((f) => f.id);
    expect(ids).toContain("KE_COLONIAL_SERVICE_UNAVAILABLE");
  });

  it("is set and cleared by an edit; clearing returns the draft to its unfitted shape", () => {
    const on = applyEdit(base, { kind: "set_colonial_service", fitted: true });
    expect(on.colonialServiceFitted).toBe(true);
    const off = applyEdit(on, { kind: "set_colonial_service", fitted: false });
    expect(off).toEqual(base);
    expect("colonialServiceFitted" in off).toBe(false);
    expect(() =>
      // @ts-expect-error a wire edit can carry a non-boolean; the edit must refuse it
      applyEdit(base, { kind: "set_colonial_service", fitted: "yes" }),
    ).toThrow(EditError);
  });

  it("round-trips through the design file and the parts header; a non-boolean flag is rejected", () => {
    const text = encodeDesignFile(fitted, dormant.catalogue, compileDesign(fitted, dormant));
    expect(decodeDesignFile(text, dormant.catalogue).draft).toEqual(fitted);
    expect(headerFromDraft(fitted).colonialServiceFitted).toBe(true);
    expect("colonialServiceFitted" in headerFromDraft(base)).toBe(false);
    expect(validateDraftShape({ ...fitted, colonialServiceFitted: "yes" })).toContain(
      "colonialServiceFitted must be a boolean",
    );
    expect(validateDraftShape(fitted)).toEqual([]);
  });

  it("reaches the compile context only when the ruleset section supplies it (dormant otherwise)", () => {
    const withSection = buildShipBuildingContent({
      ...shipBuildingData,
      presence: {
        colonialServiceDisplacementBp: FIXTURE_BP,
        requiredTonsPerPossessionWeight: 100,
        noPortValueWeight: 1,
        crampedOrShortRangeCountBp: 5_000,
      },
    });
    expect(withSection.environmentFor("1880-01").ctx.colonialFitting).toEqual({
      displacementBp: FIXTURE_BP,
    });
    expect("colonialFitting" in dormant).toBe(false);
  });
});
