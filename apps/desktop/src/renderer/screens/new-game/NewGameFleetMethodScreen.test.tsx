/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { NewGameFleetMethodScreen } from "./NewGameFleetMethodScreen.js";
import { defaultFleetMethod, type FleetMethodDraft } from "./new-game-fleet-method-screen-state.js";
import { FLEET_METHOD_CARDS } from "./fleet-method-content.js";

function setupUi(initialFleetMethod: FleetMethodDraft = defaultFleetMethod()) {
  const onPrimaryActionChange = vi.fn() as unknown as SetPrimaryAction;
  const onNext = vi.fn();
  const onBack = vi.fn();
  let primary: { label?: string; disabled?: boolean; onTrigger?: () => void } | null = null;
  const utils = render(
    <NewGameFleetMethodScreen
      initialFleetMethod={initialFleetMethod}
      status="ready"
      error={null}
      onBack={onBack}
      onNext={onNext}
      onPrimaryActionChange={(action) => {
        primary = action;
      }}
    />,
  );
  return { ...utils, onNext, onBack, onPrimaryActionChange, getPrimary: () => primary };
}

function fleetMethodListbox(): HTMLElement {
  return screen.getByRole("listbox", { name: "Starting-fleet methods" });
}

function fleetMethodOption(title: string): HTMLElement {
  return within(fleetMethodListbox()).getByRole("option", { name: title });
}

function detailPanel(title: string): HTMLElement {
  return screen.getByRole("region", { name: title });
}

function appliedMethod(): string {
  const text = screen.getByRole("status").textContent ?? "";
  return text.replace(/^Current method:\s*/u, "");
}

