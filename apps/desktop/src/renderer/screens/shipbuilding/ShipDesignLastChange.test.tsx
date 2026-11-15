import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

afterEach(cleanup);

const commands = () => screen.getByRole("group", { name: "Design commands" });
const sections = () => screen.getByRole("navigation", { name: "Design sections" });
const strip = () => screen.queryByTestId("last-change-strip");
const region = () => screen.getByTestId("last-change-region");
const openMap = (name: string) => {
  const button = within(sections()).getByRole("button", { name: new RegExp(`^${name}`) });
  if (button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
};
const commit = (label: RegExp, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const editHull = () => {
  openMap("Hull");
  commit(/^Length \(waterline\)/, "120");
};

describe("last change strip in the design workspace", () => {
  it("offers an empty polite live region before any edit", () => {
    render(<ShipbuildingWorkspace />);
    expect(region().getAttribute("role")).toBe("status");
    expect(region().getAttribute("aria-live")).toBe("polite");
    expect(strip()).toBeNull();
  });

  it("names the edit and lists toned deltas that carry an arrow icon and a word, not colour alone", () => {
    render(<ShipbuildingWorkspace />);
    editHull();
    const last = within(region()).getByTestId("last-change-strip");
    expect(within(last).getByTestId("last-change-label").textContent).toMatch(
      /^Length \(waterline\) from .* to /,
    );
    const items = last.querySelectorAll<HTMLElement>("li[data-aspect]");
    expect(items.length).toBeGreaterThan(0);
    const toned = [...items].filter((item) => item.dataset["tone"] !== "neutral");
    expect(toned.length).toBeGreaterThan(0);
    for (const item of items) {
      const button = within(item).getByRole("button");
      expect(button.getAttribute("aria-label")).toMatch(/\. Open \w+/);
      expect(button.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    }
    for (const item of toned) {
      const button = within(item).getByRole("button");
      expect(button.textContent).toContain(item.dataset["tone"]);
      expect(button.getAttribute("aria-label")).toContain(`, ${item.dataset["tone"]}.`);
    }
  });

  it("shows the reversal on undo and replaces it on the next edit", () => {
    render(<ShipbuildingWorkspace />);
    editHull();
    const made = screen.getByTestId("last-change-label").textContent;
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect(screen.getByTestId("last-change-strip").dataset["kind"]).toBe("undo");
    expect(screen.getByTestId("last-change-label").textContent).toBe(`Undid: ${made}`);
    fireEvent.click(within(commands()).getByRole("button", { name: "Redo" }));
    expect(screen.getByTestId("last-change-label").textContent).toBe(`Redid: ${made}`);
    commit(/^Length \(waterline\)/, "110");
    expect(screen.getByTestId("last-change-strip").dataset["kind"]).toBe("edit");
  });

  it("opens the owning section from a delta, keeps the strip and moves focus to that section", () => {
    render(<ShipbuildingWorkspace />);
    editHull();
    const target = region().querySelector<HTMLElement>("li[data-aspect='speed'] button");
    expect(target).not.toBeNull();
    target!.focus();
    fireEvent.click(target!);
    expect(within(screen.getByTestId("design-drawer")).getByRole("tablist")).toBeTruthy();
    expect(screen.getByLabelText(/^Installed power/)).toBeTruthy();
    expect(strip()).not.toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.textContent).toBe("Machinery");
  });

  it("clears after a strip navigation once the player navigates from elsewhere", () => {
    render(<ShipbuildingWorkspace />);
    editHull();
    fireEvent.click(region().querySelector<HTMLElement>("li[data-aspect='speed'] button")!);
    expect(strip()).not.toBeNull();
    openMap("Armament");
    expect(strip()).toBeNull();
  });

  it("replaces the strip on the next edit after a strip navigation", () => {
    render(<ShipbuildingWorkspace />);
    editHull();
    const before = screen.getByTestId("last-change-label").textContent;
    fireEvent.click(region().querySelector<HTMLElement>("li[data-aspect='speed'] button")!);
    commit(/^Installed power/, "1000");
    expect(screen.getByTestId("last-change-label").textContent).not.toBe(before);
  });

  it("clears when another section is opened, and can be dismissed", () => {
    render(<ShipbuildingWorkspace />);
    editHull();
    expect(strip()).not.toBeNull();
    openMap("Machinery");
    expect(strip()).toBeNull();
    commit(/^Installed power/, "1000");
    expect(strip()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss last change" }));
    expect(strip()).toBeNull();
  });
});
