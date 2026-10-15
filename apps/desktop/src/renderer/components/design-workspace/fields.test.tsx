import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { NumberField, normalizeDecimalMark } from "./fields.js";

afterEach(cleanup);

describe("normalizeDecimalMark", () => {
  it("rewrites a lone comma used as a decimal mark and leaves anything else untouched", () => {
    expect(normalizeDecimalMark("16,5")).toBe("16.5");
    expect(normalizeDecimalMark(",5")).toBe(".5");
    expect(normalizeDecimalMark("16.5")).toBe("16.5");
    expect(normalizeDecimalMark("1,500")).toBe("1.500");
    expect(normalizeDecimalMark("1,500.0")).toBe("1,500.0");
    expect(normalizeDecimalMark("1.500,0")).toBe("1.500,0");
    expect(normalizeDecimalMark("12")).toBe("12");
  });
});

/** A stateful host, so the field's controlled value round-trips through `onCommit` as it does in the app. */
function Host({
  initial,
  scale,
  decimals,
  min,
  max,
  recommended,
}: {
  readonly initial: number;
  readonly scale?: number;
  readonly decimals?: number;
  readonly min?: number;
  readonly max?: number;
  readonly recommended?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      label="Top speed"
      unit="kn"
      value={value}
      scale={scale}
      decimals={decimals}
      min={min}
      max={max}
      recommended={recommended}
      onCommit={setValue}
    />
  );
}

describe("NumberField", () => {
  it("always shows a decimal point, whatever the system locale, and commits internal units", () => {
    render(<Host initial={16_000} scale={1000} decimals={1} />);
    const input = screen.getByLabelText("Top speed (kn)") as HTMLInputElement;
    expect(input.value).toBe("16.0");
    fireEvent.change(input, { target: { value: "17,5" } });
    fireEvent.blur(input);
    expect(input.value).toBe("17.5");
  });

  it("steps with the arrow keys within min and max", () => {
    render(<Host initial={2} min={1} max={3} />);
    const input = screen.getByLabelText("Top speed (kn)") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("3");
    fireEvent.keyDown(input, { key: "ArrowUp" }); // no further than max
    expect(input.value).toBe("3");
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);
    expect(input.value).toBe("3"); // clamped to max
  });

  it("offers a reset to the recommended value, and only when the value differs from it", () => {
    render(<Host initial={17_000} scale={1000} decimals={1} recommended={16_000} />);
    const reset = screen.getByRole("button", { name: "Reset Top speed to recommended" });
    fireEvent.click(reset);
    expect((screen.getByLabelText("Top speed (kn)") as HTMLInputElement).value).toBe("16.0");
    // At the recommended value there is nothing to reset.
    expect(screen.queryByRole("button", { name: "Reset Top speed to recommended" })).toBeNull();
  });

  it("ignores the mouse wheel while the field is unfocused", () => {
    render(<Host initial={2} min={1} max={5} />);
    const input = screen.getByLabelText("Top speed (kn)") as HTMLInputElement;
    fireEvent.wheel(input, { deltaY: -1 });
    expect(input.value).toBe("2");
  });
});
