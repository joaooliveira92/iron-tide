import type { SnapAction, SnapOptions } from "./snap-args.ts";

export const MANIFEST_SCHEMA_VERSION = 1;
export const MANIFEST_FILE = "steps.json";

export type StepOutcome = "ok" | "warning" | "failed";
export type FallbackKind = "text-match" | "dispatch-click";
export type ExitClassification = "clean" | "problems" | "strict-failure" | "aborted";

export type ManifestAction =
  | Exclude<SnapAction, { readonly kind: "fill" }>
  | { readonly kind: "fill"; readonly label: string };

export interface StepRecord {
  readonly step: number;
  readonly action: ManifestAction;
  readonly description: string;
  readonly outcome: StepOutcome;
  readonly fallbacks: readonly FallbackKind[];
  readonly problems: readonly string[];
}

export interface SnapManifest {
  readonly schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  readonly options: {
    readonly waitMs: number;
    readonly settleMs: number;
    readonly waitMaxMs: number;
    readonly tour: boolean;
    readonly strict: boolean;
    readonly freeze: boolean;
    readonly fullRes: boolean;
    readonly save: boolean;
    readonly makeSave: boolean;
    readonly eval: boolean;
    readonly selector?: string;
    readonly size?: { readonly width: number; readonly height: number };
    readonly theme?: string;
    readonly background?: string;
  };
  readonly actions: readonly ManifestAction[];
  readonly steps: readonly StepRecord[];
  readonly problems: readonly string[];
  readonly artifacts: readonly string[];
  readonly result: { readonly classification: ExitClassification; readonly exitCode: 0 | 1 };
}

export function describeAction(action: SnapAction): string {
  switch (action.kind) {
    case "click":
    case "hover":
      return `${action.kind} "${action.target}"`;
    case "fill":
      return `fill "${action.label}"`;
    case "press":
      return `press ${action.key}`;
    case "advance":
      return `advance ${action.months} month(s)`;
    case "shot":
      return `shot ${action.name}`;
    case "clickAt":
      return `click-at ${action.x},${action.y}`;
    case "scroll":
      return `scroll ${action.dx},${action.dy}${action.at ? `@${action.at.x},${action.at.y}` : ""}`;
  }
}

export function redactAction(action: SnapAction): ManifestAction {
  return action.kind === "fill" ? { kind: "fill", label: action.label } : action;
}

export interface StepRecorder {
  readonly warn: (step: number, message: string, fallback?: FallbackKind) => string;
  readonly fail: (step: number, message: string) => string;
  readonly steps: () => readonly StepRecord[];
}

interface MutableStep {
  step: number;
  action: ManifestAction;
  description: string;
  outcome: StepOutcome;
  fallbacks: FallbackKind[];
  problems: string[];
}

export function createStepRecorder(actions: readonly SnapAction[]): StepRecorder {
  const records: MutableStep[] = actions.map((action, index) => ({
    step: index + 1,
    action: redactAction(action),
    description: describeAction(action),
    outcome: "ok",
    fallbacks: [],
    problems: [],
  }));
  const at = (step: number): MutableStep => {
    const record = records[step - 1];
    if (record === undefined) throw new RangeError(`unknown snap step ${step}`);
    return record;
  };
  const note = (step: number, message: string, outcome: StepOutcome): string => {
    const record = at(step);
    const text = `step ${record.step} (${record.description}): ${message}`;
    record.problems.push(text);
    if (record.outcome !== "failed") record.outcome = outcome;
    return text;
  };
  return {
    warn: (step, message, fallback) => {
      const text = note(step, message, "warning");
      if (fallback !== undefined && !at(step).fallbacks.includes(fallback)) {
        at(step).fallbacks.push(fallback);
      }
      return text;
    },
    fail: (step, message) => note(step, message, "failed"),
    steps: () =>
      records.map((r) => ({ ...r, fallbacks: [...r.fallbacks], problems: [...r.problems] })),
  };
}

export function classifyExit(input: {
  readonly problemCount: number;
  readonly strict: boolean;
  readonly aborted: boolean;
}): SnapManifest["result"] {
  if (input.aborted) return { classification: "aborted", exitCode: 1 };
  if (input.problemCount === 0) return { classification: "clean", exitCode: 0 };
  return input.strict
    ? { classification: "strict-failure", exitCode: 1 }
    : { classification: "problems", exitCode: 0 };
}

export function buildManifest(input: {
  readonly options: SnapOptions;
  readonly steps: readonly StepRecord[];
  readonly problems: readonly string[];
  readonly artifacts: readonly string[];
  readonly aborted: boolean;
}): SnapManifest {
  const { options } = input;
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    options: {
      waitMs: options.waitMs,
      settleMs: options.settleMs,
      waitMaxMs: options.waitMaxMs,
      tour: options.tour,
      strict: options.strict,
      freeze: options.freeze,
      fullRes: options.fullRes,
      save: options.save !== undefined,
      makeSave: options.makeSave !== undefined,
      eval: options.evalSource !== undefined,
      ...(options.selector !== undefined ? { selector: options.selector } : {}),
      ...(options.size !== undefined ? { size: options.size } : {}),
      ...(options.theme !== undefined ? { theme: options.theme } : {}),
      ...(options.background !== undefined ? { background: options.background } : {}),
    },
    actions: options.actions.map(redactAction),
    steps: input.steps,
    problems: input.problems,
    artifacts: input.artifacts,
    result: classifyExit({
      problemCount: input.problems.length,
      strict: options.strict,
      aborted: input.aborted,
    }),
  };
}
