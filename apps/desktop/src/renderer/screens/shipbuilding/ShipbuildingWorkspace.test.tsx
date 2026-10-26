import { cleanup, fireEvent, render, screen, within, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

afterEach(cleanup);

const commands = () => screen.getByRole("group", { name: "Design commands" });
const statusBar = () => screen.getByRole("region", { name: "Engineering status" });
const statusOf = (id: string) =>
  statusBar().querySelector<HTMLElement>(`[data-status="${id}"]`)?.textContent ?? "";
const commit = (label: string | RegExp, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};
const openMap = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Design map" })).getByRole("button", {
      name: new RegExp(name),
    }),
  );

describe("Shipbuilding workspace shell", () => {
  it("lays out a command bar, design map, ship view, inspector and engineering strip", () => {
    render(<ShipbuildingWorkspace />);
    expect(commands()).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Design map" })).toBeTruthy();
    const ship = screen.getByRole("region", { name: "Ship view" });
    expect(within(ship).getByRole("img", { name: /Top-down plan/ })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: /^Inspector/ })).toBeTruthy();
    expect(statusBar()).toBeTruthy();
  });

  it("keeps ordinary ship parameters out of the command bar", () => {
    render(<ShipbuildingWorkspace />);
    const inputs = within(commands()).queryAllByRole("textbox");
    expect(inputs.map((i) => i.getAttribute("aria-label"))).toEqual(["Class name"]);
    expect(within(commands()).queryAllByRole("spinbutton")).toEqual([]);
    for (const name of [
      "Undo",
      "Redo",
      "Compare",
      "More design actions",
      "Validate",
      "Finish design",
    ])
      expect(within(commands()).getByRole("button", { name: new RegExp(name) })).toBeTruthy();
  });

  it("shows the compiled validity, displacement and cost", () => {
    render(<ShipbuildingWorkspace />);
    const content = loadDrawingBoardContent();
    const ref = content.references[0]!;
    const view = buildWorkshopView(
      ref.draft,
      content.environmentFor(ref.month, ref.draft.nationId),
    );
    expect(statusOf("displacement")).toContain(
      Math.round(view.totalKg / 1000).toLocaleString("en-US"),
    );
    expect(statusOf("displacement")).toContain(
      Math.round(view.buoyantKg / 1000).toLocaleString("en-US"),
    );
    expect(statusOf("cost")).toContain(
      `${Math.round(view.forecast.costMicro / 1_000_000).toLocaleString("en-US")} NC`,
    );
    expect(
      within(screen.getByRole("navigation", { name: "Design map" })).getByRole("status")
        .textContent,
    ).toContain(view.valid ? "Can be submitted" : "Cannot be built");
  });

  it("edits the hull from the inspector, updates the strip, and undoes the edit", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Hull");
    const before = statusOf("displacement");
    commit(/^Length \(waterline\)/, "120");
    expect(statusOf("displacement")).not.toBe(before);
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect(statusOf("displacement")).toBe(before);
    fireEvent.click(within(commands()).getByRole("button", { name: "Redo" }));
    expect(statusOf("displacement")).not.toBe(before);
  });

  it("edits the machinery and undoes it with the keyboard shortcut", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Machinery");
    const power = screen.getByLabelText(/^Installed power/) as HTMLInputElement;
    const original = power.value;
    commit(/^Installed power/, "1000");
    expect((screen.getByLabelText(/^Installed power/) as HTMLInputElement).value).not.toBe(
      original,
    );
    fireEvent.keyDown(screen.getByTestId("shipbuilding-workspace"), { key: "z", ctrlKey: true });
    expect((screen.getByLabelText(/^Installed power/) as HTMLInputElement).value).toBe(original);
  });

  it("sends Validate and Finish to the Review section", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(within(commands()).getByRole("button", { name: /Validate/ }));
    expect(screen.getByRole("complementary", { name: "Inspector: Review" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Validation" })).toBeTruthy();
  });

  it("offers no save control: drafts autosave, and outside a campaign there is nowhere to save", () => {
    render(<ShipbuildingWorkspace />);
    expect(within(commands()).queryByRole("button", { name: /Save/ })).toBeNull();
    expect(within(commands()).queryByText("Autosaved")).toBeNull();
  });

  it("replaces the ship type select with a reference-design button that keeps the type visible", () => {
    render(<ShipbuildingWorkspace />);
    expect(within(commands()).queryByRole("combobox", { name: /Ship type/ })).toBeNull();
    const button = within(commands()).getByRole("button", {
      name: /Start from a reference design/,
    });
    expect(within(button).getByLabelText(/^Current type /)).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Start from a reference design" })).toBeTruthy();
  });

  it("groups the overflow menu and no longer lists the reference design there", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(within(commands()).getByRole("button", { name: /More design actions/ }));
    for (const group of ["Design", "File", "Danger zone"])
      expect(screen.getByText(group)).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Start from a reference design/ })).toBeNull();
  });

  it("flags an unnamed design in a campaign and sends Finish to the class name", () => {
    render(<ShipbuildingWorkspace sessionId="s1" />);
    const status = within(screen.getByRole("navigation", { name: "Design map" })).getByRole(
      "status",
    );
    expect(status.textContent).toContain("Needs a class name");
    fireEvent.click(within(commands()).getByRole("button", { name: /Finish design/ }));
    expect(document.activeElement).toBe(within(commands()).getByLabelText("Class name"));
    fireEvent.change(within(commands()).getByLabelText("Class name"), {
      target: { value: "Test class" },
    });
    expect(
      within(screen.getByRole("navigation", { name: "Design map" })).getByRole("status")
        .textContent,
    ).not.toContain("Needs a class name");
  });
});

