import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { CollapsiblePanel } from "./CollapsiblePanel.js";

function body() {
  return screen.getByText("Body").parentElement as HTMLElement;
}

describe("CollapsiblePanel", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("starts open or collapsed per its default and toggles from the title bar", () => {
    render(
      <CollapsiblePanel panelId="t1" title="Areas" defaultOpen={false}>
        <p>Body</p>
      </CollapsiblePanel>,
    );
    const toggle = screen.getByRole("button", { name: "Areas" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(body().hidden).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(body().hidden).toBe(false);
  });

  it("remembers the choice for the session across remounts, over the default", () => {
    const view = render(
      <CollapsiblePanel panelId="t2" title="Areas" defaultOpen>
        <p>Body</p>
      </CollapsiblePanel>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Areas" }));
    view.unmount();
    render(
      <CollapsiblePanel panelId="t2" title="Areas" defaultOpen>
        <p>Body</p>
      </CollapsiblePanel>,
    );
    expect(screen.getByRole("button", { name: "Areas" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("keeps the body mounted while collapsed and shows a badge", () => {
    render(
      <CollapsiblePanel panelId="t3" title="Areas" defaultOpen={false} badge="(12)">
        <p>Body</p>
      </CollapsiblePanel>,
    );
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("(12)")).toBeTruthy();
  });
});
