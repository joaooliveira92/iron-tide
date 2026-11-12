import { describe, expect, it } from "vite-plus/test";
import {
  CLASSIFIED_SHIP_TYPES,
  classRuleFailures,
  type ClassFacts,
} from "../src/classificationRules.js";
import { classificationFindings } from "../src/classification.js";
import { AVAILABILITY_REASON_CODES, availabilityFindings } from "../src/shipTypeAvailability.js";
import {
  DESIGN_22_EARLY,
  SHIP_TYPES,
  compileDesign,
  compileDraftFromParts,
  evaluateAmcFleetLimit,
  evaluateShipTypeAvailability,
  UM_PER_INCH,
  type DesignDraft,
  type Finding,
} from "../src/index.js";
import { withoutSubjects } from "../src/findings.js";
import { UM_PER_KNOT } from "../src/units.js";
import { shipTypeRegistryFromRecords } from "../src/shipTypeRegistry.js";
import { nationalContext, shipTypes } from "./helpers/earlyContext.js";
import { draftCompileContent } from "./helpers/draftCompileContent.js";
import { designs, present } from "./helpers/gunReadPath.js";

const R = DESIGN_22_EARLY;
const facts = (o: Partial<ClassFacts>): ClassFacts => ({
  displacementKg: 1_000_000,
  speedUms: 25 * UM_PER_KNOT,
  beltUm: 0,
  anyQualifyingArmourUm: 0,
  maxMainGunUm: 0,
  maxGunUm: 0,
  mainTurretCount: 0,
  torpedoTubes: 1,
  aircraftCapacity: 0,
  deckUm: 0,
  maxHeavyMountBarrels: 0,
  merchantHull: false,
  ...o,
});
const failureOf = (type: (typeof CLASSIFIED_SHIP_TYPES)[number], f: ClassFacts, field: string) =>
  classRuleFailures[type](f, R).find((x) => x.field === field);

const worstFacts = facts({
  displacementKg: 1,
  speedUms: 1,
  beltUm: 20 * UM_PER_INCH,
  anyQualifyingArmourUm: 20 * UM_PER_INCH,
  maxMainGunUm: 1,
  maxGunUm: 20 * UM_PER_INCH,
  mainTurretCount: 9,
  torpedoTubes: 0,
  aircraftCapacity: 99,
  deckUm: 0,
  merchantHull: false,
});

