import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useDrawingBoardContentSource } from "./useDrawingBoardContent.js";

const contentMock = vi.hoisted(() => ({ has: false, setDrawingBoardContent: vi.fn() }));
vi.mock("./content.js", () => ({
  hasDrawingBoardContent: () => contentMock.has,
  setDrawingBoardContent: contentMock.setDrawingBoardContent,
}));

function Status() {
  const status = useDrawingBoardContentSource();
  return <span data-testid="status">{status}</span>;
}

function setBridge(value: unknown): void {
  Object.defineProperty(window, "bluewave", { value, configurable: true, writable: true });
}

afterEach(() => {
  cleanup();
  contentMock.has = false;
  contentMock.setDrawingBoardContent.mockReset();
  setBridge(undefined);
});

describe("useDrawingBoardContentSource (CRI-IPC-2)", () => {
  it("fetches the decoded catalogue over IPC and injects it", async () => {
    const catalogue = { components: [], hullForms: [], referenceDesigns: [] };
    const execute = vi.fn(async () => ({
      outcome: "success",
      value: { catalogue },
      diagnostics: [],
    }));
    setBridge({ campaign: { execute } });

    const { getByTestId } = render(<Status />);
    await waitFor(() => expect(getByTestId("status").textContent).toBe("ready"));

    expect(execute).toHaveBeenCalledWith("inspectDrawingBoardContent", undefined);
    expect(contentMock.setDrawingBoardContent).toHaveBeenCalledWith({ catalogue });
  });

  it("fails closed when the content query rejects", async () => {
    const execute = vi.fn(async () => ({
      outcome: "error",
      reason: "CONTENT_ARTIFACT_MISSING",
      diagnostics: ["missing"],
    }));
    setBridge({ campaign: { execute } });

    const { getByTestId } = render(<Status />);
    await waitFor(() => expect(getByTestId("status").textContent).toBe("error"));
    expect(contentMock.setDrawingBoardContent).not.toHaveBeenCalled();
  });

  it("fails closed when there is no bridge at all", () => {
    setBridge(undefined);
    const { getByTestId } = render(<Status />);
    expect(getByTestId("status").textContent).toBe("error");
  });

  it("is ready without fetching when content was already injected", () => {
    contentMock.has = true;
    const execute = vi.fn();
    setBridge({ campaign: { execute } });

    const { getByTestId } = render(<Status />);
    expect(getByTestId("status").textContent).toBe("ready");
    expect(execute).not.toHaveBeenCalled();
  });
});
