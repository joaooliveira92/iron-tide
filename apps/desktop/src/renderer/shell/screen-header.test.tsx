/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { FlaskConical } from "lucide-react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { HeaderSecondaryRow } from "./header/HeaderSecondaryRow.js";
import { HeaderTitle } from "./header/HeaderTitle.js";
import { ScreenHeader, ScreenHeaderProvider } from "./screen-header.js";

const CAMPAIGN = {
  month: { year: 1880, month: 1 },
  atWar: false,
  prestige: { current: 20, dismissalRisk: false },
} as never;

function Shell({ withScreen }: { readonly withScreen: boolean }) {
  return (
    <ScreenHeaderProvider>
      <HeaderTitle title="Bluewave — January 1880" />
      <HeaderSecondaryRow activeView="playing" campaign={CAMPAIGN} />
      {withScreen && (
        <ScreenHeader title="Research & Technology" icon={FlaskConical}>
          <button type="button">Set priorities</button>
        </ScreenHeader>
      )}
    </ScreenHeaderProvider>
  );
}

describe("ScreenHeader", () => {
  afterEach(cleanup);

  it("keeps the application title when no screen registers a header", () => {
    render(<Shell withScreen={false} />);

    expect(screen.getByText("Bluewave — January 1880")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Research & Technology" })).toBeNull();
  });

  it("replaces the title and hosts the toolbar in the secondary row", () => {
    render(<Shell withScreen />);

    expect(screen.getByRole("heading", { name: "Research & Technology" })).toBeTruthy();
    expect(screen.getByText("Bluewave — January 1880").className).toContain("sr-only");
    expect(screen.getByRole("button", { name: "Set priorities" })).toBeTruthy();
    expect(screen.queryByText("January 1880")).toBeNull();
    expect(screen.queryByText(/Status:/)).toBeNull();
  });

  it("restores the application title when the screen unmounts", () => {
    const { rerender } = render(<Shell withScreen />);
    rerender(<Shell withScreen={false} />);

    expect(screen.getByText("Bluewave — January 1880")).toBeTruthy();
  });

  it("renders nothing without a host so a screen still works standalone", () => {
    const { container } = render(
      <ScreenHeader title="Solo">
        <span>x</span>
      </ScreenHeader>,
    );

    expect(container.textContent).toBe("");
  });
});
