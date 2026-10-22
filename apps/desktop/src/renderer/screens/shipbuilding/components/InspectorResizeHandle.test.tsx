import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InspectorResizeHandle } from "./InspectorResizeHandle.js";

afterEach(cleanup);

const handle = () => screen.getByRole("separator", { name: "Resize inspector" });

describe("InspectorResizeHandle", () => {
  it("nudges, jumps and restores the width from the keyboard", () => {
    const onChange = vi.fn();
    render(<InspectorResizeHandle widthPx={440} onChange={onChange} controls="inspector" />);
    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(456);
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(424);
    fireEvent.keyDown(handle(), { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(360);
    fireEvent.keyDown(handle(), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(560);
    fireEvent.keyDown(handle(), { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(440);
  });

  it("ignores keys it does not act on", () => {
    const onChange = vi.fn();
    render(<InspectorResizeHandle widthPx={440} onChange={onChange} controls="inspector" />);
    fireEvent.keyDown(handle(), { key: "ArrowUp" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("sets the width from the pointer's distance to the pane's right edge while dragging", () => {
    const onChange = vi.fn();
    render(<InspectorResizeHandle widthPx={440} onChange={onChange} controls="inspector" />);
    const sep = handle();
    const parent = sep.parentElement!;
    vi.spyOn(parent, "getBoundingClientRect").mockReturnValue({
      right: 1000,
      width: 1000,
    } as DOMRect);
    const releaseCapture = vi.fn();
    sep.setPointerCapture = vi.fn();
    sep.hasPointerCapture = vi.fn(() => true);
    sep.releasePointerCapture = releaseCapture;

    fireEvent.pointerDown(sep, { pointerId: 1 });
    fireEvent.pointerMove(sep, { pointerId: 1, clientX: 520 });
    expect(onChange).toHaveBeenLastCalledWith(480);
    fireEvent.pointerUp(sep, { pointerId: 1 });
    expect(releaseCapture).toHaveBeenCalled();
  });
});