describe("NewGameFleetMethodScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("splits into a deck and a detail column that sit side by side", () => {
    setupUi();

    const master = fleetMethodListbox().closest("aside");
    const detail = screen.getByRole("region", { name: "Fleet method details" });
    expect(master).not.toBeNull();
    expect(master?.parentElement).toBe(detail.parentElement);
    expect(master?.contains(detail)).toBe(false);
  });

  it("lists exactly the three fleet method cards as options of one listbox", () => {
    setupUi();

    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    const names = within(fleetMethodListbox())
      .getAllByRole("option")
      .map((option) => option.getAttribute("aria-label"));
    expect(names).toEqual(FLEET_METHOD_CARDS.map((card) => card.title));
    expect(names).toEqual([
      "Inherit an Existing Navy",
      "Build the Legacy Fleet Manually",
      "Curated Historical-Inspired Fleet",
    ]);
  });

  it("renders three cards with the spec §5a copy mapping", () => {
    setupUi();

    expect(fleetMethodOption("Inherit an Existing Navy")).toBeTruthy();
    expect(fleetMethodOption("Build the Legacy Fleet Manually")).toBeTruthy();
    expect(fleetMethodOption("Curated Historical-Inspired Fleet")).toBeTruthy();
  });

  it("shows artwork for each of the three fleet methods", () => {
    const { container } = setupUi();
    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(3);
    expect(images[0]?.getAttribute("src")).toMatch(/inherit-an-existing-navy/);
    expect(images[1]?.getAttribute("src")).toMatch(/build-the-legacy-fleet-manually/);
    expect(images[2]?.getAttribute("src")).toMatch(/curated-historical-inspired-fleet/);
  });

  it("treats the card artwork as decorative, keeping the name on the card option", () => {
    const { container } = setupUi();
    for (const image of container.querySelectorAll("img")) {
      expect(image.getAttribute("alt")).toBe("");
    }
    expect(fleetMethodOption("Inherit an Existing Navy")).toBeTruthy();
  });

  it("reports the applied method in a status line", () => {
    setupUi();

    expect(appliedMethod()).toBe("Inherit an Existing Navy");
  });

  it("shows the focused card's details in the detail panel", () => {
    setupUi();

    const panel = detailPanel("Inherit an Existing Navy");
    expect(within(panel).getByText("Recommended for your first campaign")).toBeTruthy();
    expect(within(panel).getByText(/Start with an operational-but-aging navy/)).toBeTruthy();
  });

  it("defaults to the generated (Inherit an Existing Navy) card on first visit", () => {
    setupUi();

    const option = fleetMethodOption("Inherit an Existing Navy");
    expect(option.getAttribute("aria-selected")).toBe("true");
    for (const other of within(fleetMethodListbox()).getAllByRole("option")) {
      if (other !== option) {
        expect(other.getAttribute("aria-selected")).toBe("false");
      }
    }
  });

  it("shows the manual-build not-yet-available note only when the disabled card is previewed and active", () => {
    setupUi();

    expect(screen.queryByText(/Detailed fleet construction isn't available yet/)).toBeNull();

    fireEvent.keyDown(fleetMethodListbox(), { key: "ArrowRight" });

    expect(detailPanel("Build the Legacy Fleet Manually")).toBeTruthy();
    expect(
      within(detailPanel("Build the Legacy Fleet Manually")).getByText(
        /Detailed fleet construction isn't available yet/,
      ),
    ).toBeTruthy();
  });

  it("shows no numeric allocation figures, ship counts, or phase breakdowns", () => {
    setupUi();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Phase\s*1/i);
    expect(text).not.toMatch(/Phase\s*2/i);
    expect(text).not.toMatch(/\d+\s*ships?/i);
  });

  it("allows selecting any of the three cards, with no gating", () => {
    setupUi();

    fireEvent.pointerDown(fleetMethodOption("Build the Legacy Fleet Manually"), {
      button: 0,
      pointerId: 1,
    });
    expect(fleetMethodOption("Build the Legacy Fleet Manually").getAttribute("aria-selected")).toBe(
      "true",
    );

    fireEvent.pointerDown(fleetMethodOption("Curated Historical-Inspired Fleet"), {
      button: 0,
      pointerId: 1,
    });
    expect(
      fleetMethodOption("Curated Historical-Inspired Fleet").getAttribute("aria-selected"),
    ).toBe("true");
    expect(fleetMethodOption("Build the Legacy Fleet Manually").getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  it("the primary action is never blocked, since a selection always exists", () => {
    const { getPrimary } = setupUi();
    expect(getPrimary()?.disabled).toBe(false);
  });

  it("previews on arrow key focus without selecting anything, showing Select until applied", () => {
    const { getPrimary } = setupUi();

    expect(getPrimary()?.label).toBe("Next: Review Campaign");

    fireEvent.keyDown(fleetMethodListbox(), { key: "ArrowRight" });

    expect(detailPanel("Build the Legacy Fleet Manually")).toBeTruthy();
    expect(appliedMethod()).toBe("Inherit an Existing Navy");
    expect(getPrimary()?.label).toBe("Select");

    fireEvent.keyDown(fleetMethodListbox(), { key: "Enter" });

    expect(appliedMethod()).toBe("Build the Legacy Fleet Manually");
    expect(getPrimary()?.label).toBe("Next: Review Campaign");
  });

  it("applies the previewed card when the Select primary action is pressed", () => {
    const { getPrimary } = setupUi();

    fireEvent.keyDown(fleetMethodListbox(), { key: "ArrowRight" });

    act(() => getPrimary()?.onTrigger?.());

    expect(appliedMethod()).toBe("Build the Legacy Fleet Manually");
    expect(getPrimary()?.label).toBe("Next: Review Campaign");
  });

  it("emits the selected legacyFleetModeId on continue", () => {
    const { onNext, getPrimary } = setupUi();

    fireEvent.pointerDown(fleetMethodOption("Curated Historical-Inspired Fleet"), {
      button: 0,
      pointerId: 1,
    });
    act(() => getPrimary()?.onTrigger?.());
    expect(onNext).toHaveBeenCalledWith({ legacyFleetModeId: "historical" });
  });

  it("starts from the provided initial fleet method", () => {
    setupUi({ legacyFleetModeId: "disabled" });
    expect(fleetMethodOption("Build the Legacy Fleet Manually").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("calls onBack when Back to Identity is clicked", () => {
    const { onBack } = setupUi();
    fireEvent.click(screen.getByRole("button", { name: "Back to Identity" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