describe("class rule failures carry stable diagnostics", () => {
  it("DD displacement: passes at 1,999,999 kg, fails at 2,000,000 kg with ruleId, messageKey, params", () => {
    expect(failureOf("DD", facts({ displacementKg: 1_999_999 }), "displacement")).toBeUndefined();
    expect(failureOf("DD", facts({ displacementKg: 2_000_000 }), "displacement")).toMatchObject({
      code: "DD_DISPLACEMENT_LIMIT_EXCEEDED",
      ruleId: "DESIGN-22.DD.displacement",
      messageKey: "design.classification.dd.displacement",
      params: { value: 2_000_000, limit: 2_000_000, unit: "kg" },
    });
  });

  it("DD speed: fails at 9,774,436 um/s, passes at 9,774,437 um/s", () => {
    expect(failureOf("DD", facts({ speedUms: 9_774_437 }), "speed")).toBeUndefined();
    expect(failureOf("DD", facts({ speedUms: 9_774_436 }), "speed")).toMatchObject({
      ruleId: "DESIGN-22.DD.speed",
      messageKey: "design.classification.dd.speed",
      params: { value: 9_774_436, limit: 9_774_436, unit: "um_s" },
    });
  });

  it("DD armour: passes just under 2 in, fails at 2 in", () => {
    const edge = 2 * UM_PER_INCH;
    expect(
      failureOf("DD", facts({ anyQualifyingArmourUm: edge - 1 }), "qualifyingArmour"),
    ).toBeUndefined();
    expect(
      failureOf("DD", facts({ anyQualifyingArmourUm: edge }), "qualifyingArmour"),
    ).toMatchObject({
      ruleId: "DESIGN-22.DD.qualifyingArmour",
      params: { value: edge, limit: edge, unit: "um" },
    });
  });

  it("CL caliber: passes at 6 in, fails at 6 in + 1 um", () => {
    const six = 6 * UM_PER_INCH;
    const cl = { displacementKg: 5_000_000, speedUms: 17 * UM_PER_KNOT };
    expect(failureOf("CL", facts({ ...cl, maxMainGunUm: six }), "mainGun")).toBeUndefined();
    expect(failureOf("CL", facts({ ...cl, maxMainGunUm: six + 1 }), "mainGun")).toMatchObject({
      code: "CL_MAIN_CALIBER_EXCEEDED",
      ruleId: "DESIGN-22.CL.mainGun",
      messageKey: "design.classification.cl.mainGun",
      params: { value: six + 1, limit: six, unit: "um" },
    });
  });

  it("CL displacement range reports both bounds", () => {
    expect(failureOf("CL", facts({ displacementKg: 8_000_000 }), "displacement")).toMatchObject({
      ruleId: "DESIGN-22.CL.displacement",
      params: { value: 8_000_000, min: 2_000_000, max: 8_000_000, unit: "kg" },
    });
  });

  it("CA belt: fails at 2 in and 12 in + 1 um, passes at 12 in", () => {
    const base = {
      displacementKg: 7_700_000,
      speedUms: 20 * UM_PER_KNOT,
      maxMainGunUm: 9 * UM_PER_INCH,
    };
    const lo = 2 * UM_PER_INCH;
    const hi = 12 * UM_PER_INCH;
    expect(failureOf("CA", facts({ ...base, beltUm: hi }), "belt")).toBeUndefined();
    expect(failureOf("CA", facts({ ...base, beltUm: lo }), "belt")).toMatchObject({
      code: "CA_BOUNDARY_FAILED",
      ruleId: "DESIGN-22.CA.belt",
      params: { value: lo, min: lo, max: hi, unit: "um" },
    });
    expect(failureOf("CA", facts({ ...base, beltUm: hi + 1 }), "belt")).toMatchObject({
      ruleId: "DESIGN-22.CA.belt",
      params: { value: hi + 1, min: lo, max: hi, unit: "um" },
    });
  });

  it("CA gives each of its four boundary failures a distinct ruleId", () => {
    const ids = classRuleFailures.CA(worstFacts, R).map((x) => x.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "DESIGN-22.CA.displacement",
        "DESIGN-22.CA.speed",
        "DESIGN-22.CA.belt",
        "DESIGN-22.CA.mainGun",
      ]),
    );
  });

  it("every rule of every type has a unique ruleId, a messageKey and primitive params", () => {
    for (const type of CLASSIFIED_SHIP_TYPES) {
      const failures = classRuleFailures[type](worstFacts, R);
      expect(failures.length, type).toBeGreaterThan(0);
      const ids = failures.map((x) => x.ruleId);
      expect(new Set(ids).size, type).toBe(ids.length);
      for (const x of failures) {
        expect(x.ruleId, x.code).toBe(`DESIGN-22.${type}.${x.field}`);
        expect(x.messageKey, x.code).toBe(`design.classification.${type.toLowerCase()}.${x.field}`);
        expect(Object.keys(x.params).length, x.code).toBeGreaterThan(0);
        for (const v of Object.values(x.params))
          expect(["number", "string", "boolean"]).toContain(typeof v);
      }
    }
  });

  it("classification findings repeat the rule diagnostics and report every failure at once", () => {
    const { findings } = classificationFindings(worstFacts, "B", R);
    const rules = classRuleFailures.B(worstFacts, R);
    expect(rules.length).toBeGreaterThan(2);
    const perRule = findings.filter((f) => f.id !== "INTENDED_CLASSIFICATION_ILLEGAL");
    expect(perRule.map((f) => f.ruleId)).toEqual(rules.map((x) => x.ruleId));
    expect(perRule.map((f) => f.messageKey)).toEqual(rules.map((x) => x.messageKey));
    expect(perRule.map((f) => f.params)).toEqual(rules.map((x) => x.params));
    expect(findings.every((f) => f.severity === "BLOCKING")).toBe(true);
    const summary = findings.find((f) => f.id === "INTENDED_CLASSIFICATION_ILLEGAL");
    expect(summary).toMatchObject({
      ruleId: "DESIGN-22.B.classification",
      messageKey: "design.classification.intended_illegal",
      params: { intended: "B", failures: rules.length },
    });
  });

  it("natural mismatch carries the intended and natural types", () => {
    const legalKe = facts({ displacementKg: 2_200_000, torpedoTubes: 0, maxGunUm: UM_PER_INCH });
    expect(classRuleFailures.KE(legalKe, R)).toEqual([]);
    const { findings, natural } = classificationFindings(legalKe, "KE", R, ["CL", "KE"]);
    expect(natural).toBe("CL");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      id: "NATURAL_CLASSIFICATION_MISMATCH",
      ruleId: "DESIGN-22.KE.precedence",
      messageKey: "design.classification.natural_mismatch",
      params: { intended: "KE", natural: "CL" },
    });
  });
});

