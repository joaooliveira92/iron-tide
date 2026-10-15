import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { FittingSymbol } from "./FittingSymbol.js";
import type { FittingKind } from "./sections.js";

const draw = (kind: FittingKind) =>
  render(
    <svg>
      <FittingSymbol kind={kind} x={100} y={50} hatch="url(#h)" />
    </svg>,
  );

describe("FittingSymbol", () => {
  it("a gun is a target ring: an outer circle and a filled pip at the point", () => {
    const { container } = draw("gun");
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    expect(circles[0]!.getAttribute("cx")).toBe("100");
    expect(circles[0]!.getAttribute("cy")).toBe("50");
    expect(Number(circles[0]!.getAttribute("r"))).toBeGreaterThan(
      Number(circles[1]!.getAttribute("r")),
    );
  });

  it("a torpedo is a horizontal capsule centred on the point", () => {
    const { container } = draw("torpedo");
    const rect = container.querySelector("rect")!;
    expect(Number(rect.getAttribute("x"))).toBe(92);
    expect(Number(rect.getAttribute("width"))).toBe(16);
    expect(Number(rect.getAttribute("height"))).toBe(5);
  });

  it("a magazine is a hatched rectangle that uses the given hatch fill", () => {
    const { container } = draw("magazine");
    const rect = container.querySelector("rect")!;
    expect(rect.getAttribute("fill")).toBe("url(#h)");
  });

  it("machinery is a muted rectangle", () => {
    const { container } = draw("machinery");
    expect(container.querySelector("rect")!.getAttribute("class")).toContain("fill-muted");
  });

  it("a funnel is a single small dot (its shape is drawn in the profile)", () => {
    const { container } = draw("funnel");
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(1);
    expect(circles[0]!.getAttribute("r")).toBe("2.5");
  });

  it("anything else is a diamond polygon around the point", () => {
    const { container } = draw("other");
    const polygon = container.querySelector("polygon")!;
    expect(polygon.getAttribute("points")).toBe("100,45 105,50 100,55 95,50");
  });
});
