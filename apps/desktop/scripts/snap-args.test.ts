import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_SNAP_SIZE, parseSnapArgs, SnapUsageError } from "./snap-args.ts";

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
      fullRes: false,
      size: DEFAULT_SNAP_SIZE,
      actions: [],
    });
  });

  it("leaves the window size alone with --full-res", () => {
    const opts = parseSnapArgs(["--full-res"]);
    expect(opts.fullRes).toBe(true);
    expect(opts.size).toBeUndefined();
  });

  it("lets an explicit --size win over the default", () => {
    expect(parseSnapArgs(["--size", "900x700"]).size).toEqual({ width: 900, height: 700 });
  });

  it("parses strict, size, theme and background", () => {
    const opts = parseSnapArgs([
      "--strict",
      "--size",
      "900x700",
      "--theme",
      "dark",
      "--background",
      "auralis",
    ]);
    expect(opts).toMatchObject({
      strict: true,
      size: { width: 900, height: 700 },
      theme: "dark",
      background: "auralis",
    });
  });

  it("--freeze implies the static background unless one is chosen", () => {
    expect(parseSnapArgs(["--freeze"])).toMatchObject({ freeze: true, background: "none" });
    expect(parseSnapArgs(["--freeze", "--background", "stars"])).toMatchObject({
      freeze: true,
      background: "stars",
    });
    expect(parseSnapArgs([])).toMatchObject({ freeze: false });
    expect(parseSnapArgs([]).background).toBeUndefined();
  });

  it.each([
    [["--theme", "darK"]],
    [["--background", "lava"]],
    [["--size", "900"]],
    [["--wait", "-1"]],
    [["--wait-max", "0"]],
    [["--advance", "0"]],
    [["--advance", "x"]],
    [["--shot", "../evil"]],
    [["--shot", ""]],
    [["--shot", "screenshot"]],
    [["--click-at", "1"]],
    [["--scroll", "a,b"]],
    [["--fill", "novalue"]],
    [["--bogus"]],
  ])("rejects invalid input %j", (argv) => {
    expect(() => parseSnapArgs(argv)).toThrow(SnapUsageError);
  });
});