describe("availability reasons name what is missing", () => {
  const month = "1895-06";
  const none = new Set<string>();

  it("names the technology and the era together, in one report", () => {
    const result = evaluateShipTypeAvailability("BB", { month, unlockedTechs: none });
    expect(result.available).toBe(false);
    const byCode = Object.fromEntries(result.reasons.map((r) => [r.code, r]));
    expect(byCode["SHIP_TYPE_ERA_NOT_REACHED"]).toMatchObject({
      ruleId: "AVAILABILITY.SHIP_TYPE_ERA_NOT_REACHED",
      messageKey: "design.availability.era_not_reached",
      params: {
        shipType: "BB",
        fromEra: SHIP_TYPES.BB.availability.fromEra,
        currentEra: "EARLY",
        month,
      },
    });
    expect(byCode["SHIP_TYPE_TECHNOLOGY_REQUIRED"]).toMatchObject({
      ruleId: "AVAILABILITY.SHIP_TYPE_TECHNOLOGY_REQUIRED",
      messageKey: "design.availability.technology_required",
      params: { shipType: "BB", techId: "sd_dreadnought_design" },
    });
  });

  it("is available once the technology is unlocked in the reached era", () => {
    const result = evaluateShipTypeAvailability("BB", {
      month: "1905-01",
      unlockedTechs: new Set(["sd_dreadnought_design"]),
    });
    expect(result).toMatchObject({ available: true, reasons: [] });
  });

  it("names the missing capability", () => {
    const registry = shipTypeRegistryFromRecords(
      shipTypes.map((record) =>
        record.id === "B"
          ? {
              ...record,
              availability: { ...record.availability, requiresCapability: "heavy_slipway" },
            }
          : record,
      ),
    );
    const result = evaluateShipTypeAvailability("B", {
      month,
      unlockedTechs: none,
      definitions: registry.byId,
    });
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toMatchObject({
      code: "SHIP_TYPE_CAPABILITY_REQUIRED",
      ruleId: "AVAILABILITY.SHIP_TYPE_CAPABILITY_REQUIRED",
      params: { shipType: "B", capabilityId: "heavy_slipway" },
    });
  });

  it("names an unregistered, restricted and not-yet-implemented type", () => {
    expect(
      evaluateShipTypeAvailability("ZZ", { month, unlockedTechs: none }).reasons[0],
    ).toMatchObject({
      code: "SHIP_TYPE_UNREGISTERED",
      params: { shipType: "ZZ" },
    });
    expect(
      evaluateShipTypeAvailability("CA", {
        month,
        unlockedTechs: none,
        restrictedTypes: ["CA"],
      }).reasons[0],
    ).toMatchObject({ code: "SHIP_TYPE_RESTRICTED", params: { shipType: "CA" } });
    expect(
      evaluateShipTypeAvailability("CV", { month, unlockedTechs: none }).reasons.map((r) => r.code),
    ).toContain("SHIP_TYPE_MECHANICS_NOT_IMPLEMENTED");
  });

  it("gives every reason code a ruleId and messageKey", () => {
    const seen = new Set<string>();
    const reasons = [
      ...evaluateShipTypeAvailability("BB", { month, unlockedTechs: none }).reasons,
      ...evaluateShipTypeAvailability("ZZ", { month, unlockedTechs: none }).reasons,
      ...evaluateShipTypeAvailability("CV", { month, unlockedTechs: none }).reasons,
      ...evaluateShipTypeAvailability("CA", {
        month,
        unlockedTechs: none,
        restrictedTypes: ["CA"],
      }).reasons,
      ...evaluateAmcFleetLimit(23 * UM_PER_KNOT, { cruisers: 5, amc: 2, fastAmc: 1 }, R).reasons,
    ];
    for (const r of reasons) {
      seen.add(r.code);
      expect(r.ruleId).toBe(`AVAILABILITY.${r.code}`);
      expect(r.messageKey).toMatch(/^design\.availability\.[a-z_]+$/);
    }
    for (const code of AVAILABILITY_REASON_CODES) {
      if (code !== "SHIP_TYPE_CAPABILITY_REQUIRED") expect(seen.has(code), code).toBe(true);
    }
  });

  it("AMC limits report the allowance and the current count", () => {
    const result = evaluateAmcFleetLimit(23 * UM_PER_KNOT, { cruisers: 5, amc: 2, fastAmc: 1 }, R);
    const fleet = result.reasons.find((r) => r.code === "AMC_FLEET_LIMIT_EXCEEDED");
    expect(fleet).toMatchObject({
      ruleId: "AVAILABILITY.AMC_FLEET_LIMIT_EXCEEDED",
      params: { shipType: "AMC", allowed: 2, current: 2 },
    });
    const fast = result.reasons.find((r) => r.code === "AMC_FAST_LIMIT_EXCEEDED");
    expect(fast).toMatchObject({ params: { shipType: "AMC", allowed: 1, current: 1 } });
  });

  it("availability findings repeat ruleId, messageKey and params", () => {
    const result = evaluateShipTypeAvailability("BB", { month, unlockedTechs: none });
    const findings = availabilityFindings(result);
    expect(findings.map((f) => f.ruleId)).toEqual(result.reasons.map((r) => r.ruleId));
    expect(findings.map((f) => f.messageKey)).toEqual(result.reasons.map((r) => r.messageKey));
    expect(findings.map((f) => f.params)).toEqual(result.reasons.map((r) => r.params));
    expect(findings.every((f) => f.severity === "BLOCKING")).toBe(true);
  });
});

