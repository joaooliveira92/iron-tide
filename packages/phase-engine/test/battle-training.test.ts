import type { NationState } from "@bluewave/campaign";
import { FIXTURE_FLEET_MANAGEMENT_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { gunneryTrainingBpFor } from "../src/battleTraining.js";

const nation = (specialTraining: NationState["specialTraining"]): NationState =>
  ({ id: "n", specialTraining }) as NationState;

const entry = (subject: "GUNNERY" | "NIGHT_FIGHTING", fundedMonths: number) => ({
  subject,
  fundedMonths,
  maintenanceAdderBp: 3_000,
});

describe("gunnery training bonus for battle", () => {
  it("is the ruleset's gunnery effect once twelve funded months are reached", () => {
    expect(
      gunneryTrainingBpFor(nation([entry("GUNNERY", 12)]), FIXTURE_FLEET_MANAGEMENT_RULES),
    ).toBe(1_000);
  });

  it("is zero while the subject is still being trained", () => {
    expect(
      gunneryTrainingBpFor(nation([entry("GUNNERY", 11)]), FIXTURE_FLEET_MANAGEMENT_RULES),
    ).toBe(0);
  });

  it("ignores other proficient subjects", () => {
    expect(
      gunneryTrainingBpFor(nation([entry("NIGHT_FIGHTING", 12)]), FIXTURE_FLEET_MANAGEMENT_RULES),
    ).toBe(0);
  });

  it("is zero with no program or with the layer dormant", () => {
    expect(gunneryTrainingBpFor(nation(undefined), FIXTURE_FLEET_MANAGEMENT_RULES)).toBe(0);
    expect(gunneryTrainingBpFor(nation([entry("GUNNERY", 12)]), undefined)).toBe(0);
  });
});
