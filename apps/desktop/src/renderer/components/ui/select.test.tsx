import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSelect(props?: { value?: string; onValueChange?: (value: string) => void }) {
  return render(
    <Select value={props?.value} onValueChange={props?.onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Alpha</SelectItem>
        <SelectItem value="b">Bravo</SelectItem>
        <SelectItem value="c">Charlie</SelectItem>
      </SelectContent>
    </Select>,
  );
}

function activeOptionText(): string | undefined {
  return (
    screen.getAllByRole("option").find((option) => option.getAttribute("data-active") !== null)
      ?.textContent ?? undefined
  );
}

describe("Select", () => {
  it("shows the selected option label on first render", () => {
    renderSelect({ value: "b" });

    expect(screen.getByRole("combobox").textContent).toContain("Bravo");
  });

  it("selects an option by pointer and reports the value", () => {
    const onValueChange = vi.fn();
    renderSelect({ onValueChange });

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Charlie" }));

    expect(onValueChange).toHaveBeenCalledWith("c");
  });

  it("opens with ArrowDown and confirms the active option with Enter", () => {
    const onValueChange = vi.fn();
    renderSelect({ value: "b", onValueChange });

    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("c");
  });

  it("moves the active option with typeahead", () => {
    renderSelect({ value: "a" });

    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "c" });

    expect(activeOptionText()).toContain("Charlie");
  });

  it("jumps to the first and last options with Home and End", () => {
    renderSelect({ value: "b" });

    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    fireEvent.keyDown(trigger, { key: "End" });
    expect(activeOptionText()).toContain("Charlie");

    fireEvent.keyDown(trigger, { key: "Home" });
    expect(activeOptionText()).toContain("Alpha");
  });

  it("closes on Escape and collapses aria-expanded", () => {
    renderSelect({ value: "a" });

    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("honors controlled open state and reports toggles", () => {
    const onOpenChange = vi.fn();
    render(
      <Select open onOpenChange={onOpenChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not select a disabled option", () => {
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b" disabled>
            Bravo
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Bravo" }));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("renders a hidden input for form submission", () => {
    const { container } = render(
      <Select name="naming" form="campaign" value="b">
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="b">Bravo</SelectItem>
        </SelectContent>
      </Select>,
    );

    const input = container.querySelector('input[type="hidden"]');
    expect(input?.getAttribute("name")).toBe("naming");
    expect(input?.getAttribute("form")).toBe("campaign");
    expect((input as HTMLInputElement | null)?.value).toBe("b");
  });

  it("warns when non-text children have no textValue", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <Select value="a">
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">
            <span>Alpha</span>
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("has non-text children"));
  });

  it("renders a per-option description without changing the option name", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" description="Real names from the period">
            Historical
          </SelectItem>
          <SelectItem value="b">Generated</SelectItem>
        </SelectContent>
      </Select>,
    );

    fireEvent.click(screen.getByRole("combobox"));

    const historical = screen.getByRole("option", { name: "Historical" });
    expect(historical.textContent).toContain("Real names from the period");

    const descriptionId = historical.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(historical.querySelector(`#${descriptionId}`)?.textContent).toBe(
      "Real names from the period",
    );

    const generated = screen.getByRole("option", { name: "Generated" });
    expect(generated.getAttribute("aria-describedby")).toBeNull();
  });

  it("uses textValue for the trigger label and typeahead", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <Select value="a">
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" textValue="Alpha">
            <span>Alpha</span>
          </SelectItem>
          <SelectItem value="b" textValue="Bravo">
            <span>Bravo</span>
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain("Alpha");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "b" });

    expect(activeOptionText()).toContain("Bravo");
    expect(warn).not.toHaveBeenCalled();
  });
});
