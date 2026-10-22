import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  installRendererCrashHandlers,
  reportRendererError,
  reportRendererRejection,
  type CrashListenerTarget,
} from "./crash-report.js";

type Payload = { kind: "window-error" | "unhandledrejection"; message: string; stack?: string };

const recorder = () => {
  const reports: Payload[] = [];
  return { reports, bridge: { reportCrash: (report: Payload) => reports.push(report) } };
};

afterEach(() => vi.restoreAllMocks());

describe("renderer crash capture (ADR-0133)", () => {
  it("forwards a window error to the bridge and still logs it", () => {
    const { reports, bridge } = recorder();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const error = new Error("boom");
    reportRendererError(error, "boom", bridge);

    expect(reports).toEqual([{ kind: "window-error", message: "boom", stack: error.stack }]);
    expect(logged).toHaveBeenCalled();
  });

  it("forwards an unhandled rejection", () => {
    const { reports, bridge } = recorder();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const reason = new Error("rejected");
    reportRendererRejection(reason, bridge);

    expect(reports).toEqual([
      { kind: "unhandledrejection", message: "rejected", stack: reason.stack },
    ]);
  });

  it("falls back to the event message when no Error object is attached", () => {
    const { reports, bridge } = recorder();
    vi.spyOn(console, "error").mockImplementation(() => {});

    reportRendererError(undefined, "script error", bridge);

    expect(reports).toEqual([{ kind: "window-error", message: "script error" }]);
  });

  it("does not throw without a bridge (tests, embedding)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportRendererRejection("x", undefined)).not.toThrow();
  });

  it("installs a listener for both error and unhandledrejection", () => {
    const types: string[] = [];
    const target: CrashListenerTarget = {
      addEventListener: (type) => {
        types.push(type);
      },
    };
    installRendererCrashHandlers(undefined, target);
    expect(types).toEqual(["error", "unhandledrejection"]);
  });
});
