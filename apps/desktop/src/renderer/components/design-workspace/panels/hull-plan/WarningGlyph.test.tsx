import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { WarningGlyph } from "./WarningGlyph.js";

const draw = (x: number, y: number) =>
  render(
    <svg>
      <WarningGlyph x={x} y={y} />
    </svg>,
  );

describe("WarningGlyph", () => {
  it("is a decorative triangle with a bar, invisible to assistive tech", () => {
    const { container } = draw(10, 20);
    const group = container.querySelector("[data-testid='selection-warning']")!;
    expect(group.tagName.toLowerCase()).toBe("g");
    expect(group.getAttribute("aria-hidden")).toBe("true");
    expect(group.querySelector("polygon")).not.toBeNull();
    expect(group.querySelector("line")).not.toBeNull();
  });

  it("positions the triangle and the bar at the given point", () => {
    const { container } = draw(30, 40);
    expect(container.querySelector("polygon")!.getAttribute("points")).toBe("30,34 36,44 24,44");
    const line = container.querySelector("line")!;
    expect(line.getAttribute("x1")).toBe("30");
    expect(line.getAttribute("x2")).toBe("30");
    expect(line.getAttribute("y1")).toBe("37");
    expect(line.getAttribute("y2")).toBe("41");
  });
});
