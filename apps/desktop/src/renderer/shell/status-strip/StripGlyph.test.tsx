/* @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { StripGlyph } from "./StripGlyph.js";

describe("StripGlyph", () => {
  afterEach(cleanup);

  it("draws a meter at the clamped fraction with an optional mark", () => {
    const { container } = render(
      <StripGlyph variant="meter" fraction={0.42} fill="bg-admiralty-accent" mark={0.8} />,
    );
    const [fill, mark] = Array.from(container.querySelectorAll<HTMLElement>("span > span"));
    expect(fill?.style.width).toBe("42%");
    expect(mark?.style.left).toBe("80%");
  });

  it("fills the requested number of pips out of the total", () => {
    const { container } = render(
      <StripGlyph variant="pips" filled={3} total={6} fill="bg-admiralty-signal" />,
    );
    const pips = container.querySelectorAll("span > span");
    expect(pips).toHaveLength(6);
    expect(container.querySelectorAll(".bg-admiralty-signal")).toHaveLength(3);
  });

  it("draws one histogram bar per fraction", () => {
    const { container } = render(<StripGlyph variant="histogram" fractions={[0.2, 0.5, 0]} />);
    expect(container.querySelectorAll("span > span")).toHaveLength(3);
  });

  it("draws a line glyph with a polyline", () => {
    const { container } = render(<StripGlyph variant="line" values={[1, 3, 2]} tone="normal" />);
    expect(container.querySelector("svg polyline")).not.toBeNull();
  });

  it("wraps ring content in the glyph label", () => {
    const { getByText } = render(
      <StripGlyph variant="ring" fraction={0.5} tone="text-warning">
        50%
      </StripGlyph>,
    );
    expect(getByText("50%")).toBeTruthy();
  });

  it("skips zero-size stack segments", () => {
    const { container } = render(
      <StripGlyph
        variant="stack"
        segments={[
          { id: "maintenance", fraction: 0.4 },
          { id: "research", fraction: 0 },
          { id: "obligations", fraction: 0.2 },
        ]}
      />,
    );
    expect(container.querySelectorAll("span > span")).toHaveLength(2);
  });
});
