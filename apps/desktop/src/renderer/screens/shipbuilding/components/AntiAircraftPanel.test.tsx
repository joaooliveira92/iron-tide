import type { DraftEdit } from "@bluewave/ship-design";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AntiAircraftModel } from "../anti-aircraft-view.js";
import { AntiAircraftPanel } from "./AntiAircraftPanel.js";

afterEach(cleanup);

const model: AntiAircraftModel = {
  offered: true,
  fit: { lightGuns: 4, mediumGuns: 2, directors: 1 },
  maxDirectors: 4,
  status: "fitted",
  text: "Adds 3.0 t.",
};
const commit = (label: string, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe("AntiAircraftPanel", () => {
  it("shows the counts and the readout", () => {
    render(<AntiAircraftPanel model={model} edit={() => {}} />);
    expect((screen.getByLabelText("Light AA guns") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Medium AA guns") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("AA directors") as HTMLInputElement).value).toBe("1");
    expect(screen.getByText("Adds 3.0 t.")).toBeTruthy();
  });

  it("changes one count at a time, keeping the others", () => {
    const edit = vi.fn<(e: DraftEdit) => void>();
    render(<AntiAircraftPanel model={model} edit={edit} />);
    commit("Light AA guns", "8");
    expect(edit).toHaveBeenLastCalledWith({
      kind: "set_anti_aircraft",
      antiAircraft: { lightGuns: 8, mediumGuns: 2, directors: 1 },
    });
    commit("AA directors", "3");
    expect(edit).toHaveBeenLastCalledWith({
      kind: "set_anti_aircraft",
      antiAircraft: { lightGuns: 4, mediumGuns: 2, directors: 3 },
    });
  });

  it("holds directors to the manual's maximum", () => {
    const edit = vi.fn<(e: DraftEdit) => void>();
    render(<AntiAircraftPanel model={model} edit={edit} />);
    commit("AA directors", "9");
    const last = edit.mock.calls.at(-1)?.[0];
    if (last?.kind === "set_anti_aircraft")
      expect(last.antiAircraft?.directors).toBeLessThanOrEqual(4);
  });
});
