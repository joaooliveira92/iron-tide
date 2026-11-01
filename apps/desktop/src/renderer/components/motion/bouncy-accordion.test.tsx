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
    render(<BouncyAccordion items={items} defaultValue="a" collapsible={false} />);
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
});
