import { parseArgs } from "node:util";
import {
  BACKGROUND_PREFERENCES,
  THEME_PREFERENCES,
  type BackgroundPreference,
  type ThemePreference,
} from "../src/shared/preferences-contract.ts";

export class SnapUsageError extends Error {
  readonly _tag = "SnapUsageError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SnapUsageError";
  }
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type SnapAction =
  | { readonly kind: "click"; readonly target: string }
  | { readonly kind: "hover"; readonly target: string }
  | { readonly kind: "fill"; readonly label: string; readonly value: string }
  | { readonly kind: "press"; readonly key: string }
  | { readonly kind: "advance"; readonly months: number }
  | { readonly kind: "shot"; readonly name: string }
  | { readonly kind: "clickAt"; readonly x: number; readonly y: number }
  | {
      readonly kind: "scroll";
      readonly dx: number;
      readonly dy: number;
      readonly at?: Point;
    };

export interface SnapOptions {
  readonly out: string;
  readonly actions: readonly SnapAction[];
  readonly waitMs: number;
  readonly settleMs: number;
  readonly waitMaxMs: number;
  readonly evalSource?: string;
  readonly save?: string;
  readonly makeSave?: string;
  readonly selector?: string;
  readonly tour: boolean;
  readonly strict: boolean;
  readonly freeze: boolean;
  readonly fullRes: boolean;
  readonly size?: { readonly width: number; readonly height: number };
  readonly theme?: ThemePreference;
  readonly background?: BackgroundPreference;
}

const ACTION_FLAGS = [
  "click",
  "hover",
  "fill",
  "press",
  "advance",
  "shot",
  "click-at",
  "scroll",
] as const;

type ActionFlag = (typeof ACTION_FLAGS)[number];

const SNAP_LIMITS = {
  waitMs: 300_000,
  settleMs: 300_000,
  waitMaxMs: 300_000,
  advanceMonths: 1_200,
  viewportWidth: 7_680,
  viewportHeight: 4_320,
  coordinateMagnitude: 100_000,
  actions: 1_000,
} as const;

export const DEFAULT_SNAP_SIZE = { width: 1280, height: 800 } as const;

const fail = (message: string): never => {
  throw new SnapUsageError(message);
};

function toSafeInteger(
  flag: string,
  raw: string,
  { min, max }: { readonly min?: number; readonly max?: number } = {},
): number {
  if (!/^-?\d+$/.test(raw)) {
    return fail(`${flag} expects an integer, got "${raw}"`);
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value)) {
    return fail(`${flag} expects a safe integer, got "${raw}"`);
  }

  if (min !== undefined && value < min) {
    return fail(`${flag} expects an integer >= ${min}, got "${raw}"`);
  }

  if (max !== undefined && value > max) {
    return fail(`${flag} expects an integer <= ${max}, got "${raw}"`);
  }

  return value;
}

function toBoundedCoordinate(flag: string, raw: string): number {
  return toSafeInteger(flag, raw, {
    min: -SNAP_LIMITS.coordinateMagnitude,
    max: SNAP_LIMITS.coordinateMagnitude,
  });
}

function toPoint(flag: string, raw: string): Point {
  const match = /^(-?\d+),(-?\d+)$/.exec(raw);
  if (match === null) {
    return fail(`${flag} expects X,Y (integers), got "${raw}"`);
  }

  const [, rawX, rawY] = match;
  if (rawX === undefined || rawY === undefined) {
    return fail(`${flag} expects X,Y (integers), got "${raw}"`);
  }

  return {
    x: toBoundedCoordinate(flag, rawX),
    y: toBoundedCoordinate(flag, rawY),
  };
}

function oneOf<T extends string>(flag: string, raw: string, allowed: readonly T[]): T {
  const hit = allowed.find((candidate) => candidate === raw);
  return hit ?? fail(`${flag} expects one of ${allowed.join("|")}, got "${raw}"`);
}

function nonEmpty(flag: string, raw: string): string {
  if (raw.trim().length === 0) {
    return fail(`${flag} expects a non-empty value`);
  }

  return raw;
}

function isActionFlag(value: string): value is ActionFlag {
  return (ACTION_FLAGS as readonly string[]).includes(value);
}

function assertNever(value: never): never {
  return fail(`Unsupported action flag: ${String(value)}`);
}

function toAction(flag: ActionFlag, value: string): SnapAction {
  switch (flag) {
    case "click":
      return { kind: "click", target: nonEmpty("--click", value) };
    case "hover":
      return { kind: "hover", target: nonEmpty("--hover", value) };
    case "press":
      return { kind: "press", key: nonEmpty("--press", value) };
    case "advance":
      return {
        kind: "advance",
        months: toSafeInteger("--advance", value, {
          min: 1,
          max: SNAP_LIMITS.advanceMonths,
        }),
      };
    case "fill": {
      const separatorIndex = value.indexOf("=");
      if (separatorIndex < 1) {
        return fail(`--fill expects LABEL=VALUE, got "${value}"`);
      }

      const label = value.slice(0, separatorIndex);
      if (label.trim().length === 0) {
        return fail(`--fill expects a non-empty label, got "${value}"`);
      }

      return {
        kind: "fill",
        label,
        value: value.slice(separatorIndex + 1),
      };
    }
    case "shot": {
      if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        return fail(`--shot expects a name of letters, digits, "_" or "-", got "${value}"`);
      }

      if (value.toLowerCase() === "screenshot") {
        return fail(`--shot "${value}" would overwrite the final capture`);
      }

      return { kind: "shot", name: value };
    }
    case "click-at": {
      const { x, y } = toPoint("--click-at", value);
      return { kind: "clickAt", x, y };
    }
    case "scroll": {
      const [delta = "", at, ...rest] = value.split("@");
      if (rest.length > 0) {
        return fail(`--scroll expects DX,DY[@X,Y], got "${value}"`);
      }

      const { x: dx, y: dy } = toPoint("--scroll", delta);
      return at === undefined
        ? { kind: "scroll", dx, dy }
        : { kind: "scroll", dx, dy, at: toPoint("--scroll", at) };
    }
    default:
      return assertNever(flag);
  }
}

