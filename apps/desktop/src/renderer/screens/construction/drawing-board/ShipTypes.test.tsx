// ADR-0088: the ship-type roster, the Brief selector and starter designs on the Drawing Board (campaign date 1880-01).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DrawingBoard } from "./DrawingBoard.js";
import { chooseOption, region } from "./test-helpers.js";

vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => null,
  useCampaignMonthId: () => "1880-01",
}));

afterEach(cleanup);

const roster = () => region("Ship types");
const row = (name: RegExp) =>
  within(roster())
    .getAllByRole("listitem")
    .find((li) => name.test(li.textContent ?? ""))!;
const classCode = () => region("Design brief").querySelector('[aria-label^="Class code"]')!;

describe("ship-type roster", () => {
  it("lists the six opening types, grouped by category, with the armed merchant cruiser as an auxiliary", () => {
    render(<DrawingBoard />);
    const groups = within(roster())
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(groups).toEqual([
      "Capital ships",
      "Cruisers",
      "Light combatants",
      "Colonial vessels",
      "Auxiliaries and special projects",
    ]);
    const names = within(roster())
      .getAllByRole("listitem")
      .map((li) => li.querySelector("h4")?.textContent);
    expect(names).toEqual([
      "Pre-dreadnought battleship (B)",
      "Armoured cruiser (CA)",
      "Protected cruiser (CL)",
      "Torpedo boat / early destroyer (DD)",
      "Corvette / colonial gunboat (KE)",
      "Armed merchant cruiser (AMC)",
    ]);
    const aux = within(roster()).getByRole("heading", { name: /Auxiliaries/ }).parentElement!;
    expect(
      within(aux)
        .getAllByRole("heading", { level: 4 })
        .map((h) => h.textContent),
    ).toEqual(["Armed merchant cruiser (AMC)"]);
    expect(within(aux).getByText("Auxiliary")).toBeTruthy();
  });

  it("does not offer or name any later ship type, and says why in general terms", () => {
    render(<DrawingBoard />);
    const text = roster().textContent ?? "";
    expect(text).not.toMatch(/(?<!pre-)dreadnought|battlecruiser|carrier|submarine|missile/i);
    expect(text).toMatch(/not available in this era/);
    chooseOption(/^Ship type$/, "B · Pre-dreadnought battleship");
    fireEvent.click(screen.getByLabelText("Ship type"));
    const options = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(options).toHaveLength(6);
    expect(options.join(" ")).not.toMatch(/(?<!pre-)dreadnought|battlecruiser|carrier/i);
  });

  it("states availability, cost, build time and ranges as text, not colour", () => {
    render(<DrawingBoard />);
    const dd = row(/Torpedo boat/);
    expect(within(dd).getByText("Available")).toBeTruthy();
    expect(dd.textContent).toMatch(/Relative cost\s*Very low/);
    expect(dd.textContent).toMatch(/Speed\s*over 19 kn/);
    expect(dd.textContent).toMatch(/Displacement\s*under 2,000 t/);
    // The envelope follows the scenario ruleset (ADR-0116): the 1880 B band is 1,500 t / under 18 kn.
    const b = row(/Pre-dreadnought battleship/).textContent ?? "";
    expect(b).toMatch(/Speed\s*under 18 kn/);
    expect(b).toMatch(/Displacement\s*1,500 t or more/);
  });

  it("discloses detail on demand through a labelled, keyboard-operable button", () => {
    render(<DrawingBoard />);
    const ke = row(/Corvette/);
    const toggle = within(ke).getByRole("button", { name: /Details for Corvette/ });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(within(ke).queryByText(/Weaknesses:/)).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(ke).getByText(/Weaknesses:/)).toBeTruthy();
    expect(within(ke).getByText(/Torpedoes are not allowed/)).toBeTruthy();
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).not.toBeNull();
  });

  it("does not promise trade missions the campaign does not simulate", () => {
    render(<DrawingBoard />);
    const amc = row(/Armed merchant cruiser/);
    expect(amc.textContent).not.toMatch(/commerce raiding and trade protection;/i);
    fireEvent.click(within(amc).getByRole("button", { name: /Details for Armed merchant/ }));
    expect(within(amc).getByText(/Not yet simulated:/).parentElement!.textContent).toMatch(
      /commerce raiding, commerce protection, minelaying/,
    );
  });

  it.each([
    ["Pre-dreadnought battleship", /^B/],
    ["Armoured cruiser", /^CA/],
    ["Protected cruiser", /^CL/],
    ["Torpedo boat", /^DD/],
    ["Corvette", /^KE/],
    ["Armed merchant cruiser", /^AMC/],
  ] as const)("starting from the %s starter loads a legal design of that type", (name, code) => {
    render(<DrawingBoard />);
    const start = within(row(new RegExp(name))).getByRole("button", { name: /^Start from/ });
    expect((start as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(start);
    expect(classCode().textContent).toMatch(code);
    // No blocking finding about the type, and the natural class is the declared one.
    expect(within(region("Design brief")).queryByText(/^Blocking:/)).toBeNull();
    expect(row(new RegExp(name)).getAttribute("aria-current")).toBe("true");
  });

  it("asks before replacing a design with unsaved edits, and keeps it when the player declines", async () => {
    render(<DrawingBoard />);
    const power = screen.getByLabelText(/installed power/i) as HTMLInputElement;
    fireEvent.change(power, { target: { value: "2700" } });
    fireEvent.blur(power);
    expect(screen.getByText("1 edit")).toBeTruthy();
    fireEvent.click(within(row(/Corvette/)).getByRole("button", { name: /^Start from/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toMatch(/replaces the design you are working on/);
    fireEvent.click(screen.getByRole("button", { name: "Keep what I have" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByText("1 edit")).toBeTruthy();
    expect(classCode().textContent).not.toMatch(/^KE/);
    // Confirming replaces it and clears the edit history.
    fireEvent.click(within(row(/Corvette/)).getByRole("button", { name: /^Start from/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Replace my design" }));
    await waitFor(() => expect(classCode().textContent).toMatch(/^KE/));
    expect(screen.getByText("No edits")).toBeTruthy();
  });

  it("shows a type's rule failures next to the brief when the design stops qualifying", () => {
    render(<DrawingBoard />);
    fireEvent.click(within(row(/Corvette/)).getByRole("button", { name: /^Start from/ }));
    // Declare it a battle-line ship: it fails the B rules, and the brief says so inline.
    chooseOption(/^Ship type$/, "B · Pre-dreadnought battleship");
    const findings = within(region("Design brief")).getByRole("list", {
      name: "Findings about the ship type",
    });
    expect(findings.textContent).toMatch(/Blocking: .*does not qualify as B/);
  });
});
