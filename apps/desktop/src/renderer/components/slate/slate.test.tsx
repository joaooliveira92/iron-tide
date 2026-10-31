/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Flag, Route } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DepartmentDrawer } from "./DepartmentDrawer.js";
import { IndexTabs, type IndexTab } from "./IndexTabs.js";

afterEach(cleanup);

type Id = "orders" | "stations";

const groups: readonly (readonly IndexTab<Id>[])[] = [
  [{ id: "orders", label: "Orders", detail: "2 sealed", icon: Route, attention: true }],
  [{ id: "stations", label: "Stations", detail: "Covered", icon: Flag, attention: false }],
];

describe("IndexTabs", () => {
  it("names each tab with its live state and marks the open one expanded", () => {
    render(<IndexTabs label="Affairs" groups={groups} openId="orders" onOpen={vi.fn()} />);
    const orders = screen.getByRole("button", { name: /^Orders\s*2 sealed$/ });
    expect(orders.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("button", { name: /^Stations\s*Covered$/ }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("reports the id of the tab that was pressed", () => {
    const onOpen = vi.fn();
    render(<IndexTabs label="Affairs" groups={groups} openId={null} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /^Stations/ }));
    expect(onOpen).toHaveBeenCalledWith("stations");
  });
});

describe("DepartmentDrawer", () => {
  it("is a named non-modal dialog that takes focus and hands it back on close", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <DepartmentDrawer title="Orders" summary="Courses sealed." width="narrow" onClose={vi.fn()}>
        <p>Body</p>
      </DepartmentDrawer>,
    );
    const drawer = screen.getByRole("dialog", { name: "Orders" });
    expect(drawer.getAttribute("aria-modal")).toBe("false");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Orders" }));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("closes on Escape unless a listbox inside it handled the key", () => {
    const onClose = vi.fn();
    render(
      <DepartmentDrawer title="Orders" summary="Courses sealed." width="wide" onClose={onClose}>
        <div role="listbox" aria-label="Destinations" tabIndex={0} />
      </DepartmentDrawer>,
    );
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
