import { describe, expect, it } from "vite-plus/test";
import {
  canRecoverRenderer,
  ERR_ABORTED,
  isActionableLoadFailure,
  MAX_RENDERER_RECOVERIES,
  shouldReloadForDevToolsHook,
} from "./shellPolicy.js";

describe("isActionableLoadFailure", () => {
  it("ignores sub-frame failures", () => {
    expect(isActionableLoadFailure(-102, false)).toBe(false);
  });

  it("ignores an aborted main-frame navigation", () => {
    expect(isActionableLoadFailure(ERR_ABORTED, true)).toBe(false);
  });

  it("accepts a real main-frame failure", () => {
    expect(isActionableLoadFailure(-102, true)).toBe(true);
  });
});

describe("canRecoverRenderer", () => {
  it("allows the first recovery and denies the next", () => {
    expect(MAX_RENDERER_RECOVERIES).toBe(1);
    expect(canRecoverRenderer(0)).toBe(true);
    expect(canRecoverRenderer(1)).toBe(false);
  });

  it("honours an explicit maximum", () => {
    expect(canRecoverRenderer(2, 3)).toBe(true);
    expect(canRecoverRenderer(3, 3)).toBe(false);
  });
});

describe("shouldReloadForDevToolsHook", () => {
  it("reloads once when no React renderer registered", () => {
    expect(shouldReloadForDevToolsHook(0, false)).toBe(true);
  });

  it("does not reload when React is already registered", () => {
    expect(shouldReloadForDevToolsHook(1, false)).toBe(false);
  });

  it("does not reload a second time", () => {
    expect(shouldReloadForDevToolsHook(0, true)).toBe(false);
  });
});
