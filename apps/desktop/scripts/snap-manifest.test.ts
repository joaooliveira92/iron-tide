import { describe, expect, it } from "vite-plus/test";
import { parseSnapArgs, type SnapAction } from "./snap-args.ts";
import {
  buildManifest,
  classifyExit,
  createStepRecorder,
  describeAction,
  MANIFEST_SCHEMA_VERSION,
} from "./snap-manifest.ts";

const actions: readonly SnapAction[] = [
  { kind: "click", target: "Open" },
  { kind: "fill", label: "Password", value: "hunter2" },
  { kind: "shot", name: "one" },
];

describe("describeAction", () => {
  it("never includes a fill value", () => {
    expect(describeAction({ kind: "fill", label: "Password", value: "hunter2" })).toBe(
      'fill "Password"',
    );
  });

  it("describes pointer actions", () => {
    expect(describeAction({ kind: "scroll", dx: 1, dy: 2, at: { x: 3, y: 4 } })).toBe(
      "scroll 1,2@3,4",
    );
    expect(describeAction({ kind: "clickAt", x: 5, y: 6 })).toBe("click-at 5,6");
  });
});

describe("createStepRecorder", () => {
  it("numbers steps from one in action order", () => {
    const steps = createStepRecorder(actions).steps();
    expect(steps.map((s) => [s.step, s.action.kind])).toEqual([
      [1, "click"],
      [2, "fill"],
      [3, "shot"],
    ]);
  });

  it("prefixes warnings and failures with the step index and description", () => {
    const recorder = createStepRecorder(actions);
    expect(recorder.warn(1, "fell back", "text-match")).toBe('step 1 (click "Open"): fell back');
    expect(recorder.fail(2, "fill failed: timeout")).toBe(
      'step 2 (fill "Password"): fill failed: timeout',
    );
  });

  it("records outcome and fallbacks, and a failure is never downgraded", () => {
    const recorder = createStepRecorder(actions);
    recorder.warn(1, "a", "text-match");
    recorder.warn(1, "b", "dispatch-click");
    recorder.warn(1, "c", "dispatch-click");
    recorder.fail(2, "x");
    recorder.warn(2, "y");
    const [first, second, third] = recorder.steps();
    expect(first?.outcome).toBe("warning");
    expect(first?.fallbacks).toEqual(["text-match", "dispatch-click"]);
    expect(second?.outcome).toBe("failed");
    expect(third?.outcome).toBe("ok");
  });

  it("rejects an unknown step", () => {
    expect(() => createStepRecorder(actions).warn(9, "x")).toThrow(RangeError);
  });
});

describe("classifyExit", () => {
  it("separates clean, tolerated, strict-failure and aborted runs", () => {
    expect(classifyExit({ problemCount: 0, strict: true, aborted: false })).toEqual({
      classification: "clean",
      exitCode: 0,
    });
    expect(classifyExit({ problemCount: 2, strict: false, aborted: false })).toEqual({
      classification: "problems",
      exitCode: 0,
    });
    expect(classifyExit({ problemCount: 2, strict: true, aborted: false })).toEqual({
      classification: "strict-failure",
      exitCode: 1,
    });
    expect(classifyExit({ problemCount: 0, strict: false, aborted: true })).toEqual({
      classification: "aborted",
      exitCode: 1,
    });
  });
});

describe("buildManifest", () => {
  const options = parseSnapArgs([
    "--click",
    "Open",
    "--fill",
    "Password=hunter2",
    "--shot",
    "one",
    "--strict",
    "--save",
    "/home/secret/save",
    "--eval",
    "document.cookie",
    "--out",
    "/abs/out",
  ]);

  const recorder = createStepRecorder(options.actions);
  const problem = recorder.warn(1, "fell back", "text-match");
  const manifest = buildManifest({
    options,
    steps: recorder.steps(),
    problems: [problem],
    artifacts: ["one.png", "screenshot.png", "steps.json"],
    aborted: false,
  });

  it("carries the schema version, ordered actions and one-based steps", () => {
    expect(manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(manifest.actions.map((a) => a.kind)).toEqual(["click", "fill", "shot"]);
    expect(manifest.steps.map((s) => s.step)).toEqual([1, 2, 3]);
  });

  it("records effective options, fallbacks, problems, artifacts and exit classification", () => {
    expect(manifest.options).toMatchObject({
      strict: true,
      waitMs: 300,
      tour: false,
      size: { width: 1280, height: 800 },
    });
    expect(manifest.steps[0]?.fallbacks).toEqual(["text-match"]);
    expect(manifest.problems).toEqual([problem]);
    expect(manifest.artifacts).toEqual(["one.png", "screenshot.png", "steps.json"]);
    expect(manifest.result).toEqual({ classification: "strict-failure", exitCode: 1 });
  });

  it("omits secrets and absolute local paths", () => {
    const text = JSON.stringify(manifest);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("/home/secret");
    expect(text).not.toContain("document.cookie");
    expect(text).not.toContain("/abs/out");
    expect(manifest.options).toMatchObject({ save: true, makeSave: false, eval: true });
  });
});
