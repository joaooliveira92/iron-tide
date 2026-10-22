/* @vitest-environment jsdom */
import { FlaskConical } from "lucide-react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ScreenLoadErrorState, ScreenLoadingState } from "./ScreenLoadStates.js";

afterEach(cleanup);

const header = {
  guidedTarget: "unit",
  icon: FlaskConical,
  title: "Research & Technology",
  description: "Direct the monthly research budget across fields.",
} as const;

describe("ScreenLoadErrorState", () => {
  it("renders the frame, error title, verbatim message and a working Retry", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <ScreenLoadErrorState
        {...header}
        errorTitle="Research screen failed to load"
        message="TRANSPORT_FAILURE: boom"
        onRetry={onRetry}
      />,
    );

    expect(container.querySelector('[data-guided-target="unit"]')).not.toBeNull();
    expect(screen.getByText("Research & Technology")).not.toBeNull();
    expect(screen.getByText("Research screen failed to load")).not.toBeNull();
    expect(screen.getByText("TRANSPORT_FAILURE: boom")).not.toBeNull();

    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("ScreenLoadingState", () => {
  it("renders the frame with a skeleton grid", () => {
    const { container } = render(<ScreenLoadingState {...header} />);

    expect(container.querySelector('[data-guided-target="unit"]')).not.toBeNull();
    expect(screen.getByText("Research & Technology")).not.toBeNull();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });
});
