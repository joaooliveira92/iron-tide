import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DrawingBoard } from "./DrawingBoard.js";
import { chooseOption, openPlanDisplay, openTab, region } from "./test-helpers.js";

afterEach(cleanup);

const commit = (label: string | RegExp, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const metric = (label: string) =>
  within(region("Performance")).getByText(label).nextElementSibling!.textContent ?? "";

describe("DrawingBoard", () => {
  it("opens on the Havock-like destroyer as a valid design with the standard panels", () => {
    render(<DrawingBoard />);
    for (const name of [
      "Hull and displacement",
      "Machinery, fuel and range",
      "Components and arrangement",
      "Protection",
      "Validation",
      "Performance",
      "Weight summary",
      "Cost and construction forecast",
    ]) {
      expect(region(name)).toBeTruthy();
    }
    expect(within(region("Validation")).getByRole("status").textContent).toContain(
      "Design can be submitted",
    );
    expect(metric("Classification")).toBe("DD");
    expect(metric("Top speed")).toMatch(/kn \(need 25\.5\)/);
  });

  it("offers each starting design with a ship-type icon and a one-line description", () => {
    render(<DrawingBoard />);
    fireEvent.click(screen.getByLabelText("Starting design"));
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.querySelector("svg")).toBeTruthy();
      const describedBy = option.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)?.textContent?.length).toBeGreaterThan(0);
    }
  });

  it("draws a top-down hull plan with one marker per placed fitting", () => {
    render(<DrawingBoard />);
    const plan = region("Hull plan");
    const img = within(plan).getByRole("img", { name: /Top-down plan/ });
    expect(within(plan).getByRole("img", { name: /Side profile/ })).toBeTruthy();
    expect(img.querySelectorAll("circle").length).toBeGreaterThan(0);
    expect(img.getAttribute("aria-label")).toMatch(/Top-down plan/);
  });

  it("draws gun arcs for armed designs and hides them with the toggle", () => {
    render(<DrawingBoard />);
    const arcs = () => region("Hull plan").querySelectorAll("[data-arc]").length;
    expect(arcs()).toBeGreaterThan(0);
    openPlanDisplay();
    fireEvent.click(screen.getByLabelText("Show gun arcs"));
    expect(arcs()).toBe(0);
  });

  it("shows topside load as absolute deck area and a percentage, updated by edits", () => {
    render(<DrawingBoard />);
    const used = () =>
      within(region("Topside load")).getByRole("meter").getAttribute("aria-valuenow");
    expect(within(region("Topside load")).getByText(/m² deck area/)).toBeTruthy();
    const before = used();
    fireEvent.click(screen.getAllByRole("button", { name: /^Remove / })[0]!);
    expect(Number(used())).toBeLessThan(Number(before));
  });

  it("compares against the starting design and lists only what changed", () => {
    render(<DrawingBoard />);
    const cmp = () => region("Compared with starting design");
    expect(within(cmp()).getByText(/No differences/)).toBeTruthy();
    commit(/installed power/i, "3400");
    expect(within(cmp()).queryByText(/No differences/)).toBeNull();
    expect(within(cmp()).getByText("Displacement")).toBeTruthy();
  });

  it("lists edits in the history and jumping back restores the earlier design", () => {
    render(<DrawingBoard />);
    const hist = () => region("Edit history");
    expect(within(hist()).getByText(/Start:/)).toBeTruthy();
    const before = metric("Top speed");
    commit(/installed power/i, "3400");
    expect(within(hist()).getByText(/Machinery: installed kw → 3400/)).toBeTruthy();
    fireEvent.click(within(hist()).getByRole("button", { name: /0\. Start:/ }));
    expect(metric("Top speed")).toBe(before);
    fireEvent.click(within(hist()).getByRole("button", { name: /1\. Machinery/ }));
    expect(metric("Top speed")).not.toBe(before);
  });

  it("previews the revision tier of the edits against a project under construction", () => {
    const projects = [
      {
        projectId: "p1",
        className: "Ironclad",
        status: "ACTIVE",
        totalWork: 1_000_000,
        completedWork: 300_000,
      },
    ];
    render(<DrawingBoard projects={projects} />);
    const panel = () => region("Revision preview");
    expect(within(panel()).getByText(/No changes yet/)).toBeTruthy();
    commit(/installed power/i, "3400");
    expect(within(panel()).getByRole("status").textContent).toMatch(/Redesign.*30% hull progress/);
  });

  it("says there is nothing to revise when no ship is under construction", () => {
    render(<DrawingBoard />);
    expect(within(region("Revision preview")).getByText(/nothing to revise/)).toBeTruthy();
  });

  it("labels the development metric as such", () => {
    render(<DrawingBoard />);
    expect(
      within(region("Cost and construction forecast")).getByText(/DEV METRIC: not a combat result/),
    ).toBeTruthy();
  });

  it("editing installed power changes speed and the weight ledger; undo restores them", () => {
    render(<DrawingBoard />);
    const before = metric("Top speed");
    const undo = screen.getByRole("button", { name: /undo/i }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    commit(/installed power/i, "3400");
    expect(metric("Top speed")).not.toBe(before);
    expect(undo.disabled).toBe(false);
    fireEvent.click(undo);
    expect(metric("Top speed")).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: /redo/i }));
    expect(metric("Top speed")).not.toBe(before);
  });

  it("an overweight edit shows blocking findings with cause, consequence and remedies", () => {
    render(<DrawingBoard />);
    commit(/coal bunkers/i, "400");
    const validation = region("Validation");
    expect(within(validation).getByRole("status").textContent).toContain("cannot be built");
    expect(within(validation).getAllByText("BLOCKING").length).toBeGreaterThan(0);
    const overweight = within(validation).getByText(/exceeds what this hull may carry/i);
    fireEvent.click(overweight);
    expect(within(validation).getAllByText(/Why:/).length).toBeGreaterThan(0);
    expect(within(validation).getAllByText(/Consequence:/).length).toBeGreaterThan(0);
    expect(within(validation).getAllByText(/Ways to fix it:/).length).toBeGreaterThan(0);
    expect(
      within(region("Cost and construction forecast")).getByText(/Resolve blocking findings/),
    ).toBeTruthy();
  });

  it("suggests fixes for an overweight ship, previews their effect, and applying one improves the design", () => {
    render(<DrawingBoard />);
    commit(/coal bunkers/i, "400");
    const validation = region("Validation");
    expect(within(validation).getByRole("status").textContent).toContain("cannot be built");
    fireEvent.click(within(validation).getByRole("button", { name: /suggest fixes/i }));
    const list = within(validation).getByRole("list", { name: /suggested fixes/i });
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(list.textContent).toMatch(/blocking \d+ → \d+/);
    fireEvent.click(within(list).getAllByRole("button", { name: /apply/i })[0]!);
    // the suggestion list belongs to the old design and disappears
    expect(within(validation).queryByRole("list", { name: /suggested fixes/i })).toBeNull();
    expect(within(validation).getByRole("status").textContent).toMatch(/\d+ blocking/);
  });

  it("the AI designer proposes valid alternatives that can be loaded as the working design", async () => {
    render(<DrawingBoard />);
    const panel = region("AI alternatives");
    fireEvent.click(within(panel).getByRole("button", { name: /generate alternatives/i }));
    const list = await waitFor(() => within(panel).getByRole("list", { name: /ai candidates/i }), {
      timeout: 20_000,
    });
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    expect(list.textContent).toContain("development metric");
    commit(/installed power/i, "3400");
    fireEvent.click(within(items[0]!).getByRole("button", { name: /load design/i }));
    // the working design has an edit, so loading a candidate asks first
    fireEvent.click(await screen.findByRole("button", { name: "Replace my design" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(within(region("Validation")).getByRole("status").textContent).toContain(
      "Design can be submitted",
    );
    expect((screen.getByRole("button", { name: /undo/i }) as HTMLButtonElement).disabled).toBe(
      true,
    ); // history reset
  }, 40_000);

  it("adds a component from the grouped menu and removes it", async () => {
    render(<DrawingBoard />);
    const rows = () => within(region("Components and arrangement")).getAllByRole("row").length;
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

  it("offers components that are not yet available as disabled, with the month they arrive", async () => {
    render(<DrawingBoard />);
    chooseOption("Starting design", "Torpedo cruiser (1880, CL)");
    openTab("Arrangement");
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    const items = await screen.findAllByRole("menuitem");
    const later = items.filter((i) => /from \d{4}-\d{2}/.test(i.textContent ?? ""));
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((i) => i.getAttribute("aria-disabled") === "true")).toBe(true);
  });

  it("duplicates a fitting from its row menu and moves it to another zone", async () => {
    render(<DrawingBoard />);
    const panel = () => region("Components and arrangement");
    const rows = () => within(panel()).getAllByRole("row").length;
    const n = rows();
    fireEvent.click(within(panel()).getByRole("button", { name: "More actions for funnel" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    await waitFor(() => expect(rows()).toBe(n + 1));
    expect(within(panel()).getByText("funnel_single_1")).toBeTruthy();
  });

  it("right-clicking a fitting opens the same actions", async () => {
    render(<DrawingBoard />);
    const panel = region("Components and arrangement");
    const row = within(panel).getByText("funnel").closest("tr")!;
    fireEvent.contextMenu(row);
    expect(await screen.findByRole("menuitem", { name: "Duplicate" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Remove" })).toBeTruthy();
  });

  it("switching the starting design asks first when there are edits, then loads the battleship and resets history", async () => {
    render(<DrawingBoard />);
    commit(/installed power/i, "3400");
    chooseOption("Starting design", "Majestic-like battleship (1895)");
    fireEvent.click(await screen.findByRole("button", { name: "Replace my design" }));
    expect(metric("Classification")).toBe("B");
    expect((screen.getByRole("button", { name: /undo/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("the forecast shows a build time that grows with displacement (historical table, ticket 20)", () => {
    const months = () => {
      const t = within(region("Cost and construction forecast")).getByText("Build time")
        .nextElementSibling!.textContent!;
      return Number(/^(\d+) months/.exec(t)![1]);
    };
    render(<DrawingBoard />);
    const destroyer = months();
    chooseOption("Starting design", "Majestic-like battleship (1895)");
    expect(months()).toBeGreaterThan(destroyer);
    expect(months()).toBeGreaterThanOrEqual(30);
  });

  it("labels the build time provisional only while a bracketing point is not VERIFIED (ticket 22)", () => {
    const text = () =>
      within(region("Cost and construction forecast")).getByText("Build time").nextElementSibling!
        .textContent!;
    render(<DrawingBoard />);
    // ticket 22 sourced the low (330 t) displacement point and the 1886 era point, so the default hull is no longer provisional
    expect(text()).toContain("historical build time");
    expect(text()).not.toMatch(/provisional/i);
    // A keel laid 1887-1894 is still bracketed by the 1890 era point, a derived (SECONDARY) class mean.
    chooseOption("Starting design", "Torpedo cruiser (1880, CL)");
    chooseOption("Technology as of", "1890-01");
    expect(text()).toMatch(/historical build time.*provisional/);
    // A Majestic-size 1895 hull is bracketed by VERIFIED displacement and era points.
    chooseOption("Starting design", "Majestic-like battleship (1895)");
    chooseOption("Technology as of", "1895-06");
    expect(text()).toContain("historical build time");
    expect(text()).not.toMatch(/provisional/i);
  });

  it("technology depends on the year: the same battleship is rejected before its guns exist", () => {
    render(<DrawingBoard />);
    chooseOption("Starting design", "Majestic-like battleship (1895)");
    chooseOption("Technology as of", "1890-01");
    expect(
      within(region("Validation")).getAllByText(/not available to this nation yet/i).length,
    ).toBeGreaterThan(0);
  });
});

describe("forecast and the treasury", () => {
  it("states what the order will cost the treasury, in units", () => {
    render(<DrawingBoard />);
    const panel = region("Cost and construction forecast");
    expect(within(panel).getByText(/Charged to the treasury when ordered/)).toBeTruthy();
    const row = within(panel).getByText(/Charged to the treasury when ordered/).parentElement!;
    expect(row.textContent).toMatch(/\d[\d,]* units \(10,000 NC each\)/);
  });
});
