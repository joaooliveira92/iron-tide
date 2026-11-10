/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group.js";

afterEach(cleanup);

function Harness({
  onValueChange,
  size,
  variant,
}: {
  readonly onValueChange?: (value: readonly string[]) => void;
  readonly size?: "default" | "sm" | "lg";
  readonly variant?: "default" | "outline";
}) {
  const [value, setValue] = useState<readonly string[]>(["all"]);
  return (
    <ToggleGroup
      aria-label="Outcome"
      size={size}
      variant={variant}
      value={[...value]}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    >
      <ToggleGroupItem value="all" aria-label="All outcomes">
        All
      </ToggleGroupItem>
      <ToggleGroupItem value="success" aria-label="Successful only">
        OK
      </ToggleGroupItem>
      <ToggleGroupItem value="rejected" aria-label="Rejected only">
        Rejected
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

describe("ToggleGroup", () => {
  it("exposes a labelled group of toggle buttons with their pressed state", () => {
    render(<Harness />);

    expect(screen.getByRole("group", { name: "Outcome" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All outcomes" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Successful only" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("presses an item on click and reports the new value", () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Rejected only" }));

    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange.mock.calls.at(-1)?.[0]).toContain("rejected");
  });

  it("presses a focusable item", () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    const item = screen.getByRole("button", { name: "Successful only" });

    item.focus();
    expect(document.activeElement).toBe(item);
    fireEvent.click(item);

    expect(onValueChange.mock.calls.at(-1)?.[0]).toContain("success");
  });

  it("moves focus between items with the arrow keys", async () => {
    render(<Harness />);
    const first = screen.getByRole("button", { name: "All outcomes" });
    const second = screen.getByRole("button", { name: "Successful only" });

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    await waitFor(() => expect(document.activeElement).toBe(second));
  });

  it("styles each item from the group's variant and size", () => {
    render(<Harness size="sm" variant="outline" />);
    const item = screen.getByRole("button", { name: "All outcomes" });

    expect(item.className).toContain("border");
    expect(item.className).toContain("data-pressed:bg-background");
  });

  it("falls back to an item's own size when the group sets none", () => {
    render(
      <ToggleGroup aria-label="Own">
        <ToggleGroupItem value="a" size="lg" aria-label="A">
          A
        </ToggleGroupItem>
      </ToggleGroup>,
    );

    expect(screen.getByRole("button", { name: "A" }).className).toContain("h-");
  });

  it("exposes Root and Item statics that match the named exports", () => {
    expect(ToggleGroup.Root).toBe(ToggleGroup);
    expect(ToggleGroup.Item).toBe(ToggleGroupItem);
  });

  it("forwards a ref to the group element", () => {
    let node: HTMLDivElement | null = null;
    render(
      <ToggleGroup
        aria-label="Ref"
        ref={(value) => {
          node = value;
        }}
      >
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>,
    );

    expect((node as HTMLDivElement | null)?.getAttribute("role")).toBe("group");
  });
});
