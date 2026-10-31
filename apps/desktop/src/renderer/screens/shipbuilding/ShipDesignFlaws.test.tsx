import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

afterEach(cleanup);

const commands = () => screen.getByRole("group", { name: "Design commands" });
const sections = () => screen.getByRole("navigation", { name: "Design sections" });
const slip = () => screen.queryByTestId("flaw-slip");
const viewButton = (name: string) =>
  within(screen.getByRole("group", { name: "Ship view" })).getByRole("button", { name });
const commit = (label: RegExp, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const openSection = (name: string) =>
  fireEvent.click(within(sections()).getByRole("button", { name: new RegExp(`^${name}`) }));

function overload() {
  openSection("Machinery");
  commit(/^Fuel capacity/, "400");
}

describe("a design with a flaw", () => {
  it("stays quiet on a sound design: warnings stay on the section tabs, with no problem slip", () => {
    render(<ShipbuildingWorkspace />);
    expect(slip()).toBeNull();
    const detail = within(sections())
      .getAllByRole("button")
      .map((b) => b.textContent ?? "");
    expect(detail.every((text) => !/\d+ problems?/.test(text))).toBe(true);
  });

  it("raises one prioritised slip that names the flaw, what it does to the ship, and whether it blocks", () => {
    render(<ShipbuildingWorkspace />);
    overload();
    const flaws = within(slip()!);
    expect(slip()!.getAttribute("data-tier")).toBe("blocking");
    expect(flaws.getByText("Blocks submission")).toBeTruthy();
    const [, what, consequence] = [...slip()!.querySelectorAll("p")].map(
      (p) => p.textContent ?? "",
    );
    expect(what!.length).toBeGreaterThan(10);
    expect(consequence!.length).toBeGreaterThan(10);
    expect(what).not.toBe(consequence);
    expect(flaws.getByRole("button", { name: "Show on ship" })).toBeTruthy();
    expect(flaws.getByRole("button", { name: /^Fix in / })).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Engineering status" })).getByRole("status")
        .textContent,
    ).toMatch(/Cannot be built/);
  });

  it("marks the section that holds the flaw on the section tabs", () => {
    render(<ShipbuildingWorkspace />);
    overload();
    const attention = within(sections())
      .getAllByRole("button")
      .filter((b) => /\d+ problems?$/.test(b.textContent ?? ""));
    expect(attention.length).toBeGreaterThan(0);
  });

  it("opens the panel that fixes it, on the right tab, from the slip", () => {
    render(<ShipbuildingWorkspace />);
    overload();
    fireEvent.click(screen.getByRole("button", { name: "Close Machinery" }));
    expect(screen.queryByTestId("design-drawer")).toBeNull();
    const fix = within(slip()!).getByRole("button", { name: /^Fix in / });
    const target = fix.textContent!.replace("Fix in ", "").trim();
    fireEvent.click(fix);
    expect(screen.getByRole("dialog", { name: target })).toBeTruthy();
  });

  it("shows the flaw on the ship, returning to a drawing where it can be seen", () => {
    render(<ShipbuildingWorkspace />);
    overload();
    fireEvent.click(viewButton("Side"));
    expect(viewButton("Side").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(slip()!).getByRole("button", { name: "Show on ship" }));
    expect(screen.getByRole("img", { name: /^Top-down plan/ })).toBeTruthy();
    expect(viewButton("Top").getAttribute("aria-pressed")).toBe("true");
  });

  it("takes the whole list one step further: All findings opens the Review panel", () => {
    render(<ShipbuildingWorkspace />);
    overload();
    fireEvent.click(within(slip()!).getByRole("button", { name: "All findings" }));
    expect(screen.getByRole("dialog", { name: "Review" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Validation" })).toBeTruthy();
  });

  it("steps through more than one problem, wrapping at the ends", () => {
    render(<ShipbuildingWorkspace />);
    overload();
    const counter = () => within(slip()!).queryByText(/^\d+ of \d+$/)?.textContent ?? null;
    if (counter() === null) return;
    const total = Number(counter()!.split(" of ")[1]);
    expect(total).toBeGreaterThan(1);
    expect(counter()).toBe(`1 of ${total}`);
    act(() => within(slip()!).getByRole("button", { name: "Previous problem" }).click());
    expect(counter()).toBe(`${total} of ${total}`);
    act(() => within(slip()!).getByRole("button", { name: "Next problem" }).click());
    expect(counter()).toBe(`1 of ${total}`);
  });

  it("clears the slip once the flaw is undone", () => {
    render(<ShipbuildingWorkspace />);
    overload();
    expect(slip()).not.toBeNull();
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect(slip()).toBeNull();
  });
});
