import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { resolveParticipation, validateParticipationRecord } from "../src/continuity.js";

function collector() {
  return new DiagnosticCollector();
}
function hasCode(c: DiagnosticCollector, code: string) {
  return c.errors.some((d) => d.code === code);
}
const baseRec: any = {
  scenarioId: "scen_1880",
  playableSlotId: "gbr",
  continuityModeId: "historical",
  participationStatus: "ACTIVE",
  scenarioNationInstanceId: "inst_gbr",
  continuationDefinitionId: "NONE",
  reasonCode: "r",
  contentHash: "h",
};
describe("continuity: validateParticipationRecord strict", () => {
  it("fails bad continuityModeId", () => {
    const c = collector();
    expect(validateParticipationRecord({ ...baseRec, continuityModeId: "bad" }, c)).toBe(false);
    expect(hasCode(c, "INVALID_SCENARIO_PARTICIPATION_RECORD")).toBe(true);
  });
  it("fails ACTIVE with NONE instance", () => {
    const c = collector();
    expect(validateParticipationRecord({ ...baseRec, scenarioNationInstanceId: "NONE" }, c)).toBe(
      false,
    );
    expect(hasCode(c, "INVALID_SCENARIO_PARTICIPATION_RECORD")).toBe(true);
  });
  it("fails CONDITIONAL_ACTIVE with NONE continuation", () => {
    const c = collector();
    expect(
      validateParticipationRecord(
        { ...baseRec, participationStatus: "CONDITIONAL_ACTIVE", continuationDefinitionId: "NONE" },
        c,
      ),
    ).toBe(false);
    expect(hasCode(c, "MISSING_ALTERNATE_CONTINUITY_DEFINITION")).toBe(true);
  });
  it("fails empty contentHash", () => {
    const c = collector();
    expect(validateParticipationRecord({ ...baseRec, contentHash: "" }, c)).toBe(false);
    expect(hasCode(c, "INVALID_SCENARIO_PARTICIPATION_RECORD")).toBe(true);
  });
});
describe("continuity: resolveParticipation NONE semantics", () => {
  it("ACTIVE with non-NONE continuation fails", () => {
    const c = collector();
    const rec: any = { ...baseRec, continuationDefinitionId: "cont_gbr" };
    const idents = new Map();
    expect(
      resolveParticipation("scen_1880", "gbr", "historical", [rec], idents, new Map(), c),
    ).toBeUndefined();
    expect(hasCode(c, "INVALID_SCENARIO_PARTICIPATION_RECORD")).toBe(true);
  });
});
