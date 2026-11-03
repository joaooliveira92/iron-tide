import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ShipbuildingWorkspace } from "./ShipbuildingWorkspace.js";

const S = vi.hoisted(() => {
  const spies: Record<string, { calls: unknown[][] }> = {};
  const wrap = (mock: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...mock };
    for (const [name, value] of Object.entries(mock)) {
      if (typeof value !== "function") continue;
      const fn = value as (...args: unknown[]) => unknown;
      const spy = spies[name] ?? { calls: [] };
      spies[name] = spy;
      out[name] = (...args: unknown[]) => {
        spy.calls.push(args);
        return fn(...args);
      };
    }
    return out;
  };
  return { spies, wrap };
});

const builders = [
  "planModel",
  "aluminiumModel",
  "antiAircraftModel",
  "namePoolFor",
  "overviewModel",
  "machineryModel",
  "plantDeltas",
  "protectionModel",
  "armamentEntries",
  "systemsModel",
  "colonialServiceModel",
] as const;

vi.mock("../../components/design-workspace/index.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("../../components/design-workspace/panels/hull-plan/planModel.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./aluminium-view.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./anti-aircraft-view.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./class-name-suggestions.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./overview.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./machinery-view.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./protection-view.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./armament.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./systems-view.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);
vi.mock("./colonial-service-view.js", async (importOriginal) =>
  S.wrap(await importOriginal<Record<string, unknown>>()),
);

afterEach(cleanup);

const callsOf = (name: string): readonly unknown[][] => S.spies[name]?.calls ?? [];

const counts = () =>
  Object.fromEntries(builders.map((b) => [b, callsOf(b).length])) as Record<
    (typeof builders)[number],
    number
  >;

const resetCounts = () => {
  for (const spy of Object.values(S.spies)) spy.calls.length = 0;
};

const classNameInput = () =>
  within(screen.getByRole("group", { name: "Design commands" })).getByLabelText("Class name");

const typeClassName = () => {
  fireEvent.change(classNameInput(), { target: { value: "A" } });
  fireEvent.change(classNameInput(), { target: { value: "AB" } });
};

const sections = () => screen.getByRole("navigation", { name: "Design sections" });
const openSection = (name: string) => {
  const button = within(sections()).getByRole("button", { name: new RegExp(`^${name}`) });
  if (button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
};
const openTab = (name: string) =>
  fireEvent.click(
    within(
      within(screen.getByTestId("design-drawer")).getByRole("tablist", { name: /tabs$/ }),
    ).getByRole("tab", { name }),
  );

describe("Typing the class name does not re-run the model builders", () => {
  it("with no panel open, the always-on builders keep their memoised results", () => {
    render(<ShipbuildingWorkspace />);
    resetCounts();
    typeClassName();
    expect(counts()).toEqual({
      planModel: 0,
      aluminiumModel: 0,
      antiAircraftModel: 0,
      namePoolFor: 0,
      overviewModel: 0,
      machineryModel: 0,
      plantDeltas: 0,
      protectionModel: 0,
      armamentEntries: 0,
      systemsModel: 0,
      colonialServiceModel: 0,
    });
  });

  it("keeps the overview summary builder still with the Overview panel open", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Overview");
    resetCounts();
    typeClassName();
    expect(callsOf("overviewModel")).toHaveLength(0);
    expect(callsOf("planModel")).toHaveLength(0);
  });

  it("keeps the machinery builder still with the Machinery panel open", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Machinery");
    resetCounts();
    typeClassName();
    expect(callsOf("machineryModel")).toHaveLength(0);
    expect(callsOf("plantDeltas")).toHaveLength(0);
  });

  it("keeps the protection builder still with the Armour tab open", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Protection");
    resetCounts();
    typeClassName();
    expect(callsOf("protectionModel")).toHaveLength(0);
  });

  it("keeps the armament builder still with the Main battery tab open", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Armament");
    openTab("Main battery");
    resetCounts();
    typeClassName();
    expect(callsOf("armamentEntries")).toHaveLength(0);
  });

  it("keeps the systems and colonial builders still with the Accommodation tab open", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Systems");
    openTab("Accommodation");
    resetCounts();
    typeClassName();
    expect(callsOf("systemsModel")).toHaveLength(0);
    expect(callsOf("colonialServiceModel")).toHaveLength(0);
  });

  it("re-runs the overview builder when the technology month changes", () => {
    render(<ShipbuildingWorkspace />);
    openSection("Overview");
    openTab("Brief");
    fireEvent.click(screen.getByRole("combobox", { name: "Technology as of" }));
    fireEvent.click(screen.getByRole("option", { name: "1885-01" }));
    resetCounts();
    fireEvent.click(screen.getByRole("combobox", { name: "Technology as of" }));
    fireEvent.click(screen.getByRole("option", { name: "1890-01" }));
    expect(callsOf("overviewModel")).toHaveLength(1);
  });
});
