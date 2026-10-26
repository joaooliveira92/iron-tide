/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { SLATE_TIP } from "./menu-styles.js";
import { Tip } from "./tip.js";

describe("Tip", () => {
  afterEach(cleanup);

  it("describes its trigger without covering it with an interactive surface", () => {
    render(
      <Tip label="Save, copy or close">
        <button type="button">Campaign</button>
      </Tip>,
    );

    expect(screen.getByRole("button", { name: "Campaign" }).getAttribute("aria-description")).toBe(
      "Save, copy or close",
    );
    expect(SLATE_TIP).toContain("pointer-events-none");
  });
});