describe("Design map and inspector routing", () => {
  const map = () => screen.getByRole("navigation", { name: "Design map" });
  const inspector = () => screen.getByRole("complementary", { name: /^Inspector/ });
  const localTabs = () => within(inspector()).getByRole("tablist", { name: /tabs$/ });
  const openTab = (name: string) => fireEvent.click(within(localTabs()).getByRole("tab", { name }));

  it("lists the seven sections, each announcing its status", () => {
    render(<ShipbuildingWorkspace />);
    const names = within(map())
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((n) => n !== "Suggest a class name" && n !== "Browse class names");
    expect(names.map((n) => n.split(",")[0])).toEqual([
      "Overview",
      "Hull",
      "Machinery",
      "Protection",
      "Armament",
      "Systems",
      "Review",
    ]);
    for (const n of names)
      expect(n).toMatch(/, (valid|\d+ warnings?|\d+ unresolved issues?|not configured)$/);
  });

  it("gives every section two to four local tabs in one flat row, and swaps them with the section", () => {
    render(<ShipbuildingWorkspace />);
    for (const section of [
      "Overview",
      "Hull",
      "Machinery",
      "Protection",
      "Armament",
      "Systems",
      "Review",
    ]) {
      openMap(section);
      expect(screen.getByRole("complementary", { name: `Inspector: ${section}` })).toBeTruthy();
      expect(within(inspector()).getAllByRole("tablist")).toHaveLength(1);
      const tabs = within(localTabs()).getAllByRole("tab");
      expect(tabs.length).toBeGreaterThanOrEqual(2);
      expect(tabs.length).toBeLessThanOrEqual(4);
    }
  });

  it("swaps the inspector content with the local tab", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Hull");
    expect(screen.getByRole("region", { name: "Hull and displacement" })).toBeTruthy();
    openTab("Stability");
    expect(screen.queryByRole("region", { name: "Hull and displacement" })).toBeNull();
    expect(screen.getByRole("region", { name: "Topside load" })).toBeTruthy();
  });

  it("lists only the tab's own fittings under Armament", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Armament");
    const rows = () =>
      within(screen.getByRole("region", { name: /fittings$/ }))
        .getAllByRole("rowheader")
        .map((r) => r.textContent ?? "");
    openTab("Secondary");
    expect(rows().map((r) => r.match(/gun_\w+/)?.[0])).toEqual([
      "gun_12pdr",
      "gun_6pdr_a",
      "gun_6pdr_b",
    ]);
    openTab("Torpedoes");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatch(/tubes/);
  });

  it("still edits the draft from a relocated editor, with undo", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Protection");
    openTab("Magazines");
    const before = statusOf("displacement");
    const region = screen.getByRole("region", { name: /Magazines/ });
    fireEvent.click(within(region).getAllByRole("button", { name: /^Remove / })[0]!);
    expect(statusOf("displacement")).not.toBe(before);
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect(statusOf("displacement")).toBe(before);
  });

  it("renders a tab with nothing available as not configured rather than failing", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Systems");
    openTab("Aviation");
    expect(within(inspector()).getByText(/not available/i)).toBeTruthy();
  });

  it("sends Finish to the Review section's Finish tab", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(within(commands()).getByRole("button", { name: /Finish design/ }));
    const finish = within(localTabs()).getByRole("tab", { name: "Finish" });
    expect(finish.getAttribute("aria-selected")).toBe("true");
  });

  it("reaches the rebuild surface from the Review section", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Review");
    openTab("Rebuild");
    expect(within(inspector()).getByText(/open a campaign to rebuild/i)).toBeTruthy();
  });

  it("offers 'Rebuild a completed ship' from the design actions menu", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(within(commands()).getByRole("button", { name: /More design actions/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Rebuild a completed ship/ }));
    expect(
      within(localTabs()).getByRole("tab", { name: "Rebuild" }).getAttribute("aria-selected"),
    ).toBe("true");
  });
});

