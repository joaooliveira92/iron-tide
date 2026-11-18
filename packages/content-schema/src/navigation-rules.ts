import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));
const percent = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }));
const basisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10_000 }),
);
const chancePpm = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 1_000_000 }),
);

export const NAVIGATION_MACHINERY_CLASSES = ["OIL", "COAL", "VTE"] as const;
export type NavigationMachineryClass = (typeof NAVIGATION_MACHINERY_CLASSES)[number];

export const NavigationFoulingClassSchema = Schema.Struct({
  gratesFouledOnsetMinutes: positiveInt,
  stokersExhaustedOnsetMinutes: positiveInt,
  recoveryMinutes: positiveInt,
});

export const NavigationRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  fouling: Schema.Struct({
    cruiseSpeedPercent: percent,
    classes: Schema.Struct({
      OIL: NavigationFoulingClassSchema,
      COAL: NavigationFoulingClassSchema,
      VTE: NavigationFoulingClassSchema,
    }),
  }),
  breakdown: Schema.Struct({
    baseChancePpm: chancePpm,
    priorityChancePpm: chancePpm,
    maxChancePpm: chancePpm,
    repairMinutes: positiveInt,
    repairSpeedCapPercent: percent,
  }),
  vibration: Schema.Struct({
    thresholdKnots: positiveInt,
    gunneryMultiplierBp: basisPoints,
  }),
  provenance: ProvenanceSchema,
});

export type NavigationFoulingClassRules = typeof NavigationFoulingClassSchema.Type;
export type NavigationRules = typeof NavigationRulesSchema.Type;

export type NavigationRulesDecoded =
  | { readonly ok: true; readonly value: NavigationRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

export interface NavigationOrderingIssue {
  readonly field: string;
  readonly message: string;
}

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeNavigationRules(input: unknown): NavigationRulesDecoded {
  const result = Schema.decodeUnknownResult(NavigationRulesSchema, {
    ...CONTENT_DECODE_OPTIONS,
    errors: "all",
  })(input);
  if (Result.isSuccess(result)) return { ok: true, value: result.success };
  const [first] = formatter(result.failure.issue).issues;
  const path = (first?.path ?? []).filter(
    (key): key is string | number => typeof key === "string" || typeof key === "number",
  );
  return {
    ok: false,
    field: path.length > 0 ? path.join(".") : "(root)",
    message: first?.message ?? "is invalid",
  };
}

const SENSITIVITY_ORDER = [
  ["OIL", "COAL"],
  ["COAL", "VTE"],
] as const;

export function navigationOrderingIssues(
  rules: NavigationRules,
): readonly NavigationOrderingIssue[] {
  const issues: NavigationOrderingIssue[] = [];
  const classes = rules.fouling.classes;
  for (const name of NAVIGATION_MACHINERY_CLASSES) {
    const entry = classes[name];
    const base = `fouling.classes.${name}`;
    if (entry.stokersExhaustedOnsetMinutes <= entry.gratesFouledOnsetMinutes)
      issues.push({
        field: `${base}.stokersExhaustedOnsetMinutes`,
        message: "must be later than gratesFouledOnsetMinutes",
      });
    if (entry.recoveryMinutes <= entry.stokersExhaustedOnsetMinutes)
      issues.push({
        field: `${base}.recoveryMinutes`,
        message: "must be longer than the onset of exhaustion (recovery takes longer than onset)",
      });
  }
  for (const [lessSensitive, moreSensitive] of SENSITIVITY_ORDER) {
    const a = classes[lessSensitive];
    const b = classes[moreSensitive];
    if (b.gratesFouledOnsetMinutes >= a.gratesFouledOnsetMinutes)
      issues.push({
        field: `fouling.classes.${moreSensitive}.gratesFouledOnsetMinutes`,
        message: `must be earlier than ${lessSensitive} (oil < coal < VTE sensitivity)`,
      });
    if (b.stokersExhaustedOnsetMinutes >= a.stokersExhaustedOnsetMinutes)
      issues.push({
        field: `fouling.classes.${moreSensitive}.stokersExhaustedOnsetMinutes`,
        message: `must be earlier than ${lessSensitive} (oil < coal < VTE sensitivity)`,
      });
  }
  if (rules.breakdown.maxChancePpm < rules.breakdown.baseChancePpm)
    issues.push({
      field: "breakdown.maxChancePpm",
      message: "must be at least baseChancePpm",
    });
  return issues;
}
