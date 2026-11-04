/* @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import type { TrendSeries } from "../status-strip-trend.js";
import { StripTrend } from "./StripTrend.js";

const SERIES: TrendSeries = {
  values: [10, 12, 9, 14],
  labels: ["January", "February", "March", "April"],
  current: "1,000 NC",
  delta: "+14 NC",
  direction: "up",
};

describe("StripTrend", () => {
  afterEach(cleanup);

  it("renders a delta with an arrow, the amount and a spoken direction", () => {
    const { container, getByText } = render(<StripTrend variant="delta" series={SERIES} />);
    expect(container.querySelector("[data-trend-delta='up']")).not.toBeNull();
    expect(getByText("+14 NC")).toBeTruthy();
    expect(getByText(/up on March/)).toBeTruthy();
  });

  it("renders nothing for a delta without a comparison month", () => {
    const { container } = render(
      <StripTrend variant="delta" series={{ ...SERIES, delta: null, direction: null }} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("describes the sparkline as an image with its range and latest value", () => {
    const { getByRole } = render(<StripTrend variant="spark" series={SERIES} title="Treasury" />);
    const image = getByRole("img", { name: /Treasury: 4 points from January to April/ });
    expect(image.getAttribute("data-spark")).toBe("Treasury");
    expect(image.getAttribute("aria-label")).toContain("latest 1,000 NC");
  });

  it("draws a zero line only when the series crosses zero", () => {
    const { container, rerender } = render(
      <StripTrend variant="spark" series={SERIES} title="Net" baseline="zero" />,
    );
    expect(container.querySelector("line[stroke-dasharray='2 3']")).toBeNull();

    rerender(
      <StripTrend
        variant="spark"
        series={{ ...SERIES, values: [-4, 2, -1, 3] }}
        title="Net"
        baseline="zero"
      />,
    );
    expect(container.querySelector("line[stroke-dasharray='2 3']")).not.toBeNull();
  });

  it("shows a projected endpoint when given one", () => {
    const { getByText, container } = render(
      <StripTrend variant="spark" series={SERIES} title="Treasury" projected={1400} />,
    );
    expect(getByText("projected")).toBeTruthy();
    expect(container.querySelector("line[stroke-dasharray='3 3']")).not.toBeNull();
  });
});
