import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Anchor } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A stand-in for flag art: an image the tests can find, decorative so it never joins the accessible name. */
const Flag = ({ code }: { readonly code: string }) => (
  <img data-testid={`flag-${code}`} src={`flag:${code}`} alt="" />
);

describe("Select leading visual (icon or flag)", () => {
  it("shows the selected option's leading visual in the trigger", () => {
    render(
      <Select value="b">
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" icon={<Anchor data-testid="icon-a" />} textValue="Alpha">
            Alpha
          </SelectItem>
          <SelectItem value="b" icon={<Flag code="b" />} textValue="Bravo">
            Bravo
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox");
    expect(within(trigger).getByTestId("flag-b")).toBeTruthy();
    expect(trigger.textContent).toContain("Bravo");
  });

  it("renders the leading visual on each option row without changing its accessible name", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" icon={<Anchor data-testid="icon-a" />} textValue="Alpha">
            Alpha
          </SelectItem>
          <SelectItem value="b" textValue="Bravo">
            Bravo
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    fireEvent.click(screen.getByRole("combobox"));

    const alpha = screen.getByRole("option", { name: "Alpha" });
    expect(within(alpha).getByTestId("icon-a")).toBeTruthy();

    const bravo = screen.getByRole("option", { name: "Bravo" });
    expect(within(bravo).queryByTestId("icon-a")).toBeNull();
  });

  it("shows no leading visual when the selected option has none", () => {
    render(
      <Select value="a">
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" textValue="Alpha">
            Alpha
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain("Alpha");
    expect(trigger.querySelector("[aria-hidden='true'] img")).toBeNull();
  });
});
