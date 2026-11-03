import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";
import { openHistory, openSection } from "./test-helpers.js";

afterEach(cleanup);

const commit = (label: string | RegExp, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const undo = () => screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
const performance = () => screen.getByRole("region", { name: "Performance" });
const metric = (label: string) =>
  within(performance()).getByText(label).nextElementSibling!.textContent ?? "";

describe("the design's supporting panels", () => {
  it("shows topside load as absolute deck area and a percentage, updated by edits", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Hull", "Stability");
    const panel = () => screen.getByRole("region", { name: "Topside load" });
    const used = () => within(panel()).getByRole("meter").getAttribute("aria-valuenow");
    expect(within(panel()).getByText(/m² deck area/)).toBeTruthy();
    const before = used();
    openSection("Machinery");
    fireEvent.click(screen.getAllByRole("button", { name: /^Remove / })[0]!);
    openSection("Hull", "Stability");
    expect(Number(used())).toBeLessThan(Number(before));
  });

  it("compares against the starting design and lists only what changed", () => {
    render(<ShipbuildingWorkspace />);
    const open = () => fireEvent.click(screen.getByRole("button", { name: /Compare/ }));
    open();
    const cmp = () => screen.getByRole("region", { name: "Compared with starting design" });
    expect(within(cmp()).getByText(/No differences/)).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    openSection("Machinery");
    commit(/^Installed power/, "3400");
    if (screen.queryByRole("region", { name: "Compared with starting design" }) === null) open();
    expect(within(cmp()).queryByText(/No differences/)).toBeNull();
    expect(within(cmp()).getByText("Displacement")).toBeTruthy();
  });

  it("lists edits in the history and jumping back restores the earlier design", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Machinery", "Performance");
    const before = metric("Top speed");
    openSection("Machinery", "Propulsion");
    commit(/^Installed power/, "3400");
    const history = within(openHistory()).getByRole("region", { name: "Edit history" });
    expect(within(history).getByText(/Start:/)).toBeTruthy();
    expect(within(history).getByText(/Machinery: installed kw → 3400/)).toBeTruthy();
    fireEvent.click(within(history).getByRole("button", { name: /0\. Start:/ }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    openSection("Machinery", "Performance");
    expect(metric("Top speed")).toBe(before);
  });

  it("states what the order will cost the treasury, in units, and labels the development metric", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Overview", "Summary");
    const panel = screen.getByRole("region", { name: "Cost and construction forecast" });
    const row = within(panel).getByText(/Charged to the treasury when ordered/).parentElement!;
    expect(row.textContent).toMatch(/\d[\d,]* units \(10,000 NC each\)/);
    expect(within(panel).getByText(/DEV METRIC: not a combat result/)).toBeTruthy();
    expect(within(panel).getByText("Build time").nextElementSibling!.textContent).toMatch(
      /^\d+ months/,
    );
  });

  it("proposes valid alternatives that can be loaded as the working design", async () => {
    render(<ShipbuildingWorkspace />);
    openSection("Machinery");
    commit(/^Installed power/, "3400");
    fireEvent.click(screen.getByRole("button", { name: /More design actions/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Design alternatives/ }));
    const dialog = screen.getByRole("dialog", { name: "Design alternatives" });
    fireEvent.click(within(dialog).getByRole("button", { name: /generate alternatives/i }));
    const list = await waitFor(() => within(dialog).getByRole("list", { name: /ai candidates/i }), {
      timeout: 20_000,
    });
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    expect(list.textContent).toContain("development metric");
    fireEvent.click(within(items[0]!).getByRole("button", { name: /load design/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Replace my design" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(undo().disabled).toBe(true);
  }, 40_000);

  it("adds a component from the grouped menu and removes it", async () => {
    render(<ShipbuildingWorkspace />);
    openSection("Armament", "Secondary");
    const rows = () =>
      within(screen.getByRole("region", { name: /fittings$/ })).getAllByRole("row").length;
    const n = rows();
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    const items = await screen.findAllByRole("menuitem");
    const six = items.find((i) => /6-pounder|6 pounder|6pdr/i.test(i.textContent ?? ""))!;
    expect(six).toBeTruthy();
    fireEvent.click(six);
    await waitFor(() => expect(rows()).toBe(n + 1));
    fireEvent.click(screen.getByRole("button", { name: "Remove gun_qf_6pdr_1" }));
    expect(rows()).toBe(n);
  });

  it("duplicates a fitting from its row menu, and offers the same actions on a right-click", async () => {
    render(<ShipbuildingWorkspace />);
    openSection("Systems", "Accommodation");
    const panel = () => screen.getByRole("region", { name: /fittings$/ });
    const rows = () => within(panel()).getAllByRole("row").length;
    const n = rows();
    fireEvent.click(within(panel()).getByRole("button", { name: "More actions for funnel" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    await waitFor(() => expect(rows()).toBe(n + 1));
    expect(within(panel()).getByText("funnel_single_1")).toBeTruthy();
    const row = within(panel()).getByText("funnel").closest("tr")!;
    fireEvent.contextMenu(row);
    expect(await screen.findByRole("menuitem", { name: "Remove" })).toBeTruthy();
  });
});
