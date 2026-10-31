import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DesignIdentity, type DesignIdentityProps } from "./DesignIdentity.js";

afterEach(cleanup);

const props = (over: Partial<DesignIdentityProps> = {}): DesignIdentityProps => ({
  month: "1880-01",
  months: null,
  onMonth: () => {},
  ...over,
});

describe("DesignIdentity", () => {
  it("labels the date as fixed when the campaign owns it, and offers a year select otherwise", () => {
    const { rerender } = render(<DesignIdentity {...props()} />);
    expect(screen.getAllByText("Tech date").length).toBeGreaterThan(0);
    expect(screen.getByText("1880-01")).toBeTruthy();
    rerender(<DesignIdentity {...props({ months: ["1880-01", "1880-02"] })} />);
    expect(screen.queryByText("Tech date")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Technology as of" })).toBeTruthy();
  });

  it("offers the class-name helpers only when given, and runs them", () => {
    const onSuggest = vi.fn<() => void>();
    const onBrowse = vi.fn<() => void>();
    const { rerender } = render(<DesignIdentity {...props()} />);
    expect(screen.queryByRole("button", { name: "Suggest a class name" })).toBeNull();
    rerender(<DesignIdentity {...props({ names: { onSuggest, onBrowse, canSuggest: true } })} />);
    fireEvent.click(screen.getByRole("button", { name: "Suggest a class name" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse class names" }));
    expect(onSuggest).toHaveBeenCalledOnce();
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it("disables Suggest, but not the list, when the nation has no names for the type", () => {
    render(
      <DesignIdentity
        {...props({ names: { onSuggest: () => {}, onBrowse: () => {}, canSuggest: false } })}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Suggest a class name" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Browse class names" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
