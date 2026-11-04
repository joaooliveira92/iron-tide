import { render, screen } from "@testing-library/react";
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
});
