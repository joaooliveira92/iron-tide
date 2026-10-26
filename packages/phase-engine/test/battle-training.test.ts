import type { NationState } from "@bluewave/campaign";
import { FIXTURE_FLEET_MANAGEMENT_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { trainingEffectsFor } from "../src/battleTraining.js";

type Subject = "GUNNERY" | "NIGHT_FIGHTING" | "TORPEDO_TACTICS" | "DAMAGE_CONTROL";

const nation = (specialTraining: NationState["specialTraining"]): NationState =>
  ({ id: "n", specialTraining }) as NationState;

const entry = (subject: Subject, fundedMonths: number) => ({
  subject,
  fundedMonths,
  maintenanceAdderBp: 3_000,
});

const NONE = { gunneryBp: 0, nightFightingBp: 0, torpedoTacticsBp: 0, damageControlBp: 0 };
const rules = FIXTURE_FLEET_MANAGEMENT_RULES;

describe("training effects for battle", () => {
  it("maps each proficient subject to its battle effect from the ruleset", () => {
    expect(trainingEffectsFor(nation([entry("GUNNERY", 12)]), rules)).toEqual({
      ...NONE,
      gunneryBp: rules.training.subjects.GUNNERY.effectBp,
    });
    expect(
      trainingEffectsFor(nation([entry("NIGHT_FIGHTING", 12), entry("DAMAGE_CONTROL", 12)]), rules),
    ).toEqual({
      ...NONE,
      nightFightingBp: rules.training.subjects.NIGHT_FIGHTING.effectBp,
      damageControlBp: rules.training.subjects.DAMAGE_CONTROL.effectBp,
    });
    expect(trainingEffectsFor(nation([entry("TORPEDO_TACTICS", 12)]), rules)).toEqual({
      ...NONE,
      torpedoTacticsBp: rules.training.subjects.TORPEDO_TACTICS.effectBp,
    });
  });

  it("gives nothing while a subject is still being trained", () => {
    expect(trainingEffectsFor(nation([entry("GUNNERY", 11)]), rules)).toEqual(NONE);
  });

  it("gives nothing with no program or with the layer dormant", () => {
    expect(trainingEffectsFor(nation(undefined), rules)).toEqual(NONE);
    expect(trainingEffectsFor(nation([entry("GUNNERY", 12)]), undefined)).toEqual(NONE);
  });
});
