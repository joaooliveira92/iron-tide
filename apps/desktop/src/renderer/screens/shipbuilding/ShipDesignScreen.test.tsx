import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ShipDesignScreen } from "./ShipDesignScreen.js";

const mocks = vi.hoisted(() => ({
  status: "ready" as "loading" | "ready" | "error",
  projectId: null as string | null,
  clear: vi.fn(),
  loadScreen: vi.fn(async () => {}),
  workspace: vi.fn(),
}));

vi.mock("../../components/design-workspace/index.js", () => ({
  useDrawingBoardContentSource: () => mocks.status,
}));
vi.mock("../../shell/CampaignShellContext.js", () => ({
  useRevisionRequest: () => ({ projectId: mocks.projectId, clear: mocks.clear }),
}));
vi.mock("../construction/hooks/useConstructionScreen.js", () => ({
  useConstructionScreen: () => ({
    state: {
      projects: [
        { projectId: "p1", className: "Havock class" },
        { projectId: "p2", className: "Other class" },
      ],
    },
    loadScreen: mocks.loadScreen,
  }),
}));
vi.mock("./ShipbuildingWorkspace.js", () => ({
  ShipbuildingWorkspace: (props: { sessionId?: string; projects?: readonly unknown[] }) => {
    mocks.workspace(props);
    return <div data-testid="workspace" />;
  },
}));

beforeEach(() => {
  mocks.status = "ready";
  mocks.projectId = null;
  mocks.clear.mockReset();
  mocks.loadScreen.mockClear();
  mocks.workspace.mockReset();
});
afterEach(cleanup);

describe("ShipDesignScreen", () => {
  it("says it is loading while the ship-building content arrives", () => {
    mocks.status = "loading";
    render(<ShipDesignScreen sessionId="s1" />);
    expect(screen.getByRole("status").textContent).toMatch(/Loading ship-building content/);
    expect(screen.queryByTestId("workspace")).toBeNull();
  });

  it("reports a content failure as an alert instead of a blank screen", () => {
    mocks.status = "error";
    render(<ShipDesignScreen sessionId="s1" />);
    expect(screen.getByRole("alert").textContent).toMatch(/Could not load ship-building content/);
  });

  it("opens the workspace for the campaign when the content is ready", () => {
    render(<ShipDesignScreen sessionId="s1" />);
    expect(screen.getByTestId("workspace")).toBeTruthy();
    expect(mocks.workspace).toHaveBeenCalledWith({ sessionId: "s1" });
    expect(mocks.loadScreen).not.toHaveBeenCalled();
  });

  it("hands only the project being revised to the workspace, and loads the yard to find it", () => {
    mocks.projectId = "p2";
    render(<ShipDesignScreen sessionId="s1" />);
    expect(mocks.loadScreen).toHaveBeenCalled();
    expect(mocks.workspace).toHaveBeenCalledWith({
      sessionId: "s1",
      projects: [{ projectId: "p2", className: "Other class" }],
    });
  });

  it("forgets the revision request when the player leaves, so the next visit starts plain", () => {
    mocks.projectId = "p1";
    const { unmount } = render(<ShipDesignScreen sessionId="s1" />);
    expect(mocks.clear).not.toHaveBeenCalled();
    unmount();
    expect(mocks.clear).toHaveBeenCalledOnce();
  });
});
