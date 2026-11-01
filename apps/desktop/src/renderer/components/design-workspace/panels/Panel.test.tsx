import { cleanup, render, screen } from "@testing-library/react";
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
});
