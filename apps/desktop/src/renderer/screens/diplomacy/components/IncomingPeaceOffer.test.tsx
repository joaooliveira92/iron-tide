import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DiplomacyIncomingPeaceOffer } from "@bluewave/campaign-engine";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { IncomingPeaceOffer } from "./IncomingPeaceOffer.js";

const statusQuo: DiplomacyIncomingPeaceOffer = {
  proposerId: "france",
  term: { _tag: "StatusQuo" },
  reasonCode: "PROPOSER_TRAILS_BY_MARGIN",
  month: "1880-03",
};

describe("IncomingPeaceOffer", () => {
  afterEach(cleanup);

  it("names the proposer, the term and why, and accepts on click", () => {
    const onAccept = vi.fn();
    render(
      <IncomingPeaceOffer offer={statusQuo} enemyName="france" busy={false} onAccept={onAccept} />,
    );
    expect(screen.getByText(/France proposes peace/)).toBeTruthy();
    expect(screen.getByText(/left where it stands/)).toBeTruthy();
    expect(screen.getByText(/is losing the war/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Accept offer/ }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("names the ceded area for a cession offer", () => {
    render(
      <IncomingPeaceOffer
        offer={{
          ...statusQuo,
          term: { _tag: "CedeArea", areaId: "med_malta" },
          areaName: "Malta",
          reasonCode: "PROPOSER_LEADS_BY_MARGIN",
        }}
        enemyName="france"
        busy={false}
        onAccept={() => undefined}
      />,
    );
    expect(screen.getByText(/cede Malta/)).toBeTruthy();
    expect(screen.getByText(/is winning the war/)).toBeTruthy();
  });

  it("disables the control while a command is submitting", () => {
    render(
      <IncomingPeaceOffer offer={statusQuo} enemyName="france" busy onAccept={() => undefined} />,
    );
    expect(
      (screen.getByRole("button", { name: /Accept offer/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