describe("Central ship workspace views and overlays", () => {
  const ship = () => screen.getByRole("region", { name: "Ship view" });
  const viewGroup = () => within(ship()).getByRole("group", { name: "Ship view" });
  const openLayers = () => {
    if (!screen.queryByRole("group", { name: "Overlays" }))
      fireEvent.click(within(ship()).getByRole("button", { name: /^Layers/ }));
  };
  const overlays = () => {
    openLayers();
    return screen.getByRole("group", { name: "Overlays" });
  };
  const viewButton = (name: string) => within(viewGroup()).getByRole("button", { name });
  const overlay = (name: string) => within(overlays()).getByRole("checkbox", { name });
  const plan = () => screen.queryByRole("img", { name: /^Top-down plan/ });

  it("switches the drawing among the five views", () => {
    render(<ShipbuildingWorkspace />);
    for (const name of ["Top", "Side", "Armour", "Compartments", "Firing arcs"])
      expect(viewButton(name)).toBeTruthy();
    expect(viewButton("Top").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(viewButton("Side"));
    expect(plan()).toBeNull();
    expect(screen.getByRole("img", { name: /^Side profile/ })).toBeTruthy();
    fireEvent.click(viewButton("Top"));
    expect(plan()).not.toBeNull();
  });

  it("reaches the plan tools only from the plan's context menu, not from buttons or P and M", async () => {
    render(<ShipbuildingWorkspace />);
    expect(screen.queryByRole("group", { name: "Plan tools" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Place on plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move on plan" })).toBeNull();
    const workspace = screen.getByTestId("shipbuilding-workspace");
    fireEvent.keyDown(workspace, { key: "m" });
    fireEvent.keyDown(workspace, { key: "p" });
    expect(screen.queryByTestId("plan-click-layer")).toBeNull();
    fireEvent.contextMenu(screen.getByRole("group", { name: /^Ship plan/ }));
    expect(await screen.findByRole("menuitem", { name: "Place" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Move" })).toBeTruthy();
  });

  it("suggests class names from the nation's list for the ship type, one after another", () => {
    render(<ShipbuildingWorkspace />);
    const name = () => (within(commands()).getByLabelText("Class name") as HTMLInputElement).value;
    expect(name()).toBe("");
    const suggest = screen.getByRole("button", { name: "Suggest a class name" });
    fireEvent.click(suggest);
    const first = name();
    expect(first).not.toBe("");
    fireEvent.click(suggest);
    expect(name()).not.toBe(first);
  });

  it("opens a list of the nation's names and fills the class name from the one chosen", async () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Browse class names" }));
    const dialog = await screen.findByRole("dialog", { name: "Class names" });
    const pick = within(dialog).getAllByRole("button", { pressed: false })[0]!;
    const chosen = pick.textContent!;
    fireEvent.click(pick);
    expect(screen.queryByRole("dialog", { name: "Class names" })).toBeNull();
    expect((within(commands()).getByLabelText("Class name") as HTMLInputElement).value).toBe(
      chosen,
    );
  });

  it("points an empty battery at controls this workspace has, not at a panel it lacks", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Armament");
    const inspector = screen.getByRole("complementary", { name: /^Inspector/ });
    expect(within(inspector).getByText(/right-click the ship plan and choose Place/)).toBeTruthy();
    expect(within(inspector).queryByText(/Components and arrangement/)).toBeNull();
  });

  it("shows the designing nation's identity in the reference-design browser", async () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /^Start from a reference design/ }));
    const dialog = await screen.findByRole("dialog", { name: "Start from a reference design" });
    expect(within(dialog).getByText("National identity")).toBeTruthy();
  });

  it("adds and removes the magazine box with one checkbox, as the existing armour region", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Protection");
    const box = () => screen.getByRole("checkbox", { name: "Magazine box" });
    const hadBox = box().getAttribute("aria-checked") === "true";
    fireEvent.click(box());
    expect(box().getAttribute("aria-checked")).toBe(String(!hadBox));
    const region = screen.queryByLabelText(/Thickness of MAGAZINE_BOX/);
    expect(region !== null).toBe(!hadBox);
    fireEvent.click(box());
    expect(box().getAttribute("aria-checked")).toBe(String(hadBox));
  });

  it("does not offer an aluminium superstructure at the dates the standalone designer covers", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Hull");
    expect(screen.queryByRole("checkbox", { name: "Aluminium superstructure" })).toBeNull();
  });

  it("does not offer an AA fit at the dates the standalone designer covers", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Armament");
    fireEvent.click(screen.getByRole("tab", { name: "Other" }));
    expect(screen.queryByLabelText("AA directors")).toBeNull();
  });

  it("controls the overlays independently, and no view turns them all on", () => {
    render(<ShipbuildingWorkspace />);
    expect(overlay("Turret arcs").getAttribute("aria-checked")).toBe("true");
    expect(overlay("Component footprint").getAttribute("aria-checked")).toBe("true");
    expect(overlay("Armour zones").getAttribute("aria-checked")).toBe("false");
    expect(overlay("Centre of mass").getAttribute("aria-checked")).toBe("false");

    fireEvent.click(overlay("Centre of mass"));
    expect(overlay("Centre of mass").getAttribute("aria-checked")).toBe("true");
    expect(overlay("Turret arcs").getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector("[data-testid='mass-cg']")).not.toBeNull();

    fireEvent.click(overlay("Turret arcs"));
    expect(plan()!.querySelectorAll("[data-arc]")).toHaveLength(0);
    fireEvent.click(viewButton("Armour"));
    expect(overlay("Armour zones").getAttribute("aria-checked")).toBe("true");
    expect(overlay("Turret arcs").getAttribute("aria-checked")).toBe("false");

    const boxes = within(overlays()).getAllByRole("checkbox");
    expect(boxes.filter((b) => b.getAttribute("aria-checked") === "true").length).toBeLessThan(
      boxes.length,
    );
  });
});