describe("one compile reports every blocking diagnostic", () => {
  const base = present(
    designs.find((d) => d.id === "havock_like"),
    "havock_like",
  );
  const asType = (category: string): DesignDraft => ({
    ...base.draft,
    requirement: { ...base.draft.requirement, category: category as never },
  });
  const ctx = nationalContext(base.month, base.draft.nationId);

  it("an unavailable and illegal type reports availability and classification together", () => {
    const compiled = compileDesign(asType("BB"), ctx);
    const ids = compiled.findings.filter((f) => f.severity === "BLOCKING").map((f) => f.id);
    expect(ids).toContain("SHIP_TYPE_TECHNOLOGY_REQUIRED");
    expect(ids).toContain("SHIP_TYPE_ERA_NOT_REACHED");
    expect(ids).toContain("INTENDED_CLASSIFICATION_ILLEGAL");
    expect(ids).toContain("BB_DISPLACEMENT_TOO_LOW");
  });

  it("leaves the compiled hash of a legal and of an illegal design unchanged", () => {
    expect(compileDesign(asType("DD"), ctx).hash).toBe(
      "4012c44d04ad9cd1180a3a570b17671b01c27b4a52738e7ee23ea18f9a5c946b",
    );
    expect(compileDesign(asType("CL"), ctx).hash).toBe(
      "91bebc977ac0004a3c14304a533fa7b7d3e9d74fc5917c19317d654d55549b92",
    );
  });

  it("hashes findings without their diagnostic metadata", () => {
    const finding: Finding = {
      id: "X",
      severity: "BLOCKING",
      what: "w",
      why: "y",
      consequence: "c",
      remedies: [],
      evidence: { formulaId: "F", inputs: {}, threshold: 0, value: 0 },
      ruleId: "R",
      messageKey: "k",
      params: { a: 1 },
    };
    const stripped: Finding = withoutSubjects(finding);
    expect(stripped.ruleId).toBeUndefined();
    expect(stripped.messageKey).toBeUndefined();
    expect(stripped.params).toBeUndefined();
    expect(stripped.id).toBe("X");
  });

  it("gives the AI path and the player path identical diagnostics for the same design", () => {
    for (const category of ["BB", "CL", "CA", "KE", "DD"]) {
      const draft = asType(category);
      const ai = compileDesign(draft, ctx);
      const player = compileDraftFromParts({
        designId: base.id,
        draft,
        month: base.month,
        content: draftCompileContent,
        ctx,
        nation: { nationId: draft.nationId },
      });
      const playerFindings =
        player.status === "ACCEPTED" ? player.compiled.findings : player.findings;
      const diagnostics = (findings: readonly Finding[]) =>
        findings
          .filter((f) => f.ruleId !== undefined)
          .map((f) => ({
            severity: f.severity,
            ruleId: f.ruleId,
            messageKey: f.messageKey,
            params: f.params,
          }));
      const expected = diagnostics(ai.findings);
      expect(diagnostics(playerFindings), category).toEqual(expected);
      if (category !== "DD") expect(expected.length, category).toBeGreaterThan(0);
    }
  });
});
