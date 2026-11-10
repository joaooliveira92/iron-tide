/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "./number-field.js";

afterEach(cleanup);

function Harness({
  size,
  min,
  max,
  step,
  onValueChange,
}: {
  readonly size?: "sm" | "default" | "lg";
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly onValueChange?: (value: number | null) => void;
}) {
  const [value, setValue] = useState<number | null>(5);
  return (
    <NumberField
      value={value}
      min={min}
      max={max}
      step={step}
      size={size}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    >
      <NumberFieldScrubArea label="Speed" />
      <NumberFieldGroup>
        <NumberFieldDecrement aria-label="Decrease" />
        <NumberFieldInput aria-label="Speed value" />
        <NumberFieldIncrement aria-label="Increase" />
      </NumberFieldGroup>
    </NumberField>
  );
}

function input(): HTMLInputElement {
  return screen.getByRole("textbox", { name: "Speed value" });
}

describe("NumberField", () => {
  it("exposes the value through a named text input", () => {
    render(<Harness />);

    expect(input().value).toBe("5");
    expect(input().getAttribute("inputmode")).toBe("numeric");
  });

  it("steps with the increment and decrement buttons", () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(input().value).toBe("6");

    fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
    expect(input().value).toBe("4");
    expect(onValueChange).toHaveBeenLastCalledWith(4);
  });

  it("steps with ArrowUp and ArrowDown on the input and honours the step", () => {
    render(<Harness step={2} />);

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().value).toBe("7");

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().value).toBe("3");
  });

  it("jumps to the bounds with Home and End", () => {
    render(<Harness min={0} max={10} />);

    fireEvent.keyDown(input(), { key: "Home" });
    expect(input().value).toBe("0");

    fireEvent.keyDown(input(), { key: "End" });
    expect(input().value).toBe("10");
  });

  it("disables a button at its bound", () => {
    render(<Harness min={5} max={5} />);

    expect(screen.getByRole("button", { name: "Increase" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Decrease" }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps the stepper glyphs decorative", () => {
    render(
      <NumberField defaultValue={1}>
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label="Decrease" />
          <NumberFieldInput aria-label="Value" />
          <NumberFieldIncrement aria-label="Increase" />
        </NumberFieldGroup>
      </NumberField>,
    );

    for (const name of ["Decrease", "Increase"]) {
      const icon = screen.getByRole("button", { name }).querySelector("svg");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("labels the scrub area with a label bound to the input", () => {
    render(<Harness />);
    const label = screen.getByText("Speed");

    expect(label.tagName).toBe("LABEL");
    expect(label.getAttribute("for")).toBe(input().id);
  });

  it("marks every part with its slot and the shared size", () => {
    const { container } = render(<Harness size="lg" />);

    expect(container.querySelector("[data-slot=number-field]")?.getAttribute("data-size")).toBe(
      "lg",
    );
    expect(container.querySelector("[data-slot=number-field-group]")?.className).toContain("h-9");
    expect(input().className).toContain("py-1.5");
    expect(screen.getByRole("button", { name: "Increase" }).className).toContain("px-2.5");
    expect(container.querySelector("[data-slot=number-field-decrement]")).not.toBeNull();
    expect(container.querySelector("[data-slot=number-field-increment]")).not.toBeNull();
    expect(container.querySelector("[data-slot=number-field-scrub-area]")).not.toBeNull();
  });

  it("lets a part override the size inherited from the root", () => {
    render(
      <NumberField size="lg" defaultValue={1}>
        <NumberFieldGroup size="sm">
          <NumberFieldInput aria-label="Value" size="sm" />
        </NumberFieldGroup>
      </NumberField>,
    );

    expect(screen.getByRole("textbox", { name: "Value" }).className).toContain("py-0.5");
  });

  it("uses a supplied id for the input and the scrub label", () => {
    render(
      <NumberField id="fleet-speed" defaultValue={1}>
        <NumberFieldScrubArea label="Speed" />
        <NumberFieldGroup>
          <NumberFieldInput aria-label="Speed value" />
        </NumberFieldGroup>
      </NumberField>,
    );

    expect(screen.getByText("Speed").getAttribute("for")).toBe("fleet-speed");
  });

  it.each([
    ["NumberFieldGroup", <NumberFieldGroup key="g" />],
    ["NumberFieldDecrement", <NumberFieldDecrement key="d" />],
    ["NumberFieldIncrement", <NumberFieldIncrement key="i" />],
    ["NumberFieldInput", <NumberFieldInput key="n" />],
    ["NumberFieldScrubArea", <NumberFieldScrubArea key="s" label="x" />],
  ])("%s throws outside a NumberField", (name, node) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(node)).toThrow(`${name} must be used within a NumberField component`);
    error.mockRestore();
  });
});
