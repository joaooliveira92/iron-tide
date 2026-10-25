import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import * as K from "./rulesetCases.js";
import { INTENDED_DEVIATIONS } from "./rulesetDeviations.js";

type Recorded = Record<string, Record<string, K.Observed>>;

const RECORDED = JSON.parse(
  readFileSync(new URL("./fixtures/rulesets.legacy.json", import.meta.url), "utf8"),
) as Recorded;

const SETS: Readonly<
  Record<string, readonly [readonly K.RulesetCase[], (input: unknown) => K.Observed]>
> = {
  participation: [K.PARTICIPATION_CASES, K.observeParticipation],
  fleetSetting: [K.FLEET_SETTING_CASES, K.observeFleetSetting],
  fleetList: [K.FLEET_LIST_CASES, K.observeFleetList],
  research: [K.RESEARCH_CASES, K.observeResearch],
  profile: [K.PROFILE_CASES, K.observeProfile],
  profileList: [K.PROFILE_LIST_CASES, K.observeProfileList],
};

describe("ruleset validation parity with the recorded legacy validators", () => {
  for (const [key, [cases, observe]] of Object.entries(SETS)) {
    describe(key, () => {
      it("covers every recorded case", () => {
        expect(Object.keys(RECORDED[key] ?? {})).toEqual(cases.map((c) => c.name));
      });
      it("deviates from the recording only where the schema is stricter", () => {
        for (const name of Object.keys(INTENDED_DEVIATIONS[key] ?? {})) {
          expect(RECORDED[key]?.[name]).toBeDefined();
          expect(INTENDED_DEVIATIONS[key]?.[name]?.accepted).toBe(false);
        }
      });
      for (const { name, input } of cases) {
        it(name, () => {
          expect(observe(input)).toEqual(INTENDED_DEVIATIONS[key]?.[name] ?? RECORDED[key]?.[name]);
        });
      }
    });
  }
});
