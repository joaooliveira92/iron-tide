import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { DiplomacyScreenProjection } from "../../../shared/diplomacy-contract.js";
import { NationRail } from "./NationRail.js";

const projection: DiplomacyScreenProjection = {
  revision: 1,
  month: { month: 1, year: 1880 },
  playerNationId: "uk",
  knownNations: [
    { nationId: "france", name: "France" },
    { nationId: "germany", name: "Germany" },
  ],
  relations: [
    {
      nationAId: "uk",
      nationBId: "france",
      relation: "at_war",
      tension: 10,
      nap: false,
      since: "1880-01",
      partnerNationId: "france",
      partnerName: "France",
    },
  ],
  wars: [
    {
      warId: "w",
      attackerSideId: "a",
      defenderSideId: "d",
      attackerSideMembers: ["uk"],
      defenderSideMembers: ["france"],
      attackerWarScore: 5,
      defenderWarScore: 2,
      attackerId: "uk",
      defenderId: "france",
      startDate: "1880-01",
      status: "ACTIVE",
      playerSide: "attacker",
    },
  ],
  blockades: [],
  areas: [],
};

describe("NationRail", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(cleanup);

  it("lists the player first with relation words and the war score at war", () => {
    render(
      <NationRail
        state={{ status: "ready", projection }}
        playerName="Britain"
        onNavigate={() => undefined}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Major powers" })).getAllByRole(
      "listitem",
    );
    expect(items.map((i) => i.textContent)).toEqual(["BritainYou", "FranceWar5:2", "GermanyPeace"]);
  });

  it("renders flag art for every 1880 power, player first", () => {
    const powers = [
      "germany",
      "usa",
      "japan",
      "france",
      "italy",
      "russia",
      "austria_hungary",
      "spain",
      "qing",
      "ottoman_empire",
      "netherlands",
      "portugal",
      "brazil",
    ];
    const { container } = render(
      <NationRail
        state={{
          status: "ready",
          projection: {
            ...projection,
            knownNations: powers.map((nationId) => ({ nationId, name: nationId })),
          },
        }}
        playerName="Britain"
        onNavigate={() => undefined}
      />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(powers.length + 1);
  });

  it("selects a nation and shows its detail inline", () => {
    render(
      <NationRail
        state={{ status: "ready", projection }}
        playerName="Britain"
        onNavigate={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /France/ }));
    expect(screen.getByTestId("nation-rail-detail").textContent).toContain("Tension10/10");
  });

  it("collapses deferred intel items into one disclosure with no bars", () => {
    render(
      <NationRail
        state={{ status: "ready", projection }}
        playerName="Britain"
        onNavigate={() => undefined}
      />,
    );
    const deferred = screen.getByTestId("nation-rail-deferred");
    expect(deferred.tagName).toBe("DETAILS");
    expect(deferred.textContent).toContain("Intel level / reports / Almanac: Not yet modelled");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("All relations opens Diplomacy & War", () => {
    const onNavigate = vi.fn();
    render(
      <NationRail
        state={{ status: "ready", projection }}
        playerName="Britain"
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "All relations" }));
    expect(onNavigate).toHaveBeenCalledWith("diplomacy");
  });

  it("states unavailable honestly", () => {
    render(
      <NationRail
        state={{ status: "unavailable" }}
        playerName="Britain"
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
  });
});
