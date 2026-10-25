import type { Observed } from "./rulesetCases.js";

type Diagnostic = Observed["diagnostics"][number];

export function rejected(code: string, stage: string, ...messages: readonly string[]): Observed {
  const diagnostics: Diagnostic[] = messages.map((message) => ({ code, message, stage }));
  return { accepted: false, returnsInput: false, diagnostics };
}

export function rejectedBoolean(
  code: string,
  stage: string,
  ...messages: readonly string[]
): Observed {
  const diagnostics: Diagnostic[] = messages.map((message) => ({ code, message, stage }));
  return { accepted: false, diagnostics };
}

const RESEARCH = (...messages: readonly string[]) =>
  rejected("INVALID_RESEARCH_SPEED_MULTIPLIER", "research-speed", ...messages);

const FLEET_MISSING = "MISSING_FLEET_SIZE_MULTIPLIER";
const FLEET_RANGE = "FLEET_SIZE_MULTIPLIER_OUT_OF_RANGE";

function fleet(
  shape: "boolean" | "list",
  ...entries: ReadonlyArray<readonly [code: string, message: string]>
): Observed {
  const diagnostics: Diagnostic[] = entries.map(([code, message]) => ({
    code,
    message,
    stage: "fleet-size",
  }));
  return shape === "list"
    ? { accepted: false, returnsInput: false, diagnostics }
    : { accepted: false, diagnostics };
}

const FLEET_MULTIPLIERS = [
  "navalAppropriationMultiplierBp",
  "sustainableFleetSizeMultiplierBp",
  "aiForceTargetMultiplierBp",
  "generatedLegacyFleetScaleMultiplierBp",
] as const;

const NOT_AN_OBJECT = fleet("boolean", [FLEET_MISSING, "fleet-size setting must be object"]);

const FLEET_SETTING_DEVIATIONS: Record<string, Observed> = {
  "unknown settingId (not checked here)": fleet("boolean", [
    FLEET_MISSING,
    "Invalid fleet-size settingId huge",
  ]),
  "excess key": fleet("boolean", [FLEET_MISSING, "unknown fleet-size field surprise for standard"]),
  "null settingId": fleet("boolean", [FLEET_MISSING, "Invalid fleet-size settingId null"]),
  "numeric settingId": fleet("boolean", [FLEET_MISSING, "Invalid fleet-size settingId 7"]),
  "null rulesetVersion": fleet("boolean", [
    FLEET_MISSING,
    "rulesetVersion must be a non-empty string for standard",
  ]),
  "numeric rulesetVersion": fleet("boolean", [
    FLEET_MISSING,
    "rulesetVersion must be a non-empty string for standard",
  ]),
  "null input": NOT_AN_OBJECT,
  "undefined input": NOT_AN_OBJECT,
  "number input": NOT_AN_OBJECT,
  "string input": NOT_AN_OBJECT,
  "boolean input": NOT_AN_OBJECT,
  ...Object.fromEntries(
    FLEET_MULTIPLIERS.flatMap((field) => [
      [
        `bad fractional ${field}`,
        fleet("boolean", [FLEET_RANGE, `${field}=5000.5 out of 5000..20000`]),
      ],
      [`bad NaN ${field}`, fleet("boolean", [FLEET_RANGE, `${field}=NaN out of 5000..20000`])],
    ]),
  ),
};

const NOT_AN_OBJECT_ENTRY = fleet(
  "list",
  [FLEET_MISSING, "fleet-size setting must be object"],
  [FLEET_MISSING, "Ruleset missing canonical fleet-size setting very_large"],
);

const UNKNOWN_ID_WITH_FOUR = fleet(
  "list",
  [FLEET_MISSING, "Invalid fleet-size settingId huge"],
  [FLEET_MISSING, "Ruleset missing canonical fleet-size setting very_large"],
);

const FLEET_LIST_DEVIATIONS: Record<string, Observed> = {
  "unknown id with four": UNKNOWN_ID_WITH_FOUR,
  "mismatch on unknown id is ignored": UNKNOWN_ID_WITH_FOUR,
  "excess key in an entry": fleet("list", [
    FLEET_MISSING,
    "unknown fleet-size field surprise for small",
  ]),
  "null entry": NOT_AN_OBJECT_ENTRY,
  "number entry": NOT_AN_OBJECT_ENTRY,
};

export const INTENDED_DEVIATIONS: Readonly<Record<string, Readonly<Record<string, Observed>>>> = {
  participation: {
    "excess key": rejectedBoolean(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      "continuity",
      "unknown field surprise",
    ),
  },
  fleetSetting: FLEET_SETTING_DEVIATIONS,
  fleetList: FLEET_LIST_DEVIATIONS,
  research: {
    "fractional multiplierBp": RESEARCH("Research multiplier 5000.5 out of 5000..20000"),
    "NaN multiplierBp": RESEARCH("Research multiplier NaN out of 5000..20000"),
    "missing rulesetVersion": RESEARCH(
      "Research setting slow: rulesetVersion must be a non-empty string",
    ),
    "numeric rulesetVersion": RESEARCH(
      "Research setting slow: rulesetVersion must be a non-empty string",
    ),
    "excess key in an entry": RESEARCH("Research setting slow: unknown field surprise"),
    "null entry": RESEARCH(
      "research speed setting must be object",
      "Ruleset missing canonical research-speed setting very_fast",
    ),
    "number entry": RESEARCH(
      "research speed setting must be object",
      "Ruleset missing canonical research-speed setting very_fast",
    ),
    "array entry": RESEARCH(
      "Research multiplier undefined out of 5000..20000",
      "Invalid research setting undefined",
      "Research setting undefined: rulesetVersion must be a non-empty string",
      "Ruleset missing canonical research-speed setting very_fast",
    ),
  },
};
