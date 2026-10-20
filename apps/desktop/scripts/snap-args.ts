/**
 * Argument parsing for `scripts/view.ts` (`pnpm snap`). Pure: it only turns argv into a validated,
 * ordered description of what to do, so the order-sensitive and validating parts are testable
 * without launching Electron.
 */
import { parseArgs } from "node:util";
import {
  BACKGROUND_PREFERENCES,
  THEME_PREFERENCES,
  type BackgroundPreference,
  type ThemePreference,
} from "../src/shared/preferences-contract.ts";

export class SnapUsageError extends Error {
  readonly _tag = "SnapUsageError";
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
  readonly size?: { readonly width: number; readonly height: number };
  readonly theme?: ThemePreference;
  readonly background?: BackgroundPreference;
}

const fail = (message: string): never => {
  throw new SnapUsageError(message);
};

function toInt(flag: string, raw: string, min: number): number {
  if (!/^-?\d+$/.test(raw)) return fail(`${flag} expects an integer, got "${raw}"`);
  const n = Number(raw);
  if (n < min) return fail(`${flag} expects an integer >= ${min}, got "${raw}"`);
  return n;
}

function toPoint(flag: string, raw: string): Point {
  const m = /^(-?\d+),(-?\d+)$/.exec(raw);
  if (m === null) return fail(`${flag} expects X,Y (integers), got "${raw}"`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

function oneOf<T extends string>(flag: string, raw: string, allowed: readonly T[]): T {
  const hit = allowed.find((a) => a === raw);
  return hit ?? fail(`${flag} expects one of ${allowed.join("|")}, got "${raw}"`);
}

function toAction(flag: string, value: string): SnapAction {
  switch (flag) {
    case "click":
      return { kind: "click", target: value };
    case "hover":
      return { kind: "hover", target: value };
    case "press":
      return { kind: "press", key: value };
    case "advance":
      return { kind: "advance", months: toInt("--advance", value, 1) };
    case "fill": {
      const i = value.indexOf("=");
      if (i < 1) return fail(`--fill expects LABEL=VALUE, got "${value}"`);
      return { kind: "fill", label: value.slice(0, i), value: value.slice(i + 1) };
    }
    case "shot":
      if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        return fail(`--shot expects a name of letters, digits, "_" or "-", got "${value}"`);
      }
      if (value === "screenshot")
        return fail(`--shot "screenshot" would overwrite the final capture`);
      return { kind: "shot", name: value };
    case "click-at": {
      const { x, y } = toPoint("--click-at", value);
      return { kind: "clickAt", x, y };
    }
    default: {
      // scroll: "DX,DY" or "DX,DY@X,Y" (move the pointer to X,Y first)
      const [delta = "", at, ...rest] = value.split("@");
      if (rest.length > 0) return fail(`--scroll expects DX,DY[@X,Y], got "${value}"`);
      const { x: dx, y: dy } = toPoint("--scroll", delta);
      return at === undefined
        ? { kind: "scroll", dx, dy }
        : { kind: "scroll", dx, dy, at: toPoint("--scroll", at) };
    }
  }
}

const ACTION_FLAGS = ["click", "hover", "fill", "press", "advance", "shot", "click-at", "scroll"];

export function parseSnapArgs(argv: readonly string[]): SnapOptions {
  let parsed;
  try {
    parsed = parseArgs({
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
        size: { type: "string" },
        theme: { type: "string" },
        background: { type: "string" },
      },
      strict: true,
      tokens: true,
    });
  } catch (e) {
    throw new SnapUsageError(e instanceof Error ? e.message : String(e));
  }
  const { values, tokens } = parsed;

  // Tokens carry the command-line position, so order survives `--flag=value` and values that
  // happen to look like flags.
  const actions: SnapAction[] = [];
  for (const t of tokens) {
    if (t.kind === "option" && ACTION_FLAGS.includes(t.name)) {
      actions.push(toAction(t.name, t.value ?? ""));
    }
  }

  let size: SnapOptions["size"];
  if (values.size !== undefined) {
    const m = /^(\d+)x(\d+)$/.exec(values.size);
    if (m === null) return fail(`--size expects WxH, got "${values.size}"`);
    size = { width: Number(m[1]), height: Number(m[2]) };
  }

  return {
    out: values.out,
    actions,
    waitMs: toInt("--wait", values.wait, 0),
    settleMs: toInt("--settle", values.settle, 0),
    waitMaxMs: toInt("--wait-max", values["wait-max"], 1),
    ...(values.eval !== undefined ? { evalSource: values.eval } : {}),
    ...(values.save !== undefined ? { save: values.save } : {}),
    ...(values["make-save"] !== undefined ? { makeSave: values["make-save"] } : {}),
    ...(values.selector !== undefined ? { selector: values.selector } : {}),
    tour: values.tour,
    strict: values.strict,
    freeze: values.freeze,
    ...(size !== undefined ? { size } : {}),
    ...(values.theme !== undefined
      ? { theme: oneOf("--theme", values.theme, THEME_PREFERENCES) }
      : {}),
    // A frozen capture should not depend on an animated backdrop.
    ...(values.background !== undefined
      ? { background: oneOf("--background", values.background, BACKGROUND_PREFERENCES) }
      : values.freeze
        ? { background: "none" as const }
        : {}),
  };
}
