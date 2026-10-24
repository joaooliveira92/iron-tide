import { Result } from "effect";
import { decodePrestigeValueSet } from "../src/prestige.js";

type Row = Record<string, unknown>;

const RULES: Row = {
  UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS", basisPoints: 500 },
  BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: 1_000 },
  BATTLE_WON: { kind: "FIXED_GAIN", amount: 2 },
};

const BASE: Row = {
  lowerBound: 0,
  upperBound: 100,
  sackingThreshold: 10,
  sackingProbabilityBp: 2_500,
  rules: RULES,
};

const PRODUCTION: Row = {
  lowerBound: 0,
  upperBound: 1000,
  sackingThreshold: 16,
  sackingProbabilityBp: 1000,
  rules: {
    UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS", basisPoints: 300 },
    BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: 500 },
    BATTLE_WON: { kind: "FIXED_GAIN", amount: 1 },
  },
};

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function set(patch: (row: Row) => void): Row {
  const row = copy(BASE);
  patch(row);
  return row;
}

function rule(code: string, value: unknown): Row {
  return set((row) => void ((row["rules"] as Row)[code] = value));
}

export interface PrestigeCase {
  readonly name: string;
  readonly input: unknown;
}

const TOP = ["lowerBound", "upperBound", "sackingThreshold", "sackingProbabilityBp", "rules"];
const BAD_INTS: ReadonlyArray<readonly [string, unknown]> = [
  ["undefined", undefined],
  ["null", null],
  ["string", "5"],
  ["float", 1.5],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["unsafe", 2 ** 53],
  ["negative", -1],
  ["object", {}],
];
const KINDS: ReadonlyArray<readonly [string, Row]> = [
  ["PROPORTIONAL_LOSS", { kind: "PROPORTIONAL_LOSS", basisPoints: 100 }],
  ["FIXED_GAIN", { kind: "FIXED_GAIN", amount: 3 }],
  ["FIXED_LOSS", { kind: "FIXED_LOSS", amount: 3 }],
];