describe("Selection synchronization", () => {
  const ship = () => screen.getByRole("region", { name: "Ship view" });
  const fittings = () => within(ship()).getByRole("toolbar", { name: "Fittings on the plan" });
  const fittingTarget = (id: string) =>
    fittings().querySelector<SVGGElement>(`[data-target="${id}"]`)!;
  const localTabs = () =>
    within(screen.getByRole("complementary", { name: /^Inspector/ })).getByRole("tablist", {
      name: /tabs$/,
    });

  it("opens the matching section, local tab and editor when a fitting on the ship is clicked", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(fittingTarget("gun_12pdr"));
    expect(screen.getByRole("complementary", { name: "Inspector: Armament" })).toBeTruthy();
    expect(
      within(localTabs()).getByRole("tab", { name: "Secondary" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByTestId("selection-banner").textContent).toMatch(/Selected on ship/);
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toMatch(
      /^Select mount /,
    );

    fireEvent.click(fittingTarget("mag_fwd"));
    expect(screen.getByRole("complementary", { name: "Inspector: Protection" })).toBeTruthy();
    expect(
      within(localTabs()).getByRole("tab", { name: "Magazines" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("does not steal focus back when the inspector focus moves to another element", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(fittingTarget("gun_12pdr"));
    const mounts = within(screen.getByRole("region", { name: "Batteries" })).getAllByRole(
      "button",
      { name: /^Select mount / },
    );
    const other = mounts.find((b) => b !== document.activeElement);
    expect(other).toBeTruthy();
    act(() => other!.focus());
    expect(document.activeElement).toBe(other);
  });

  it("highlights the element on the ship when it is selected in the inspector", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Armament");
    fireEvent.click(within(localTabs()).getByRole("tab", { name: "Secondary" }));
    const battery = screen.getByRole("region", { name: "Batteries" });
    const mount = within(battery).getAllByRole("button", { name: /^Select mount / })[0]!;
    fireEvent.click(mount);
    expect(fittingTarget("gun_12pdr").getAttribute("aria-pressed")).toBe("true");
    expect(fittingTarget("gun_12pdr").getAttribute("data-state")).toBe("selected");
    expect(fittings().querySelector("[data-testid='fitting-selected-ring']")).not.toBeNull();
    expect(plan()!.querySelectorAll("[data-highlight]").length).toBeGreaterThan(0);
  });

  function plan() {
    return screen.getByRole("img", { name: /^Top-down plan/ });
  }
});

describe("Armament master-detail editor", () => {
  const battery = () => screen.getByRole("region", { name: "Batteries" });
  const mountButtons = () => within(battery()).getAllByRole("button", { name: /^Select mount / });
  const openSecondary = () => {
    openMap("Armament");
    const tabs = within(screen.getByRole("complementary", { name: /^Inspector/ })).getByRole(
      "tablist",
      { name: /tabs$/ },
    );
    fireEvent.click(within(tabs).getByRole("tab", { name: "Secondary" }));
  };

  it("opens a selected mount's editor with its editable properties and readouts", () => {
    render(<ShipbuildingWorkspace />);
    openSecondary();
    expect(mountButtons().length).toBeGreaterThan(0);
    const chosen = mountButtons()[0]!;
    fireEvent.click(chosen);
    expect(chosen.getAttribute("aria-pressed")).toBe("true");
    expect(within(battery()).getByLabelText(/^Barrel count/)).toBeTruthy();
    expect(within(battery()).getByLabelText(/^Ammunition per gun/)).toBeTruthy();
    expect(within(battery()).getByLabelText(/^Zone/)).toBeTruthy();
    expect(within(battery()).getByLabelText(/^Station/)).toBeTruthy();
    expect(within(battery()).getByLabelText(/^Side/)).toBeTruthy();
    expect(within(battery()).getByText("Mount type")).toBeTruthy();
    expect(within(battery()).getByText(/Placement conflicts/)).toBeTruthy();
  });

  it("commits a mount position edit to the draft and undoes it", () => {
    render(<ShipbuildingWorkspace />);
    openSecondary();
    fireEvent.click(mountButtons()[0]!);
    const field = within(battery()).getByLabelText(/^Station/) as HTMLInputElement;
    const original = field.value;
    const next = String(Number(original) + 10);
    fireEvent.change(field, { target: { value: next } });
    fireEvent.blur(field);
    expect((within(battery()).getByLabelText(/^Station/) as HTMLInputElement).value).toBe(next);
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect((within(battery()).getByLabelText(/^Station/) as HTMLInputElement).value).toBe(original);
  });

  it("duplicates a mount on demand, updating the displacement, and undoes it", () => {
    render(<ShipbuildingWorkspace />);
    openSecondary();
    fireEvent.click(mountButtons()[0]!);
    const before = statusOf("displacement");
    const count = mountButtons().length;
    fireEvent.click(within(battery()).getByRole("button", { name: "Duplicate" }));
    expect(mountButtons().length).toBe(count + 1);
    expect(statusOf("displacement")).not.toBe(before);
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect(statusOf("displacement")).toBe(before);
  });
});

describe("Systems section", () => {
  const openSystemTab = (name: string) => {
    openMap("Systems");
    const tabs = within(screen.getByRole("complementary", { name: /^Inspector/ })).getByRole(
      "tablist",
      { name: /tabs$/ },
    );
    fireEvent.click(within(tabs).getByRole("tab", { name }));
  };
  const panel = () => screen.getByRole("region", { name: "Systems" });

  it("gates installations by technology, with the unavailable filter off by default", () => {
    render(<ShipbuildingWorkspace />);
    openSystemTab("Accommodation");
    const filter = within(panel()).getByRole("checkbox", { name: "Show unavailable technology" });
    expect(filter.getAttribute("aria-checked") ?? filter.getAttribute("data-state")).toMatch(
      /false|unchecked/,
    );
    expect(within(panel()).getAllByRole("button", { name: /^Add / }).length).toBeGreaterThan(0);
  });

  it("fits colonial service on the Accommodation tab, states the production displacement share (ADR-0266), and undoes it", () => {
    render(<ShipbuildingWorkspace />);
    openSystemTab("Accommodation");
    const colonial = () => screen.getByRole("region", { name: "Colonial service" });
    const before = statusOf("displacement");
    fireEvent.click(within(colonial()).getByRole("checkbox", { name: "Fit for colonial service" }));
    expect(within(colonial()).getByText(/15\.00%/)).toBeTruthy();
    expect(statusOf("displacement")).not.toBe(before);
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect(within(colonial()).getByText("Not fitted for colonial service.")).toBeTruthy();
  });

  it("adds an available installation and undoes it", () => {
    render(<ShipbuildingWorkspace />);
    openSystemTab("Accommodation");
    const before = statusOf("displacement");
    fireEvent.click(within(panel()).getAllByRole("button", { name: /^Add / })[0]!);
    expect(statusOf("displacement")).not.toBe(before);
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect(statusOf("displacement")).toBe(before);
  });

  it("reveals locked technology with a reason when the filter is turned on", () => {
    render(<ShipbuildingWorkspace />);
    openSystemTab("Fire control");
    const filter = within(panel()).getByRole("checkbox", { name: "Show unavailable technology" });
    expect(within(panel()).queryAllByText(/Unavailable until/)).toHaveLength(0);
    fireEvent.click(filter);
    expect(within(panel()).getAllByText(/Unavailable until|Requires /).length).toBeGreaterThan(0);
  });
});

describe("Review section", () => {
  const validation = () => screen.getByRole("region", { name: "Validation" });

  it("groups findings into blocking, warning and advisory classes", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Review");
    const classes = ["Blocking errors", "Warnings", "Advisory observations"];
    const present = classes.filter((n) => within(validation()).queryByRole("region", { name: n }));
    expect(present.length).toBeGreaterThan(0);
    const all = validation().querySelectorAll("[data-finding-key]").length;
    const grouped = classes.reduce(
      (n, name) =>
        n +
        (within(validation())
          .queryByRole("region", { name })
          ?.querySelectorAll("[data-finding-key]").length ?? 0),
      0,
    );
    expect(grouped).toBe(all);
    expect(all).toBeGreaterThan(0);
  });

  it("reaches finish from the Review section", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Review");
    const inspector = screen.getByRole("complementary", { name: /^Inspector/ });
    const tabs = within(inspector).getByRole("tablist", { name: /tabs$/ });
    fireEvent.click(within(tabs).getByRole("tab", { name: "Finish" }));
    expect(within(tabs).getByRole("tab", { name: "Finish" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(within(inspector).getByText(/Finishing: not available/)).toBeTruthy();
  });
});

describe("Overview summary section", () => {
  const panel = () => screen.getByRole("region", { name: "Overview" });

  it("shows a design summary and the same warnings as Review", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Overview");
    const summary = within(panel()).getByTestId("overview-summary").textContent ?? "";
    for (const label of [
      "Type and role",
      "Displacement",
      "Cost",
      "Armour",
      "Main armament",
      "Crew",
    ])
      expect(summary).toContain(label);
    const warnings = within(panel()).getByRole("region", { name: "Design warnings" });
    expect(warnings.textContent).toMatch(/blocking/i);
    expect(within(warnings).getByText(/Advisories never prevent submission/)).toBeTruthy();
  });

  it("records design priorities without modifying the design", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Overview");
    const before = statusOf("displacement");
    const priorities = within(panel()).getByRole("region", { name: "Design priorities" });
    for (const label of ["Speed", "Protection", "Firepower", "Range", "Cost"])
      expect(within(priorities).getByLabelText(`${label} priority`)).toBeTruthy();
    expect(within(priorities).getAllByText("Normal").length).toBe(5);
    expect(within(priorities).getByText(/does not modify the design/)).toBeTruthy();
    expect(statusOf("displacement")).toBe(before);
  });
});

describe("Machinery outcomes-first section", () => {
  const panel = () => screen.getByRole("region", { name: "Machinery, fuel and range" });

  it("shows editable targets and configuration beside calculated results", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Machinery");
    const config = within(panel()).getByRole("region", { name: "Propulsion configuration" });
    const results = within(panel()).getByRole("region", { name: "Calculated results" });
    for (const label of [
      /^Target speed/,
      /^Cruising speed/,
      /^Range/,
      /^Installed power/,
      /^Fuel capacity/,
    ])
      expect(within(config).getByLabelText(label)).toBeTruthy();
    expect(within(results).queryAllByRole("spinbutton")).toHaveLength(0);
    const outputs = within(results).getByTestId("machinery-outputs").textContent ?? "";
    expect(outputs).toMatch(/Power required at target speed/);
    expect(outputs).toMatch(/Machinery weight/);
    expect(outputs).toMatch(/Reliability/);
  });

  it("previews what an alternative plant would change, without committing it", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(screen.getByRole("combobox", { name: "Technology as of" }));
    fireEvent.click(screen.getByRole("option", { name: "1885-01" }));
    openMap("Machinery");
    const before = statusOf("displacement");
    fireEvent.click(within(panel()).getByRole("combobox", { name: "Propulsion plant" }));
    const alternative = document.querySelector(
      '[role="option"][data-value="triple_expansion_cylindrical"]',
    )!;
    fireEvent.pointerMove(alternative);
    const preview = within(panel()).getByTestId("delta-preview");
    expect(preview.textContent).toMatch(/Reliability/);
    expect(preview.textContent).toMatch(/Required/);
    expect(preview.textContent).toMatch(/1885-01/);
    expect(statusOf("displacement")).toBe(before);
  });

  it("keeps the supporting fuel detail behind a closed Advanced disclosure", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Machinery");
    const fuel = within(panel()).getByLabelText(/^Fuel capacity/);
    const details = fuel.closest("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
  });

  it("resets a target to the recommended value", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Machinery");
    const speed = () => screen.getByLabelText(/^Target speed/) as HTMLInputElement;
    const original = speed().value;
    expect(
      within(panel()).queryByRole("button", { name: "Reset Target speed to recommended" }),
    ).toBeNull();
    commit(/^Target speed/, "20");
    expect(speed().value).not.toBe(original);
    fireEvent.click(
      within(panel()).getByRole("button", { name: "Reset Target speed to recommended" }),
    );
    expect(speed().value).toBe(original);
  });
});

