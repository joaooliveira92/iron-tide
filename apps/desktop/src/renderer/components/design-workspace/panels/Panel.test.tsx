import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Panel } from "./Panel.js";

afterEach(cleanup);

describe("Panel", () => {
  it("shows its title and names the region", () => {
    render(<Panel title="Hull">Body</Panel>);
    expect(screen.getByRole("region", { name: "Hull" })).toBeTruthy();
    expect(screen.getByText("Hull")).toBeTruthy();
  });

  it("can hide a title the surrounding drawer already shows, and still name the region", () => {
    render(
      <Panel title="Overview" hideTitle>
        Body
      </Panel>,
    );
    const region = screen.getByRole("region", { name: "Overview" });
    expect(region.textContent).toBe("Body");
    expect(region.querySelector("[class*='p-4']")).not.toBeNull();
  });

  it("renders the legacy form as a named region with its title inside the header", () => {
    render(<Panel title="Hull">Body</Panel>);
    const region = screen.getByRole("region", { name: "Hull" });
    expect(within(region).getByText("Hull")).toBeTruthy();
    expect(region.firstElementChild?.className).toContain("p-4 pb-2");
    expect(region.lastElementChild?.className).toBe("space-y-3 p-4 pt-0");
  });

  it("hides the header but keeps the region named and the body standalone", () => {
    render(
      <Panel title="Overview" hideTitle>
        Body
      </Panel>,
    );
    const region = screen.getByRole("region", { name: "Overview" });
    expect(within(region).queryByText("Overview")).toBeNull();
    expect(region.firstElementChild?.className).toBe("space-y-3 p-4");
  });

  it("composes a named region with a flush body and no header", () => {
    render(
      <Panel.Root label="Hull plan">
        <Panel.Body variant="flush">Body</Panel.Body>
      </Panel.Root>,
    );
    const region = screen.getByRole("region", { name: "Hull plan" });
    expect(screen.queryByText("Hull plan")).toBeNull();
    expect(region.textContent).toBe("Body");
    expect(region.firstElementChild?.className).toBe("space-y-2 p-0");
  });

  it("renders the header title inside the region", () => {
    render(
      <Panel.Root label="Hull">
        <Panel.Header>Hull</Panel.Header>
        <Panel.Body variant="beneath-header">Body</Panel.Body>
      </Panel.Root>,
    );
    const region = screen.getByRole("region", { name: "Hull" });
    expect(within(region).getByText("Hull")).toBeTruthy();
    expect(region.textContent).toBe("HullBody");
  });

  it("renders actions as a row of children inside a body", () => {
    render(
      <Panel.Root label="Hull">
        <Panel.Body variant="standalone">
          <Panel.Actions>
            <button type="button">Save</button>
          </Panel.Actions>
        </Panel.Body>
      </Panel.Root>,
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save.parentElement?.className).toContain("justify-end");
  });
});
