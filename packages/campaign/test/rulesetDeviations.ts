import type { Observed } from "./rulesetCases.js";

type Diagnostic = Observed["diagnostics"][number];

export function rejected(code: string, stage: string, ...messages: readonly string[]): Observed {
  const diagnostics: Diagnostic[] = messages.map((message) => ({ code, message, stage }));
  return { accepted: false, returnsInput: false, diagnostics };
}

const RESEARCH = (...messages: readonly string[]) =>
  rejected("INVALID_RESEARCH_SPEED_MULTIPLIER", "research-speed", ...messages);

export const INTENDED_DEVIATIONS: Readonly<Record<string, Readonly<Record<string, Observed>>>> = {
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
