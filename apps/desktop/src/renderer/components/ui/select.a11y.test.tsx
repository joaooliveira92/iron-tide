import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

interface HarnessProps {
  readonly selectProps?: Partial<React.ComponentProps<typeof Select>>;
  readonly items?: ReactNode;
}

function Harness({ selectProps, items }: HarnessProps) {
  return (
    <Select {...selectProps}>
      <SelectTrigger>
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        {items ?? (
          <>
            <SelectItem value="a">Alpha</SelectItem>
            <SelectItem value="b">Bravo</SelectItem>
            <SelectItem value="c">Charlie</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

function trigger(): HTMLElement {
  return screen.getByRole("combobox");
}

function press(key: string, element: HTMLElement = trigger()) {
  fireEvent.keyDown(element, { key });
}

function activeLabel(): string | undefined {
  return screen
    .getAllByRole("option", { hidden: true })
    .find((option) => option.getAttribute("data-active") !== null)?.textContent;
}

describe("Select trigger and listbox semantics", () => {
  it("wires combobox, listbox and aria-controls together", () => {
    render(<Harness />);

    const combobox = trigger();
    const listbox = screen.getByRole("listbox", { hidden: true });

    expect(combobox.getAttribute("aria-haspopup")).toBe("listbox");
    expect(combobox.getAttribute("aria-controls")).toBe(listbox.id);
    expect(combobox.getAttribute("aria-expanded")).toBe("false");
    expect(combobox.getAttribute("type")).toBe("button");
    expect(listbox.getAttribute("aria-hidden")).toBe("true");
    expect(listbox.hasAttribute("inert")).toBe(true);
    expect(listbox.parentElement).toBe(document.body);
  });

  it("exposes the listbox once open", () => {
    render(<Harness />);

    fireEvent.click(trigger());

    const listbox = screen.getByRole("listbox");
    expect(listbox.getAttribute("aria-hidden")).toBe("false");
    expect(listbox.hasAttribute("inert")).toBe(false);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("keeps aria-activedescendant in step with the active option", () => {
    render(<Harness selectProps={{ defaultValue: "a" }} />);

    expect(trigger().getAttribute("aria-activedescendant")).toBeNull();

    press("ArrowDown");
    const first = screen.getByRole("option", { name: "Alpha" });
    expect(trigger().getAttribute("aria-activedescendant")).toBe(first.id);

    press("ArrowDown");
    const second = screen.getByRole("option", { name: "Bravo" });
    expect(trigger().getAttribute("aria-activedescendant")).toBe(second.id);

    press("Escape");
    expect(trigger().getAttribute("aria-activedescendant")).toBeNull();
  });

  it("marks only the chosen option as selected", () => {
    render(<Harness selectProps={{ value: "b" }} />);

    fireEvent.click(trigger());

    expect(screen.getByRole("option", { name: "Alpha" }).getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(screen.getByRole("option", { name: "Bravo" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("option", { name: "Bravo" }).hasAttribute("data-selected")).toBe(true);
  });

  it("marks disabled options with aria-disabled and data-disabled", () => {
    render(
      <Harness
        items={
          <>
            <SelectItem value="a">Alpha</SelectItem>
            <SelectItem value="b" disabled>
              Bravo
            </SelectItem>
          </>
        }
      />,
    );

    fireEvent.click(trigger());

    const bravo = screen.getByRole("option", { name: "Bravo" });
    expect(bravo.getAttribute("aria-disabled")).toBe("true");
    expect(bravo.hasAttribute("data-disabled")).toBe(true);
    expect(screen.getByRole("option", { name: "Alpha" }).getAttribute("aria-disabled")).toBeNull();
  });

  it("shows the placeholder until a value is chosen", () => {
    render(<Harness />);

    expect(trigger().textContent).toContain("Pick one");

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "Charlie" }));

    expect(trigger().textContent).toContain("Charlie");
    expect(trigger().textContent).not.toContain("Pick one");
  });

  it("starts from defaultValue and defaultOpen", () => {
    render(<Harness selectProps={{ defaultValue: "c", defaultOpen: true }} />);

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().textContent).toContain("Charlie");
  });

  it("forwards the trigger ref and honours an explicit id", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Select>
        <SelectTrigger ref={ref} id="custom-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(ref.current).toBe(trigger());
    expect(trigger().id).toBe("custom-trigger");
    expect(trigger().textContent).toContain("Select");
  });

  it("reports aria-required when required", () => {
    render(<Harness selectProps={{ required: true }} />);

    expect(trigger().getAttribute("aria-required")).toBe("true");
  });

  it("throws a named error when a part is rendered outside Select", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<SelectTrigger>x</SelectTrigger>)).toThrow(
      "SelectTrigger must be used within <Select>.",
    );
    expect(() => render(<SelectValue />)).toThrow("SelectValue must be used within <Select>.");
    expect(() =>
      render(
        <SelectContent>
          <span />
        </SelectContent>,
      ),
    ).toThrow("SelectContent must be used within <Select>.");
    expect(() => render(<SelectItem value="a">Alpha</SelectItem>)).toThrow(
      "SelectItem must be used within <Select>.",
    );
  });

  it("warns once about duplicate item values", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <Harness
        items={
          <>
            <SelectItem value="a">Alpha</SelectItem>
            <SelectItem value="a">Again</SelectItem>
          </>
        }
      />,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate value "a"'));
  });
});

