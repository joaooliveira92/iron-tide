import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { NameGroup } from "../class-name-suggestions.js";
import { ClassNameBrowser } from "./ClassNameBrowser.js";

afterEach(cleanup);

const groups: readonly NameGroup[] = [
  { type: "DD", label: "DD · Destroyer", names: ["Havock", "Hornet"], current: true },
  { type: "B", label: "B · Battleship", names: ["Devastation"], current: false },
];

describe("ClassNameBrowser", () => {
  it("has a tab per ship type with its name count, opening on the design's own type", () => {
    render(<ClassNameBrowser groups={groups} current="" onPick={() => {}} />);
    expect(screen.getByRole("tab", { name: /DD · Destroyer/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: /B · Battleship/ })).toBeTruthy();
    expect(screen.getByText("This design's type")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Havock" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Devastation" })).toBeNull();
  });

  it("shows another type's names when its tab is chosen", () => {
    render(<ClassNameBrowser groups={groups} current="" onPick={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /B · Battleship/ }));
    expect(screen.getByRole("button", { name: "Devastation" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Havock" })).toBeNull();
  });

  it("hands the chosen name to the host", () => {
    const onPick = vi.fn<(name: string) => void>();
    render(<ClassNameBrowser groups={groups} current="" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Hornet" }));
    expect(onPick).toHaveBeenCalledWith("Hornet");
  });

  it("shows the name now in the field as pressed", () => {
    render(<ClassNameBrowser groups={groups} current=" Havock " onPick={() => {}} />);
    expect(screen.getByRole("button", { name: "Havock" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Hornet" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("filters, dropping tabs with no match, and says when nothing matches", () => {
    render(<ClassNameBrowser groups={groups} current="" onPick={() => {}} />);
    fireEvent.change(screen.getByLabelText("Filter names"), { target: { value: "dev" } });
    expect(screen.queryByRole("tab", { name: /DD · Destroyer/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Devastation" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filter names"), { target: { value: "zzz" } });
    expect(screen.getByRole("status").textContent).toMatch(/No name matches/);
  });

  it("says so when the nation has no authored names", () => {
    render(<ClassNameBrowser groups={[]} current="" onPick={() => {}} />);
    expect(screen.getByRole("status").textContent).toMatch(/no authored names/);
  });
});