describe("Engineering status strip", () => {
  const strip = () => screen.getByRole("region", { name: "Engineering status" });
  const item = (id: string) => strip().querySelector<HTMLElement>(`[data-status="${id}"]`)!;
  const trigger = (id: string) => item(id).querySelector<HTMLElement>("button, a")!;

  it("shows displacement, cost, speed, range, stability, topside load and warnings", () => {
    render(<ShipbuildingWorkspace />);
    for (const id of [
      "displacement",
      "cost",
      "speed",
      "range",
      "stability",
      "topside",
      "remaining",
      "warnings",
    ])
      expect(item(id)).toBeTruthy();
    expect(item("displacement").getAttribute("data-tone")).toBe("neutral");
    expect(item("warnings").getAttribute("data-tone")).toBe("warn");
  });

  it("opens a weight breakdown, whose groups add up to current, on clicking displacement", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(trigger("displacement"));
    const title = screen.getByText("Weight breakdown");
    const body = title.closest<HTMLElement>("[data-open]")!;
    expect(within(body).getByText("Hull")).toBeTruthy();
    expect(within(body).getByText("Machinery")).toBeTruthy();
    expect(within(body).getByText("Current")).toBeTruthy();
    expect(within(body).getByText("Capacity")).toBeTruthy();
    expect(within(body).getByText("Remaining")).toBeTruthy();
  });

  it("opens a cost breakdown on clicking cost", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(trigger("cost"));
    const body = screen.getByText("Cost breakdown").closest<HTMLElement>("[data-open]")!;
    expect(within(body).getByText("Hull")).toBeTruthy();
    expect(within(body).getByText("Total")).toBeTruthy();
  });

  it("opens the stability causes on clicking stability", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(trigger("stability"));
    const body = screen.getByText("Stability causes").closest<HTMLElement>("[data-open]")!;
    expect(within(body).getByText("GM")).toBeTruthy();
  });

  it("distinguishes committed from reserved weight when available weight is hovered", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.mouseEnter(trigger("remaining"));
    const body = screen.getByText("Available weight").closest<HTMLElement>("[data-open]")!;
    expect(within(body).getByText("Committed")).toBeTruthy();
    expect(within(body).getByText("Reserved")).toBeTruthy();
    expect(within(body).getByText("Free")).toBeTruthy();
  });
});