describe("Select disabled state", () => {
  it("cannot be opened by click or key", () => {
    render(<Harness selectProps={{ disabled: true }} />);

    expect(trigger().hasAttribute("disabled")).toBe(true);
    expect(trigger().getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(trigger());
    press("ArrowDown");
    press("Enter");
    press(" ");

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when it becomes disabled while open", () => {
    const { rerender } = render(<Harness selectProps={{ defaultOpen: true }} />);
    expect(trigger().getAttribute("aria-expanded")).toBe("true");

    rerender(<Harness selectProps={{ defaultOpen: true, disabled: true }} />);

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("does not report a click on an item of a disabled select", () => {
    const onValueChange = vi.fn();
    render(<Harness selectProps={{ defaultOpen: true, disabled: true, onValueChange }} />);

    fireEvent.click(screen.getByRole("option", { name: "Alpha", hidden: true }));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Select keyboard model", () => {
  it.each(["Enter", " ", "ArrowDown", "ArrowUp"])("opens with %j", (key) => {
    render(<Harness />);

    press(key);

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("opens on the selected option, falling back to the first", () => {
    const { unmount } = render(<Harness selectProps={{ value: "c" }} />);
    press("ArrowDown");
    expect(activeLabel()).toBe("Charlie");
    unmount();

    render(<Harness />);
    press("ArrowDown");
    expect(activeLabel()).toBe("Alpha");
  });

  it("wraps ArrowDown past the end and ArrowUp past the start", () => {
    render(<Harness selectProps={{ value: "c" }} />);

    press("ArrowDown");
    expect(activeLabel()).toBe("Charlie");

    press("ArrowDown");
    expect(activeLabel()).toBe("Alpha");

    press("ArrowUp");
    expect(activeLabel()).toBe("Charlie");
  });

  it("skips disabled options while moving", () => {
    render(
      <Harness
        selectProps={{ value: "a" }}
        items={
          <>
            <SelectItem value="a">Alpha</SelectItem>
            <SelectItem value="b" disabled>
              Bravo
            </SelectItem>
            <SelectItem value="c">Charlie</SelectItem>
          </>
        }
      />,
    );

    press("ArrowDown");
    press("ArrowDown");

    expect(activeLabel()).toBe("Charlie");
  });

  it("ignores Home, End and Escape while closed", () => {
    render(<Harness />);

    for (const key of ["Home", "End", "Escape"]) {
      const event = createEvent.keyDown(trigger(), { key });
      fireEvent(trigger(), event);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("prevents default for navigation keys", () => {
    render(<Harness />);

    for (const key of ["ArrowDown", "Enter"]) {
      const event = createEvent.keyDown(trigger(), { key });
      fireEvent(trigger(), event);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it("confirms with Space and returns focus to the trigger", async () => {
    const onValueChange = vi.fn();
    render(<Harness selectProps={{ onValueChange }} />);

    press(" ");
    press("ArrowDown");
    press(" ");

    expect(onValueChange).toHaveBeenCalledWith("b");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(document.activeElement).toBe(trigger());
  });

  it("does nothing on Enter when no option is active", () => {
    const onValueChange = vi.fn();
    render(<Harness selectProps={{ defaultOpen: true, onValueChange }} />);

    press("Enter");

    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape and stops it reaching ancestors", () => {
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <Harness />
      </div>,
    );

    press("ArrowDown");
    onKeyDown.mockClear();
    press("Escape");

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("closes on Tab without preventing default", () => {
    render(<Harness />);

    press("ArrowDown");
    const event = createEvent.keyDown(trigger(), { key: "Tab" });
    fireEvent(trigger(), event);

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets a consumer onKeyDown veto the built-in handling", () => {
    render(
      <Select>
        <SelectTrigger
          onKeyDown={(event) => {
            event.preventDefault();
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    press("ArrowDown");

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("lets a consumer onClick veto toggling", () => {
    render(
      <Select>
        <SelectTrigger
          onClick={(event) => {
            event.preventDefault();
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    fireEvent.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles closed on a second trigger click", () => {
    render(<Harness />);

    fireEvent.click(trigger());
    fireEvent.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Select typeahead", () => {
  const fruit = (
    <>
      <SelectItem value="apple">Apple</SelectItem>
      <SelectItem value="apricot">Apricot</SelectItem>
      <SelectItem value="banana">Banana</SelectItem>
    </>
  );

  it("opens the list when typing a printable key and matches", () => {
    render(<Harness items={fruit} />);

    press("b");

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(activeLabel()).toBe("Banana");
  });

  it("cycles through matches when the same letter repeats", () => {
    render(<Harness items={fruit} />);

    press("ArrowDown");
    press("a");
    expect(activeLabel()).toBe("Apricot");

    press("a");
    expect(activeLabel()).toBe("Apple");
  });

  it("builds a multi-letter query until the timeout resets it", () => {
    vi.useFakeTimers();
    render(<Harness items={fruit} />);

    press("ArrowDown");
    press("a");
    press("p");
    press("r");
    expect(activeLabel()).toBe("Apricot");

    act(() => {
      vi.advanceTimersByTime(800);
    });

    press("b");
    expect(activeLabel()).toBe("Banana");
  });

  it("ignores modified keys", () => {
    render(<Harness items={fruit} />);

    fireEvent.keyDown(trigger(), { key: "b", ctrlKey: true });

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Select pointer behaviour", () => {
  it("closes on a pointerdown outside and ignores one on the trigger or list", () => {
    render(<Harness />);

    fireEvent.click(trigger());
    fireEvent.pointerDown(trigger());
    fireEvent.pointerDown(screen.getByRole("listbox"));
    expect(trigger().getAttribute("aria-expanded")).toBe("true");

    fireEvent.pointerDown(document.body);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("activates an option on pointer move but not for touch or disabled items", () => {
    render(
      <Harness
        items={
          <>
            <SelectItem value="a">Alpha</SelectItem>
            <SelectItem value="b">Bravo</SelectItem>
            <SelectItem value="c" disabled>
              Charlie
            </SelectItem>
          </>
        }
      />,
    );

    fireEvent.click(trigger());

    fireEvent.pointerMove(screen.getByRole("option", { name: "Bravo" }), { pointerType: "mouse" });
    expect(activeLabel()).toBe("Bravo");

    fireEvent.pointerMove(screen.getByRole("option", { name: "Alpha" }), { pointerType: "touch" });
    expect(activeLabel()).toBe("Bravo");

    fireEvent.pointerMove(screen.getByRole("option", { name: "Charlie" }), {
      pointerType: "mouse",
    });
    expect(activeLabel()).toBe("Bravo");
  });

  it("keeps focus on the trigger when an option is pressed", () => {
    render(<Harness />);

    fireEvent.click(trigger());
    const event = createEvent.pointerDown(screen.getByRole("option", { name: "Alpha" }));
    fireEvent(screen.getByRole("option", { name: "Alpha" }), event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("reports the active value to onActiveValueChange", () => {
    const onActiveValueChange = vi.fn();
    render(<Harness selectProps={{ onActiveValueChange }} />);

    press("ArrowDown");
    expect(onActiveValueChange).toHaveBeenLastCalledWith("a");

    press("Escape");
    expect(onActiveValueChange).toHaveBeenLastCalledWith(null);
  });

  it("does not change an uncontrolled value when the parent controls it", () => {
    const onValueChange = vi.fn();
    render(<Harness selectProps={{ value: "a", onValueChange }} />);

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "Bravo" }));

    expect(onValueChange).toHaveBeenCalledWith("b");
    expect(trigger().textContent).toContain("Alpha");
  });
});
