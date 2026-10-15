import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DeferredFeaturesPanel } from "./DeferredFeaturesPanel.js";

describe("DeferredFeaturesPanel", () => {
  afterEach(cleanup);

  it("shows each item with its reason, a default title, and nothing interactive", () => {
    const { container } = render(
      <DeferredFeaturesPanel
        testId="x"
        items={[
          { id: "a", name: "Alpha", reason: "Because alpha." },
          { id: "b", name: "Beta", reason: "Because beta." },
        ]}
      />,
    );
    expect(screen.getByText("Not yet modelled by the engine")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText(/Because beta\./)).toBeTruthy();
    expect(container.querySelectorAll("button, input, select, a")).toHaveLength(0);
  });

  it("accepts a custom title", () => {
    render(<DeferredFeaturesPanel testId="y" title="Intelligence — deferred" items={[]} />);
    expect(screen.getByText("Intelligence — deferred")).toBeTruthy();
  });
});