describe("Inspector layout", () => {
  const workspace = () => screen.getByTestId("shipbuilding-workspace");
  const grid = () => screen.getByTestId("workspace-grid");
  const handle = () => screen.getByRole("separator", { name: "Resize inspector" });
  const width = () => grid().style.getPropertyValue("--inspector-width");

  it("opens the inspector at the default width, with a resize handle", () => {
    render(<ShipbuildingWorkspace />);
    expect(width()).toBe("440px");
    expect(handle().getAttribute("aria-valuenow")).toBe("440");
  });

  it("resizes the inspector from the keyboard, within bounds", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(width()).toBe("456px");
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(width()).toBe("440px");
    fireEvent.keyDown(handle(), { key: "End" });
    expect(width()).toBe("560px");
    fireEvent.keyDown(handle(), { key: "Home" });
    expect(width()).toBe("360px");
    fireEvent.keyDown(handle(), { key: "Enter" });
    expect(width()).toBe("440px");
  });

  it("collapses and restores the inspector with the keyboard shortcut", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.keyDown(workspace(), { key: "b", metaKey: true });
    expect(width()).toBe("36px");
    expect(screen.getByRole("button", { name: "Show inspector" })).toBeTruthy();
    expect(screen.queryByRole("separator", { name: "Resize inspector" })).toBeNull();
    expect(screen.queryByRole("tablist", { name: /tabs$/ })).toBeNull();

    fireEvent.keyDown(workspace(), { key: "b", metaKey: true });
    expect(width()).toBe("440px");
    expect(screen.getByRole("button", { name: "Hide inspector" })).toBeTruthy();
    expect(screen.queryByRole("separator", { name: "Resize inspector" })).not.toBeNull();
  });

  it("restores the inspector from the collapsed strip's button", () => {
    render(<ShipbuildingWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Hide inspector" }));
    fireEvent.click(screen.getByRole("button", { name: "Show inspector" }));
    expect(screen.getByRole("complementary", { name: /^Inspector/ })).toBeTruthy();
    expect(width()).toBe("440px");
  });
});

