import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";

import { LedgerTable } from "./LedgerTable.js";

describe("LedgerTable", () => {
  it("renders a row as a labelled button with its cells", () => {
    render(
      <LedgerTable.Root columns="construction" testId="table">
        <LedgerTable.Row ariaLabel="Alpha: 5 — show detail" detail={<p>detail</p>}>
          <LedgerTable.Label>Alpha</LedgerTable.Label>
          <LedgerTable.Bar share={0.5} />
          <LedgerTable.Note>Active</LedgerTable.Note>
          <LedgerTable.Amount>5</LedgerTable.Amount>
        </LedgerTable.Row>
      </LedgerTable.Root>,
    );
    const row = screen.getByRole("button", { name: "Alpha: 5 — show detail" });
    expect(row.textContent).toContain("Alpha");
    expect(row.textContent).toContain("5");
    expect(row.className).toContain("grid-cols-[minmax(0,1fr)_minmax(3rem,7rem)_4.5rem_6rem]");
  });

  it("opens on click and reports hover and focus as activity", () => {
    const opened: string[] = [];
    const activity: boolean[] = [];
    render(
      <LedgerTable.Root columns="flow">
        <LedgerTable.Row
          ariaLabel="Beta"
          detail={<p>detail</p>}
          onOpen={() => opened.push("beta")}
          onActive={(on) => activity.push(on)}
        >
          <LedgerTable.Label>Beta</LedgerTable.Label>
        </LedgerTable.Row>
      </LedgerTable.Root>,
    );
    const row = screen.getByRole("button", { name: "Beta" });
    fireEvent.click(row);
    fireEvent.mouseEnter(row);
    fireEvent.mouseLeave(row);
    fireEvent.focus(row);
    fireEvent.blur(row);
    expect(opened).toEqual(["beta"]);
    expect(activity).toEqual([true, false, true, false]);
  });

  it("dims and highlights rows through the existing state props", () => {
    render(
      <LedgerTable.Root columns="flow">
        <LedgerTable.Row ariaLabel="Gamma" detail={null} highlighted dimmed>
          <LedgerTable.Label>Gamma</LedgerTable.Label>
        </LedgerTable.Row>
      </LedgerTable.Root>,
    );
    const row = screen.getByRole("button", { name: "Gamma" });
    expect(row.className).toContain("bg-muted/60");
    expect(row.className).toContain("opacity-60");
  });
});
