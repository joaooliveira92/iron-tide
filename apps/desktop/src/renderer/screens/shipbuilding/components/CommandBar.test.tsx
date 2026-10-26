import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CommandBar, type CommandBarProps } from "./CommandBar.js";

afterEach(cleanup);

const props = (over: Partial<CommandBarProps> = {}): CommandBarProps => ({
  shipClassName: "",
  onShipClassName: () => {},
  onStartFromReference: () => {},
  shipType: "DD",
  shipTypeLabel: "DD · Torpedo boat",
  shipTypeIcon: null,
  canUndo: false,
  canRedo: false,
  onUndo: () => {},
  onRedo: () => {},
  compare: null,
  autosaved: false,
  onValidate: () => {},
  onFinish: () => {},
  overflow: [{ label: "Design", items: [{ label: "Edit history…", onSelect: () => {} }] }],
  ...over,
});

const bar = () => screen.getByRole("group", { name: "Design commands" });

describe("CommandBar", () => {
  it("keeps the current type on the reference button and opens the browser from it", () => {
    const onStartFromReference = vi.fn();
    render(<CommandBar {...props({ onStartFromReference })} />);
    const button = within(bar()).getByRole("button", { name: /Start from a reference design/ });
    expect(button.getAttribute("aria-description")).toContain("DD · Torpedo boat");
    expect(within(button).getByLabelText("Current type DD")).toBeTruthy();
    fireEvent.click(button);
    expect(onStartFromReference).toHaveBeenCalledOnce();
  });

  it("shows Autosaved only when the design autosaves, and never a save button", () => {
    const { rerender } = render(<CommandBar {...props()} />);
    expect(within(bar()).queryByText("Autosaved")).toBeNull();
    rerender(<CommandBar {...props({ autosaved: true })} />);
    expect(within(bar()).getByText("Autosaved")).toBeTruthy();
    expect(within(bar()).queryByRole("button", { name: /Save/ })).toBeNull();
  });

  it("exposes the class name input to the host through nameInputRef", () => {
    const ref = createRef<HTMLInputElement>();
    render(<CommandBar {...props({ nameInputRef: ref })} />);
    expect(ref.current).toBe(within(bar()).getByLabelText("Class name"));
  });

  it("fires Validate and Finish", () => {
    const onValidate = vi.fn();
    const onFinish = vi.fn();
    render(<CommandBar {...props({ onValidate, onFinish })} />);
    fireEvent.click(within(bar()).getByRole("button", { name: /Validate/ }));
    fireEvent.click(within(bar()).getByRole("button", { name: /Finish design/ }));
    expect(onValidate).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