export const PRESTIGE_CASES: readonly PrestigeCase[] = [
  { name: "base", input: BASE },
  { name: "production value set", input: PRODUCTION },
  ...KINDS.map(([kind, value]) => ({
    name: `valid DECLINED_BATTLE ${kind}`,
    input: rule("DECLINED_BATTLE", value),
  })),
  { name: "DECLINED_BATTLE undefined", input: rule("DECLINED_BATTLE", undefined) },
  {
    name: "rules in another order",
    input: set(
      (r) =>
        void (r["rules"] = {
          BATTLE_WON: { kind: "FIXED_GAIN", amount: 2 },
          UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS", basisPoints: 500 },
          BATTLE_LOST: { kind: "PROPORTIONAL_LOSS", basisPoints: 1_000 },
        }),
    ),
  },
  { name: "threshold at lowerBound", input: set((r) => void (r["sackingThreshold"] = 0)) },
  { name: "threshold at upperBound", input: set((r) => void (r["sackingThreshold"] = 100)) },
  { name: "probability zero", input: set((r) => void (r["sackingProbabilityBp"] = 0)) },
  { name: "probability whole", input: set((r) => void (r["sackingProbabilityBp"] = 10_000)) },
  {
    name: "basisPoints zero",
    input: rule("UNPAID_FUNDS", { kind: "PROPORTIONAL_LOSS", basisPoints: 0 }),
  },
  {
    name: "basisPoints whole",
    input: rule("UNPAID_FUNDS", { kind: "PROPORTIONAL_LOSS", basisPoints: 10_000 }),
  },
  { name: "amount zero", input: rule("BATTLE_WON", { kind: "FIXED_GAIN", amount: 0 }) },
  { name: "amount equals span", input: rule("BATTLE_WON", { kind: "FIXED_GAIN", amount: 100 }) },
  {
    name: "nonzero lowerBound",
    input: set((r) => {
      r["lowerBound"] = 10;
      r["upperBound"] = 60;
      r["sackingThreshold"] = 20;
      (r["rules"] as Row)["BATTLE_WON"] = { kind: "FIXED_GAIN", amount: 50 };
    }),
  },
  { name: "null input", input: null },
  { name: "undefined input", input: undefined },
  { name: "number input", input: 5 },
  { name: "string input", input: "x" },
  { name: "array input", input: [] },
  { name: "empty object", input: {} },
  { name: "excess top-level key", input: set((r) => void (r["extra"] = 1)) },
  {
    name: "two excess keys",
    input: set((r) => {
      r["zeta"] = 1;
      r["alpha"] = 2;
    }),
  },
  {
    name: "excess key before invalid field",
    input: set((r) => {
      r["extra"] = 1;
      r["lowerBound"] = "x";
    }),
  },
  ...TOP.flatMap((field) => [
    { name: `omitted ${field}`, input: set((r) => void delete r[field]) },
  ]),
  ...["lowerBound", "upperBound", "sackingThreshold", "sackingProbabilityBp"].flatMap((field) =>
    BAD_INTS.map(([label, value]) => ({
      name: `${label} ${field}`,
      input: set((r) => void (r[field] = value)),
    })),
  ),
  { name: "probability above whole", input: set((r) => void (r["sackingProbabilityBp"] = 10_001)) },
  {
    name: "upperBound equals lowerBound",
    input: set((r) => {
      r["upperBound"] = 0;
      r["sackingThreshold"] = 0;
    }),
  },
  {
    name: "upperBound below lowerBound",
    input: set((r) => {
      r["lowerBound"] = 50;
      r["upperBound"] = 10;
    }),
  },
  {
    name: "threshold below lowerBound",
    input: set((r) => {
      r["lowerBound"] = 20;
      r["sackingThreshold"] = 10;
    }),
  },
  { name: "threshold above upperBound", input: set((r) => void (r["sackingThreshold"] = 101)) },
  {
    name: "lowerBound and upperBound both invalid",
    input: set((r) => {
      r["lowerBound"] = "x";
      r["upperBound"] = "y";
    }),
  },
  {
    name: "ordering failure before invalid probability",
    input: set((r) => {
      r["upperBound"] = 0;
      r["sackingProbabilityBp"] = "x";
    }),
  },
  {
    name: "threshold failure before invalid probability",
    input: set((r) => {
      r["sackingThreshold"] = 500;
      r["sackingProbabilityBp"] = "x";
    }),
  },
  {
    name: "invalid probability before invalid rules",
    input: set((r) => {
      r["sackingProbabilityBp"] = -1;
      r["rules"] = null;
    }),
  },
  {
    name: "ordering failure before invalid rules",
    input: set((r) => {
      r["upperBound"] = 0;
      r["rules"] = null;
    }),
  },
  { name: "rules undefined", input: set((r) => void (r["rules"] = undefined)) },
  { name: "rules null", input: set((r) => void (r["rules"] = null)) },
  { name: "rules array", input: set((r) => void (r["rules"] = [])) },
  { name: "rules string", input: set((r) => void (r["rules"] = "x")) },
  { name: "rules with excess code", input: rule("OTHER", { kind: "FIXED_GAIN", amount: 1 }) },
  {
    name: "excess code before invalid rule",
    input: set((r) => {
      (r["rules"] as Row)["OTHER"] = 1;
      (r["rules"] as Row)["BATTLE_WON"] = null;
    }),
  },
  ...["UNPAID_FUNDS", "BATTLE_LOST", "BATTLE_WON"].flatMap((code) => [
    { name: `missing ${code}`, input: set((r) => void delete (r["rules"] as Row)[code]) },
    { name: `undefined ${code}`, input: rule(code, undefined) },
  ]),
  ...["UNPAID_FUNDS", "DECLINED_BATTLE"].flatMap((code) => [
    { name: `null rule ${code}`, input: rule(code, null) },
    { name: `array rule ${code}`, input: rule(code, []) },
    { name: `string rule ${code}`, input: rule(code, "x") },
    { name: `number rule ${code}`, input: rule(code, 5) },
    { name: `rule without kind ${code}`, input: rule(code, { amount: 1 }) },
    {
      name: `rule with unknown kind ${code}`,
      input: rule(code, { kind: "WAR_LOSS", basisPoints: 100 }),
    },
    { name: `rule with numeric kind ${code}`, input: rule(code, { kind: 1 }) },
    {
      name: `unknown kind with excess key ${code}`,
      input: rule(code, { kind: "WAR_LOSS", extra: 1 }),
    },
  ]),
  ...KINDS.flatMap(([kind, value]) => [
    { name: `excess key in ${kind} rule`, input: rule("UNPAID_FUNDS", { ...value, extra: 1 }) },
    {
      name: `excess key before invalid value in ${kind} rule`,
      input: rule("UNPAID_FUNDS", { ...value, basisPoints: "x", amount: "x", extra: 1 }),
    },
    {
      name: `excess key in optional ${kind} rule`,
      input: rule("DECLINED_BATTLE", { ...value, extra: 1 }),
    },
  ]),
  ...BAD_INTS.flatMap(([label, value]) => [
    {
      name: `${label} basisPoints`,
      input: rule("UNPAID_FUNDS", { kind: "PROPORTIONAL_LOSS", basisPoints: value }),
    },
    {
      name: `${label} FIXED_GAIN amount`,
      input: rule("BATTLE_WON", { kind: "FIXED_GAIN", amount: value }),
    },
    {
      name: `${label} FIXED_LOSS amount`,
      input: rule("DECLINED_BATTLE", { kind: "FIXED_LOSS", amount: value }),
    },
  ]),
  {
    name: "basisPoints above whole",
    input: rule("UNPAID_FUNDS", { kind: "PROPORTIONAL_LOSS", basisPoints: 10_001 }),
  },
  { name: "FIXED_GAIN above span", input: rule("BATTLE_WON", { kind: "FIXED_GAIN", amount: 101 }) },
  {
    name: "FIXED_LOSS above span",
    input: rule("DECLINED_BATTLE", { kind: "FIXED_LOSS", amount: 101 }),
  },
  {
    name: "FIXED_GAIN amount with basisPoints key",
    input: rule("BATTLE_WON", { kind: "FIXED_GAIN", basisPoints: 100 }),
  },
  {
    name: "PROPORTIONAL_LOSS with amount key",
    input: rule("UNPAID_FUNDS", { kind: "PROPORTIONAL_LOSS", amount: 1 }),
  },
  {
    name: "first required rule wins",
    input: set((r) => {
      (r["rules"] as Row)["UNPAID_FUNDS"] = null;
      (r["rules"] as Row)["BATTLE_LOST"] = null;
    }),
  },
  {
    name: "required rule before invalid optional",
    input: set((r) => {
      (r["rules"] as Row)["BATTLE_WON"] = null;
      (r["rules"] as Row)["DECLINED_BATTLE"] = null;
    }),
  },
  {
    name: "span-dependent amount with moved bounds",
    input: set((r) => {
      r["lowerBound"] = 10;
      r["upperBound"] = 20;
      r["sackingThreshold"] = 15;
    }),
  },
];

export interface ObservedPrestige {
  readonly ok: boolean;
  readonly error?: { readonly tag: string; readonly field: string; readonly message: string };
  readonly value?: unknown;
  readonly ruleKeys?: readonly string[];
}

export function observePrestige(input: unknown): ObservedPrestige {
  const decoded = decodePrestigeValueSet(input);
  if (Result.isFailure(decoded)) {
    const failure = decoded.failure;
    return {
      ok: false,
      error: { tag: failure._tag, field: failure.field, message: failure.message },
    };
  }
  return {
    ok: true,
    value: structuredClone(decoded.success),
    ruleKeys: Object.keys(decoded.success.rules),
  };
}
