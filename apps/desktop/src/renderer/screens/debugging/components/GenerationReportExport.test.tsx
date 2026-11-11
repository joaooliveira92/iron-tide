import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { GenerationReportExport } from "./GenerationReportExport.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), writeText: vi.fn() }));
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));

const report = {
  campaignSeed: "b".repeat(32),
  scaleBp: 10_000,
  nations: [{ nationId: "uk", generated: 12 }],
};

describe("GenerationReportExport", () => {
  beforeEach(() => {
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mocks.writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    mocks.execute.mockReset();
    mocks.writeText.mockReset();
  });

  it("asks the main process for this session's report and copies it as JSON", async () => {
    mocks.execute.mockResolvedValue({ outcome: "success", value: { report }, diagnostics: [] });
    render(<GenerationReportExport sessionId="session-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy generation report" }));

    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(JSON.stringify(report, null, 2));
    });
    expect(mocks.execute).toHaveBeenCalledWith("exportGenerationReport", "session-1");
    expect((await screen.findByRole("status")).textContent).toContain("Generation report copied");
  });

  it("shows the domain reason when the campaign has no report and copies nothing", async () => {
    mocks.execute.mockResolvedValue({
      outcome: "rejected",
      reason: "NO_GENERATION_REPORT",
      diagnostics: [
        "This campaign has no generation report: it started from the historical fleet.",
      ],
    });
    render(<GenerationReportExport sessionId="session-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy generation report" }));

    expect((await screen.findByRole("status")).textContent).toContain(
      "This campaign has no generation report: it started from the historical fleet.",
    );
    expect(mocks.writeText).not.toHaveBeenCalled();
  });
});