describe("Protection armour section", () => {
  const panel = () => screen.getByRole("region", { name: "Protection" });

  it("groups a fitted region spatially and shows its compiled readouts", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Protection");
    expect(within(panel()).getByText(/No armour fitted/)).toBeTruthy();
    fireEvent.click(within(panel()).getByRole("button", { name: "Add region" }));
    expect(within(panel()).getByRole("region", { name: "Belt" })).toBeTruthy();
    expect(
      within(panel()).getByRole("button", { name: "Select Main belt on the ship" }),
    ).toBeTruthy();
    for (const label of [
      "Thickness",
      "Length coverage",
      "Weight",
      "Protected area",
      "Effectiveness",
    ])
      expect(within(panel()).getByText(label)).toBeTruthy();
  });

  it("edits a region's thickness, updating the compiled displacement, and undoes it", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Protection");
    fireEvent.click(within(panel()).getByRole("button", { name: "Add region" }));
    const before = statusOf("displacement");
    commit(/^Thickness of BELT_MAIN/, "200");
    expect(statusOf("displacement")).not.toBe(before);
    fireEvent.click(within(commands()).getByRole("button", { name: "Undo" }));
    expect(statusOf("displacement")).toBe(before);
  });

  it("highlights the selected armour region on the ship plan", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Protection");
    fireEvent.click(within(panel()).getByRole("button", { name: "Add region" }));
    fireEvent.click(within(panel()).getByRole("button", { name: "Select Main belt on the ship" }));
    const highlight = document.querySelector("[data-testid='armour-highlight']");
    expect(highlight).not.toBeNull();
    expect(highlight!.getAttribute("data-region")).toBe("BELT_MAIN");
  });

  it("keeps the specialist armour fields behind a closed Advanced disclosure", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Protection");
    fireEvent.click(within(panel()).getByRole("button", { name: "Add region" }));
    const details = within(panel()).getByText("Advanced").closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByLabelText(/^Material of/)).toBeTruthy();
  });

  it("resets an armour region's thickness to the recommended starting plate", () => {
    render(<ShipbuildingWorkspace />);
    openMap("Protection");
    fireEvent.click(within(panel()).getByRole("button", { name: "Add region" }));
    const thickness = () => screen.getByLabelText(/^Thickness of BELT_MAIN/) as HTMLInputElement;
    const original = thickness().value;
    commit(/^Thickness of BELT_MAIN/, "300");
    expect(thickness().value).not.toBe(original);
    fireEvent.click(
      within(panel()).getByRole("button", {
        name: "Reset Thickness of BELT_MAIN to recommended",
      }),
    );
    expect(thickness().value).toBe(original);
  });
});
