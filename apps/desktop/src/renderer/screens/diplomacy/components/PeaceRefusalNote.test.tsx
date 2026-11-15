import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { PeaceRefusalNote } from "./PeaceRefusalNote.js";

describe("PeaceRefusalNote", () => {
  afterEach(cleanup);

  it("names the refusing nation, its lead and the margin", () => {
    render(
      <PeaceRefusalNote
        id="note"
        refusal={{ reasonCode: "PROPOSER_TRAILS_BY_MARGIN", margin: 20 }}
        enemyName="france"
        enemyLead={35}
      />,
    );
    const note = screen.getByTestId("peace-refusal-note");
    expect(note.id).toBe("note");
    expect(note.textContent).toContain("France is winning the war and will refuse peace");
    expect(note.textContent).toContain("leads by 35");
    expect(note.textContent).toContain("20 or more");
  });
});
