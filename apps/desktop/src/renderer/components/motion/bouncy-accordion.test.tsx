import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { BouncyAccordion, type BouncyAccordionItem } from "./bouncy-accordion.js";

const items: BouncyAccordionItem[] = [
  { id: "a", title: "Alpha", description: "Alpha body", attrs: { "data-key": "a" } },
  { id: "b", title: "Bravo", description: "Bravo body" },
  { id: "c", title: "Charlie", description: "Charlie body", disabled: true },
];

const trigger = (name: string) => screen.getByRole("button", { name });

describe("BouncyAccordion", () => {
  it("opens one row at a time and exposes its state to assistive technology", () => {
    render(<BouncyAccordion items={items} aria-label="Rows" />);
    expect(trigger("Alpha").getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger("Alpha"));
    expect(trigger("Alpha").getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger("Bravo"));
    expect(trigger("Alpha").getAttribute("aria-expanded")).toBe("false");
    expect(trigger("Bravo").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Bravo" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Alpha" })).toBeNull();
  });

  it("collapses the open row unless it is not collapsible", () => {
    const { unmount } = render(<BouncyAccordion items={items} defaultValue="a" />);
    fireEvent.click(trigger("Alpha"));
    expect(trigger("Alpha").getAttribute("aria-expanded")).toBe("false");
    unmount();
    render(<BouncyAccordion items={items} defaultValue="a" collapse="blocked" />);
    fireEvent.click(trigger("Alpha"));
    expect(trigger("Alpha").getAttribute("aria-expanded")).toBe("true");
  });

  it("reports changes, honours disabled rows and carries item attributes", () => {
    const onValueChange = vi.fn();
    const { container } = render(<BouncyAccordion items={items} onValueChange={onValueChange} />);
    fireEvent.click(trigger("Bravo"));
    expect(onValueChange).toHaveBeenLastCalledWith("b");
    expect((trigger("Charlie") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-key="a"]')?.contains(trigger("Alpha"))).toBe(true);
  });

  it("follows a controlled value and ignores clicks until the parent updates it", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <BouncyAccordion items={items} value="a" onValueChange={onValueChange} />,
    );
    fireEvent.click(trigger("Bravo"));
    expect(onValueChange).toHaveBeenLastCalledWith("b");
    expect(trigger("Alpha").getAttribute("aria-expanded")).toBe("true");
    expect(trigger("Bravo").getAttribute("aria-expanded")).toBe("false");

    rerender(<BouncyAccordion items={items} value="b" onValueChange={onValueChange} />);
    expect(trigger("Alpha").getAttribute("aria-expanded")).toBe("false");
    expect(trigger("Bravo").getAttribute("aria-expanded")).toBe("true");
  });

  it("reports a collapse as null and keeps closed rows out of the accessibility tree", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <BouncyAccordion items={items} defaultValue="a" onValueChange={onValueChange} />,
    );
    const closed = container.querySelector(`#${trigger("Bravo").getAttribute("aria-controls")}`);
    expect(closed?.getAttribute("aria-hidden")).toBe("true");
    expect(closed?.hasAttribute("inert")).toBe(true);

    fireEvent.click(trigger("Alpha"));
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("does not report a change when a non-collapsible open row is clicked", () => {
    const onValueChange = vi.fn();
    render(
      <BouncyAccordion
        items={items}
        defaultValue="a"
        collapse="blocked"
        onValueChange={onValueChange}
      />,
    );
    fireEvent.click(trigger("Alpha"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("does not open a disabled row", () => {
    render(<BouncyAccordion items={items} />);
    fireEvent.click(trigger("Charlie"));
    expect(trigger("Charlie").getAttribute("aria-expanded")).toBe("false");
  });
});
