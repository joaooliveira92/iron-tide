import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DEFAULT_DIVISION_ORDER,
  type DivisionOrder,
} from "../../../../shared/player-battle-orders.js";
import { BASE_VIEW } from "../session/battle-session-harness.js";
import { UnitCommandPanel, type UnitCommandPanelProps } from "./UnitCommandPanel.js";

const orders: Readonly<Record<string, DivisionOrder>> = {};

function panelProps(patch: Partial<UnitCommandPanelProps>): UnitCommandPanelProps {
  return {
    view: BASE_VIEW,
    locale: "en-US",
    selectedShipId: "a1",
    orderFor: () => DEFAULT_DIVISION_ORDER,
    acceptedOrders: orders,
    setOrder: () => undefined,
    releaseCourse: () => undefined,
    onPreviewCourse: () => undefined,
    ...patch,
  };
}

describe("unit command panel course preview", () => {
  afterEach(cleanup);

  it("clears the preview on mount, previews only a typed valid course and clears it again", () => {
    const onPreviewCourse = vi.fn();
    render(<UnitCommandPanel {...panelProps({ onPreviewCourse })} />);
    expect(onPreviewCourse.mock.calls.at(-1)).toEqual([null]);

    const input = screen.getByTestId("unit-course-input");
    fireEvent.change(input, { target: { value: "090" } });
    expect(onPreviewCourse.mock.calls.at(-1)).toEqual([expect.any(Number)]);

    fireEvent.change(input, { target: { value: "999" } });
    expect(onPreviewCourse.mock.calls.at(-1)).toEqual([null]);
  });

  it("clears the preview when the panel unmounts", () => {
    const onPreviewCourse = vi.fn();
    const { unmount } = render(<UnitCommandPanel {...panelProps({ onPreviewCourse })} />);
    fireEvent.change(screen.getByTestId("unit-course-input"), { target: { value: "045" } });
    expect(onPreviewCourse.mock.calls.at(-1)?.[0]).not.toBeNull();
    unmount();
    expect(onPreviewCourse.mock.calls.at(-1)).toEqual([null]);
  });

  it("drops the preview when the form resets for another division's standing order", () => {
    const onPreviewCourse = vi.fn();
    const { rerender } = render(<UnitCommandPanel {...panelProps({ onPreviewCourse })} />);
    fireEvent.change(screen.getByTestId("unit-course-input"), { target: { value: "045" } });
    expect(onPreviewCourse.mock.calls.at(-1)?.[0]).not.toBeNull();
    rerender(
      <UnitCommandPanel
        {...panelProps({
          onPreviewCourse,
          orderFor: () => ({ ...DEFAULT_DIVISION_ORDER, courseDeg: 10 }),
        })}
      />,
    );
    expect(onPreviewCourse.mock.calls.at(-1)).toEqual([null]);
  });
});
