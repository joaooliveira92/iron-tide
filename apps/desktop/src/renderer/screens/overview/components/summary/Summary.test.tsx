import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  SummaryDelta,
  SummaryList,
  SummaryRow,
  SummarySection,
  summaryDeltaLabel,
  summaryValueLabel,
} from "./index.js";

describe("Summary compound", () => {
  afterEach(cleanup);

  it("renders a turn section as a counted heading with no aria label", () => {
    const { container } = render(
      <SummarySection variant="turn" testId="group" category="WAR" title="War" count={3}>
        <p>body</p>
      </SummarySection>,
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-category")).toBe("WAR");
    expect(section?.getAttribute("aria-label")).toBeNull();
    expect(section?.querySelector("h3")?.textContent).toBe("War (3)");
  });

  it("renders a report section as an aria-labelled section with a plain heading", () => {
    const { container } = render(
      <SummarySection variant="report" ariaLabel="Treasury" className="space-y-1" title="Treasury">
        <p>body</p>
      </SummarySection>,
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-label")).toBe("Treasury");
    expect(section?.querySelector("h3")).toBeNull();
    expect(section?.firstElementChild?.className).toBe("font-medium");
  });

  it("omits the count from a turn heading when the group carries no tally", () => {
    const { container } = render(
      <SummarySection variant="turn" title="War">
        <p>body</p>
      </SummarySection>,
    );
    expect(container.querySelector("h3")?.textContent).toBe("War");
  });

  it("marks turn rows with message identity and keeps report rows plain", () => {
    const { container } = render(
      <ul>
        <SummaryRow variant="turn" testId="turn-message" messageId="m1" severity="HIGH">
          turn row
        </SummaryRow>
        <SummaryRow variant="report">report row</SummaryRow>
      </ul>,
    );
    const rows = container.querySelectorAll("li");
    expect(rows[0]?.getAttribute("data-testid")).toBe("turn-message");
    expect(rows[0]?.getAttribute("data-message-id")).toBe("m1");
    expect(rows[0]?.getAttribute("data-severity")).toBe("HIGH");
    expect(rows[0]?.className).toContain("rounded-md");
    expect(rows[1]?.getAttribute("data-testid")).toBeNull();
    expect(rows[1]?.className).toBe("");
  });

  it("gives each variant its own list styling", () => {
    const { container } = render(
      <div>
        <SummaryList variant="turn">
          <li>a</li>
        </SummaryList>
        <SummaryList variant="report" ariaLabel="Financial ledger">
          <li>b</li>
        </SummaryList>
      </div>,
    );
    const lists = container.querySelectorAll("ul");
    expect(lists[0]?.className).toBe("space-y-1");
    expect(lists[0]?.getAttribute("aria-label")).toBeNull();
    expect(lists[1]?.className).toBe("text-muted-foreground");
    expect(lists[1]?.getAttribute("aria-label")).toBe("Financial ledger");
  });

  it("renders a delta and leaves the parenthetical out when there is none", () => {
    const { container } = render(
      <div>
        <p>
          <SummaryDelta from="10" to="15" />
        </p>
        <p>
          <SummaryDelta from="10" to="15" delta={summaryDeltaLabel(5)} />
        </p>
        <p>
          <SummaryDelta from="10" to="15" delta={summaryDeltaLabel(-5)} />
        </p>
        <p>
          <SummaryDelta from={summaryValueLabel(undefined)} to={summaryValueLabel(0)} />
        </p>
      </div>,
    );
    expect([...container.querySelectorAll("p")].map((node) => node.textContent)).toEqual([
      "10 → 15",
      "10 → 15 (+5)",
      "10 → 15 (-5)",
      "— → 0",
    ]);
  });
});
