import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Advanced } from "./Advanced.js";

afterEach(cleanup);

describe("Advanced disclosure", () => {
  it("keeps its specialist controls behind a summary, closed until opened", () => {
    render(
      <Advanced>
        <span>Inclination</span>
      </Advanced>,
    );
    const details = screen.getByText("Advanced").closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.getByText("Inclination")).toBeTruthy();
  });
});
