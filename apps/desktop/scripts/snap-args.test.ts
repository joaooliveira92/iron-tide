import { describe, expect, it } from "vite-plus/test";
import { parseSnapArgs, SnapUsageError } from "./snap-args.ts";

describe("parseSnapArgs", () => {
  it("keeps actions in command-line order across every action flag", () => {
    const opts = parseSnapArgs([
      "--click",
      "A",
      "--shot",
      "one",
      "--press",
      "Escape",
      "--advance",
      "2",
      "--hover",
      "B",
      "--fill",
      "Name=x",
    ]);

    expect(opts.actions).toEqual([
      { kind: "click", target: "A" },
      { kind: "shot", name: "one" },
      { kind: "press", key: "Escape" },
      { kind: "advance", months: 2 },
      { kind: "hover", target: "B" },
      { kind: "fill", label: "Name", value: "x" },
    ]);
  });

  it("accepts the --flag=value form without losing the action", () => {
    const opts = parseSnapArgs(["--click=Open Campaign", "--press=Enter"]);

    expect(opts.actions).toEqual([
      { kind: "click", target: "Open Campaign" },
      { kind: "press", key: "Enter" },
    ]);
  });

  it("does not mistake an action value that looks like a flag for an action", () => {
    const opts = parseSnapArgs(["--fill", "Name=--click", "--click", "Go"]);

    expect(opts.actions).toEqual([
      { kind: "fill", label: "Name", value: "--click" },
      { kind: "click", target: "Go" },
    ]);
  });

  it("parses pointer actions", () => {
    const opts = parseSnapArgs([
      "--click-at",
      "120,80",
      "--scroll",
      "0,-300",
      "--scroll",
      "5,6@7,8",
    ]);

    expect(opts.actions).toEqual([
      { kind: "clickAt", x: 120, y: 80 },
      { kind: "scroll", dx: 0, dy: -300 },
      { kind: "scroll", dx: 5, dy: 6, at: { x: 7, y: 8 } },
    ]);
  });

  it("applies defaults", () => {
    const opts = parseSnapArgs([]);

    expect(opts).toMatchObject({
      out: ".dev-data/view",
      waitMs: 300,
      settleMs: 0,
      waitMaxMs: 5000,
      tour: false,
      strict: false,
      freeze: false,
      actions: [],
    });
    expect(opts.background).toBeUndefined();
  });

  it("parses scalar options", () => {
    const opts = parseSnapArgs([
      "--out",
      ".dev-data/custom-view",
      "--wait",
      "100",
      "--settle",
      "200",
      "--wait-max",
      "3000",
      "--eval",
      "document.title",
      "--save",
      "existing-save",
      "--make-save",
      "new-save",
      "--selector",
      "#app",
      "--tour",
      "--strict",
    ]);

    expect(opts).toMatchObject({
      out: ".dev-data/custom-view",
      waitMs: 100,
      settleMs: 200,
      waitMaxMs: 3000,
      evalSource: "document.title",
      save: "existing-save",
      makeSave: "new-save",
      selector: "#app",
      tour: true,
      strict: true,
    });
  });

  it("parses size, theme and background", () => {
    const opts = parseSnapArgs(["--size", "900x700", "--theme", "dark", "--background", "auralis"]);

    expect(opts).toMatchObject({
      size: { width: 900, height: 700 },
      theme: "dark",
      background: "auralis",
    });
  });

  it("--freeze implies the static background unless one is chosen", () => {
    expect(parseSnapArgs(["--freeze"])).toMatchObject({
      freeze: true,
      background: "none",
    });
    expect(parseSnapArgs(["--freeze", "--background", "stars"])).toMatchObject({
      freeze: true,
      background: "stars",
    });
  });

  it("allows fill to clear a field", () => {
    expect(parseSnapArgs(["--fill", "Name="]).actions).toEqual([
      { kind: "fill", label: "Name", value: "" },
    ]);
  });

  it("preserves equals signs inside a fill value", () => {
    expect(parseSnapArgs(["--fill", "Expression=a=b=c"]).actions).toEqual([
      { kind: "fill", label: "Expression", value: "a=b=c" },
    ]);
  });

  it.each(["screenshot", "Screenshot", "SCREENSHOT"])(
    "rejects the reserved shot name regardless of case: %s",
    (name) => {
      expect(() => parseSnapArgs(["--shot", name])).toThrow(SnapUsageError);
    },
  );

  it("rejects duplicate shot names regardless of case", () => {
    expect(() => parseSnapArgs(["--shot", "overview", "--shot", "Overview"])).toThrow(
      SnapUsageError,
    );
  });

  it.each([
    [["--theme", "darK"]],
    [["--background", "lava"]],
    [["--size", "900"]],
    [["--size", "0x700"]],
    [["--size", "900x0"]],
    [["--size", "7681x700"]],
    [["--size", "900x4321"]],
    [["--size", "9007199254740993x700"]],
    [["--wait", "-1"]],
    [["--wait", "300001"]],
    [["--wait", "9007199254740993"]],
    [["--settle", "-1"]],
    [["--settle", "300001"]],
    [["--wait-max", "0"]],
    [["--wait-max", "300001"]],
    [["--advance", "0"]],
    [["--advance", "1201"]],
    [["--advance", "x"]],
    [["--advance", "9007199254740993"]],
    [["--shot", "../evil"]],
    [["--shot", ""]],
    [["--click", ""]],
    [["--hover", "   "]],
    [["--press", ""]],
    [["--click-at", "1"]],
    [["--click-at", "100001,0"]],
    [["--click-at", "9007199254740993,0"]],
    [["--scroll", "a,b"]],
    [["--scroll", "0,-100001"]],
    [["--scroll", "1,2@3,4@5,6"]],
    [["--fill", "novalue"]],
    [["--fill", "=value"]],
    [["--fill", "   =value"]],
    [["--bogus"]],
  ])("rejects invalid input %j", (argv) => {
    expect(() => parseSnapArgs(argv)).toThrow(SnapUsageError);
  });

  it("accepts numeric values at their configured boundaries", () => {
    const opts = parseSnapArgs([
      "--wait",
      "300000",
      "--settle",
      "300000",
      "--wait-max",
      "300000",
      "--advance",
      "1200",
      "--size",
      "7680x4320",
      "--click-at",
      "-100000,100000",
      "--scroll",
      "100000,-100000@-100000,100000",
    ]);

    expect(opts).toMatchObject({
      waitMs: 300000,
      settleMs: 300000,
      waitMaxMs: 300000,
      size: { width: 7680, height: 4320 },
    });
    expect(opts.actions).toEqual([
      { kind: "advance", months: 1200 },
      { kind: "clickAt", x: -100000, y: 100000 },
      {
        kind: "scroll",
        dx: 100000,
        dy: -100000,
        at: { x: -100000, y: 100000 },
      },
    ]);
  });

  it("rejects more than the configured maximum number of actions", () => {
    const argv = Array.from({ length: 1001 }, () => ["--click", "A"]).flat();

    expect(() => parseSnapArgs(argv)).toThrow(SnapUsageError);
  });

  it("normalizes parseArgs failures to SnapUsageError", () => {
    expect(() => parseSnapArgs(["unexpected-positional"])).toThrow(SnapUsageError);
  });
});
