/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  CampaignShellProvider,
  useCampaignShellActions,
  useCampaignShellContext,
} from "./CampaignShellContext.js";

function ScreenLabel() {
  const { state } = useCampaignShellContext();
  return <span data-testid="screen">{state.screen}</span>;
}

function CommandConsumer({ seen }: { readonly seen: unknown[] }) {
  const actions = useCampaignShellActions();
  seen.push(actions);
  return (
    <button type="button" onClick={() => actions.selectScreen("fleet")}>
      Visit fleet
    </button>
  );
}

function WholeContextConsumer({ seen }: { readonly seen: unknown[] }) {
  const { state, actions } = useCampaignShellContext();
  seen.push(actions);
  return (
    <>
      <button type="button" onClick={() => actions.selectScreen("fleet")}>
        Visit fleet
      </button>
      <span data-testid="whole">{`${state.screen}:${state.saving}`}</span>
    </>
  );
}

describe("shell command subscription", () => {
  it("re-renders command consumers never and state consumers once when a screen is visited", () => {
    const seen: unknown[] = [];
    render(
      <CampaignShellProvider bridge={undefined}>
        <ScreenLabel />
        <CommandConsumer seen={seen} />
      </CampaignShellProvider>,
    );
    expect(screen.getByTestId("screen").textContent).toBe("file");

    fireEvent.click(screen.getByRole("button", { name: "Visit fleet" }));

    expect(screen.getByTestId("screen").textContent).toBe("fleet");
    expect(seen).toHaveLength(1);
  });

  it("keeps the actions object identical while shell state moves", () => {
    const seen: unknown[] = [];
    render(
      <CampaignShellProvider bridge={undefined}>
        <WholeContextConsumer seen={seen} />
      </CampaignShellProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Visit fleet" }));

    expect(screen.getByTestId("whole").textContent).toBe("fleet:false");
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it("rejects an actions consumer outside the provider boundary", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<CommandConsumer seen={[]} />)).toThrow("CAMPAIGN_SHELL_ACTIONS_MISSING");
    consoleError.mockRestore();
  });
});
