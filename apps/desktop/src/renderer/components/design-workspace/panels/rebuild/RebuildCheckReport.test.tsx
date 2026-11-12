import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { RebuildCheckView } from "../../../../../shared/design-contract.js";
import { RebuildCheckReport } from "./RebuildCheckReport.js";

afterEach(cleanup);

const check = (overrides: Partial<RebuildCheckView>): RebuildCheckView => ({
  legal: true,
  findings: [],
  designProblems: [],
  changesNothing: false,
  measures: null,
  bulgeProtectionGainBp: null,
  ...overrides,
});

describe("RebuildCheckReport", () => {
  it("renders the verdict badge without invalid DOM nesting", () => {
    render(
      <RebuildCheckReport check={check({ changesNothing: true })}>
        <span>body</span>
      </RebuildCheckReport>,
    );
    const badge = screen.getByText("Rebuild allowed");
    expect(badge.closest("p")).not.toBeNull();
    expect(badge.tagName).toBe("SPAN");
  });

  it("labels an illegal rebuild", () => {
    render(
      <RebuildCheckReport check={check({ legal: false })}>
        <span>body</span>
      </RebuildCheckReport>,
    );
    expect(screen.getByText("Rebuild not allowed")).toBeTruthy();
  });
});
