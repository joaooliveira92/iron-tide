import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DesignMapFooter, type DesignMapFooterProps } from "./DesignMapFooter.js";

afterEach(cleanup);

const props = (over: Partial<DesignMapFooterProps> = {}): DesignMapFooterProps => ({
  month: "1880-01",
  months: null,
  onMonth: () => {},
  status: { label: "Can be submitted", tone: "ok", detail: "0 blocking" },
  ...over,
});

describe("DesignMapFooter", () => {
  it("labels the date as fixed when the campaign owns it, and offers a year select otherwise", () => {
    const { rerender } = render(<DesignMapFooter {...props()} />);
    expect(screen.getAllByText("Tech date").length).toBeGreaterThan(0);
    expect(screen.getByText("1880-01")).toBeTruthy();
    rerender(<DesignMapFooter {...props({ months: ["1880-01", "1880-02"] })} />);
    expect(screen.queryByText("Tech date")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Technology as of" })).toBeTruthy();
  });

  it("announces each status tone", () => {
    const { rerender } = render(<DesignMapFooter {...props()} />);
    expect(screen.getByRole("status").textContent).toContain("Can be submitted");
    rerender(
      <DesignMapFooter
        {...props({ status: { label: "Needs a class name", tone: "warn", detail: "" } })}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Needs a class name");
    rerender(
      <DesignMapFooter
        {...props({ status: { label: "Cannot be built", tone: "bad", detail: "" } })}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Cannot be built");
  });

  it("turns the status into a button that runs the fix when one is given", () => {
    const onStatusAction = vi.fn<() => void>();
    const status = { label: "Needs a class name", tone: "warn" as const, detail: "" };
    const { rerender } = render(<DesignMapFooter {...props({ status })} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<DesignMapFooter {...props({ status, onStatusAction })} />);
    expect(screen.getByRole("status")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Needs a class name.*Activate to fix$/ }));
    expect(onStatusAction).toHaveBeenCalledOnce();
  });

  it("offers the class-name helpers only when given, and runs them", () => {
    const onSuggest = vi.fn<() => void>();
    const onBrowse = vi.fn<() => void>();
    const { rerender } = render(<DesignMapFooter {...props()} />);
    expect(screen.queryByRole("button", { name: "Suggest a class name" })).toBeNull();
    rerender(<DesignMapFooter {...props({ names: { onSuggest, onBrowse, canSuggest: true } })} />);
    fireEvent.click(screen.getByRole("button", { name: "Suggest a class name" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse class names" }));
    expect(onSuggest).toHaveBeenCalledOnce();
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it("disables Suggest, but not the list, when the nation has no names for the type", () => {
    render(
      <DesignMapFooter
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
