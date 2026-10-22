/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { axeViolations } from "../../../lib/axe.js";
import { japanProjection } from "../world-situation-fixture.js";
import { WorldSituationBriefing } from "./WorldSituationBriefing.js";

afterEach(cleanup);

function dossierHeading(): string {
  return document.getElementById("world-dossier-heading")?.textContent ?? "";
}

describe("WorldSituationBriefing", () => {
  it("leads with Japan, the campaign year and a statement that the picture will change", () => {
    render(<WorldSituationBriefing projection={japanProjection()} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "World Situation Briefing" }),
    ).toBeTruthy();
    expect(screen.getByText("Empire of Japan")).toBeTruthy();
    expect(screen.getByText("Active nation")).toBeTruthy();
    expect(screen.getByText(/January 1880/)).toBeTruthy();
    expect(screen.getByText(/Relations and standing will change/)).toBeTruthy();
  });

  it("renders the relevance tiers in a fixed order and selects the most pressing power", () => {
    render(<WorldSituationBriefing projection={japanProjection()} />);
    const tiers = within(screen.getByRole("navigation", { name: "Foreign powers" }))
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(tiers).toEqual(["Immediate interests", "Powers of wide reach", "Distant powers"]);
    expect(dossierHeading()).toBe("Qing Dynasty");
    expect(screen.getByRole("button", { name: /Qing Dynasty/ }).getAttribute("aria-current")).toBe(
      "true",
    );
  });

  it("updates the dossier and announces the change when a power is selected", () => {
    render(<WorldSituationBriefing projection={japanProjection()} />);
    expect(screen.getByRole("status").textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /United Kingdom/ }));
    expect(dossierHeading()).toBe("United Kingdom");
    expect(screen.getByRole("status").textContent).toMatch(
      /United Kingdom\. Neutral\. Attitude Reserved/,
    );
    expect(screen.getByText("Hong Kong")).toBeTruthy();
    expect(screen.getByText(/holds Hong Kong in East Asia/)).toBeTruthy();
  });

  it("moves the selection with the arrow, Home and End keys, and keeps one tab stop", () => {
    render(<WorldSituationBriefing projection={japanProjection()} />);
    const qing = screen.getByRole("button", { name: /Qing Dynasty/ });
    qing.focus();
    fireEvent.keyDown(qing, { key: "ArrowDown" });
    expect(dossierHeading()).toBe("United Kingdom");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /United Kingdom/ }));
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
    expect(dossierHeading()).toBe("Qing Dynasty");
    fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    expect(dossierHeading()).toBe("French Republic");
    fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    expect(dossierHeading()).toBe("Qing Dynasty");
    const tabStops = screen
      .getAllByRole("button")
      .filter((button) => button.closest("ul") !== null && button.tabIndex === 0);
    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]?.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: /United Kingdom/ }).tabIndex).toBe(-1);
  });

  it("folds the distant tier away and reveals it on request, keyboard-operable", () => {
    render(<WorldSituationBriefing projection={japanProjection()} />);
    expect(screen.queryByRole("button", { name: /German Empire/ })).toBeNull();
    const toggle = screen.getByRole("button", { name: /Show 4 more powers/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const germany = screen.getByRole("button", { name: /German Empire/ });
    fireEvent.click(germany);
    expect(dossierHeading()).toBe("German Empire");
    fireEvent.click(screen.getByRole("button", { name: /Hide these powers/ }));
    expect(dossierHeading()).toBe("Qing Dynasty");
  });

  it("keeps formal status, attitude, tension, outlook and confidence separate and worded", () => {
    render(<WorldSituationBriefing projection={japanProjection()} />);
    const labels = screen.getAllByRole("term").map((term) => term.textContent);
    for (const label of ["Formal status", "Attitude", "Outlook", "Intelligence confidence"]) {
      expect(labels).toContain(label);
    }
    expect(screen.getByText("6 of 10")).toBeTruthy();
    expect(screen.getByText(/A higher number means a worse relationship/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Tension 6 of 10, where 10 is war" })).toBeTruthy();
    expect(screen.getByText("No non-aggression pact is in force.")).toBeTruthy();
  });

  it("states that intelligence is ungraded instead of inventing a confidence", () => {
    render(<WorldSituationBriefing projection={japanProjection()} />);
    expect(screen.getByText(/Not graded\./)).toBeTruthy();
    expect(screen.queryByText("Confirmed")).toBeNull();
    expect(screen.queryByText("Estimated")).toBeNull();
  });

  it("explains the tension scale in an always-reachable legend with the engine's bands", () => {
    render(<WorldSituationBriefing projection={japanProjection()} />);
    const legend = screen.getByText("How to read this briefing");
    fireEvent.click(legend);
    expect(screen.getByText("Cordial: 0–2")).toBeTruthy();
    expect(screen.getByText("On the brink: 10")).toBeTruthy();
    expect(screen.getByText(/A higher number is worse/)).toBeTruthy();
  });

  it("stays usable with an empty dataset", () => {
    render(<WorldSituationBriefing projection={japanProjection({ relations: [] })} />);
    expect(screen.getByRole("heading", { name: "No foreign powers on record" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Foreign powers" })).toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: "World Situation Briefing" }),
    ).toBeTruthy();
  });

  it("falls back honestly when Japan's holdings cannot be placed in a theatre", () => {
    render(<WorldSituationBriefing projection={japanProjection({ playerAreas: [] })} />);
    expect(screen.getByText(/could be placed in a theatre/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Immediate interests" })).toBeNull();
  });

  it("animates only under motion-safe, so reduced motion is respected", () => {
    const { container } = render(<WorldSituationBriefing projection={japanProjection()} />);
    const offenders = [...container.querySelectorAll("[class]")].flatMap((element) =>
      element
        .getAttribute("class")!
        .split(/\s+/)
        .filter((token) => /(^|:)(animate-|transition)/.test(token))
        .filter((token) => !token.startsWith("motion-safe:")),
    );
    expect(offenders).toEqual([]);
  });

  it("owns no scroll container of its own, leaving one primary scroll region", () => {
    const { container } = render(<WorldSituationBriefing projection={japanProjection()} />);
    expect(
      container.querySelector(
        '[class*="overflow-y-"], [class*="overflow-auto"], [class*="overflow-scroll"]',
      ),
    ).toBeNull();
  });

  it("opens the dossier directly under the selected power in a single column", () => {
    const { container } = render(<WorldSituationBriefing projection={japanProjection()} />);
    const item = screen.getByRole("button", { name: /Qing Dynasty/ }).closest("li");
    expect(item?.querySelector("#world-dossier-heading")).not.toBeNull();
    expect(container.querySelector('nav [class*="lg:grid-cols-"]')).toBeNull();
  });

  it("does not mutate the projection it presents", () => {
    const projection = japanProjection();
    const before = JSON.stringify(projection);
    render(<WorldSituationBriefing projection={projection} />);
    fireEvent.click(screen.getByRole("button", { name: /Russian Empire/ }));
    expect(JSON.stringify(projection)).toBe(before);
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<WorldSituationBriefing projection={japanProjection()} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