function parseRawArgs(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      options: {
        out: { type: "string", default: ".dev-data/view" },
        click: { type: "string", multiple: true },
        hover: { type: "string", multiple: true },
        fill: { type: "string", multiple: true },
        press: { type: "string", multiple: true },
        advance: { type: "string", multiple: true },
        shot: { type: "string", multiple: true },
        "click-at": { type: "string", multiple: true },
        scroll: { type: "string", multiple: true },
        wait: { type: "string", default: "300" },
        settle: { type: "string", default: "0" },
        "wait-max": { type: "string", default: "5000" },
        eval: { type: "string" },
        save: { type: "string" },
        "make-save": { type: "string" },
        selector: { type: "string" },
        tour: { type: "boolean", default: false },
        strict: { type: "boolean", default: false },
        freeze: { type: "boolean", default: false },
        "full-res": { type: "boolean", default: false },
        size: { type: "string" },
        theme: { type: "string" },
        background: { type: "string" },
      },
      strict: true,
      tokens: true,
    });
  } catch (error: unknown) {
    throw new SnapUsageError(error instanceof Error ? error.message : String(error), {
      cause: error instanceof Error ? error : undefined,
    });
  }
}

function assertUniqueShotNames(actions: readonly SnapAction[]): void {
  const shotNames = new Set<string>();

  for (const action of actions) {
    if (action.kind !== "shot") continue;

    const normalizedName = action.name.toLowerCase();
    if (shotNames.has(normalizedName)) {
      fail(`--shot name "${action.name}" is duplicated`);
    }

    shotNames.add(normalizedName);
  }
}

export function parseSnapArgs(argv: readonly string[]): SnapOptions {
  const { values, tokens } = parseRawArgs(argv);

  const actions: SnapAction[] = [];
  for (const token of tokens) {
    if (token.kind === "option" && isActionFlag(token.name)) {
      actions.push(toAction(token.name, token.value ?? ""));
    }
  }

  if (actions.length > SNAP_LIMITS.actions) {
    return fail(`snap accepts at most ${SNAP_LIMITS.actions} actions, got ${actions.length}`);
  }

  assertUniqueShotNames(actions);

  if (values.save !== undefined && values["make-save"] !== undefined) {
    return fail("--save and --make-save are mutually exclusive");
  }

  let size: SnapOptions["size"];
  if (values.size !== undefined) {
    const match = /^(\d+)x(\d+)$/.exec(values.size);
    if (match === null) {
      return fail(`--size expects WxH, got "${values.size}"`);
    }

    const [, rawWidth, rawHeight] = match;
    if (rawWidth === undefined || rawHeight === undefined) {
      return fail(`--size expects WxH, got "${values.size}"`);
    }

    size = {
      width: toSafeInteger("--size width", rawWidth, {
        min: 1,
        max: SNAP_LIMITS.viewportWidth,
      }),
      height: toSafeInteger("--size height", rawHeight, {
        min: 1,
        max: SNAP_LIMITS.viewportHeight,
      }),
    };
  } else if (!values["full-res"]) {
    size = DEFAULT_SNAP_SIZE;
  }

  return {
    out: values.out,
    actions,
    waitMs: toSafeInteger("--wait", values.wait, {
      min: 0,
      max: SNAP_LIMITS.waitMs,
    }),
    settleMs: toSafeInteger("--settle", values.settle, {
      min: 0,
      max: SNAP_LIMITS.settleMs,
    }),
    waitMaxMs: toSafeInteger("--wait-max", values["wait-max"], {
      min: 1,
      max: SNAP_LIMITS.waitMaxMs,
    }),
    ...(values.eval !== undefined ? { evalSource: values.eval } : {}),
    ...(values.save !== undefined ? { save: values.save } : {}),
    ...(values["make-save"] !== undefined ? { makeSave: values["make-save"] } : {}),
    ...(values.selector !== undefined ? { selector: values.selector } : {}),
    tour: values.tour,
    strict: values.strict,
    freeze: values.freeze,
    fullRes: values["full-res"],
    ...(size !== undefined ? { size } : {}),
    ...(values.theme !== undefined
      ? { theme: oneOf("--theme", values.theme, THEME_PREFERENCES) }
      : {}),
    ...(values.background !== undefined
      ? {
          background: oneOf("--background", values.background, BACKGROUND_PREFERENCES),
        }
      : values.freeze
        ? { background: "none" as const }
        : {}),
  };
}
