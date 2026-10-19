import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
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
});
