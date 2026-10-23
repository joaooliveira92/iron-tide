/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { DiplomacyRelationRow } from "../diplomacy-view-model.js";
import { InfoHover } from "./InfoHover.js";
import { NationHoverCard } from "./NationHoverCard.js";

const row: DiplomacyRelationRow = {
  flagUrl: null,
  relation: "at_war",
  band: "hostile",
  atWar: true,
  allied: false,
  blockades: [
    {
      key: "uk:france:med",
      blockaderName: "your nation",
      blockadedName: "France",
      areaLabel: "Gibraltar",
      establishedMonth: "1880-02",
    },
  ],
  partnerNationId: "france",
  partnerName: "France",
  since: "1880-01",
  relationLabel: "At war",
  tension: 9,
  tensionBadge: "Hostile",
  nap: false,
  isLikelyRival: true,
  highTension: true,
  highTensionNote: "hostile",
  actions: ["DeclareBlockade"],
};

afterEach(cleanup);

describe("NationHoverCard", () => {
  it("opens an intel card with the relation facts and the battle record on hover", async () => {
    render(
      <NationHoverCard row={row} record={{ played: 3, won: 2, lost: 1, undecided: 0 }}>
        <button type="button">France</button>
      </NationHoverCard>,
    );
    expect(screen.queryByText("Your battles against them")).toBeNull();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "France" }));

    expect(await screen.findByText("Your battles against them")).not.toBeNull();
    expect(screen.getByText("Hostile")).not.toBeNull();
    expect(screen.getByText("9/10")).not.toBeNull();
    expect(screen.getByText("Likely rival")).not.toBeNull();
    expect(screen.getByText("Won").previousSibling?.textContent).toBe("2");
  });

  it("says so when no battles have been fought against the nation", async () => {
    render(
      <NationHoverCard row={row} record={{ played: 0, won: 0, lost: 0, undecided: 0 }}>
        <button type="button">France</button>
      </NationHoverCard>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "France" }));
    expect(await screen.findByText("No battles fought against them yet")).not.toBeNull();
  });
});

describe("InfoHover", () => {
  it("shows its title and rows on hover", async () => {
    render(
      <InfoHover title="War score" rows={[{ label: "Margin", value: "+2 for you" }]}>
        <span>score</span>
      </InfoHover>,
    );
    fireEvent.mouseEnter(screen.getByText("score"));
    expect(await screen.findByText("War score")).not.toBeNull();
    expect(screen.getByText("+2 for you")).not.toBeNull();
  });
});
