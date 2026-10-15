/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { NewGameIdentityScreen } from "./NewGameIdentityScreen.js";
import {
  defaultCampaignIdentity,
  type CampaignIdentityDraft,
} from "./new-game-identity-screen-state.js";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }

  Element.prototype.scrollIntoView = vi.fn();
});

function setupUi(initialIdentity: CampaignIdentityDraft = defaultCampaignIdentity()) {
  const onPrimaryActionChange = vi.fn() as unknown as SetPrimaryAction;
  const onNext = vi.fn();
  const onBack = vi.fn();
  const utils = render(
    <NewGameIdentityScreen
      initialIdentity={initialIdentity}
      onBack={onBack}
      onNext={onNext}
      onPrimaryActionChange={onPrimaryActionChange}
    />,
  );
  return { ...utils, onNext, onBack, onPrimaryActionChange };
}

function lastPrimary(onPrimaryActionChange: ReturnType<typeof setupUi>["onPrimaryActionChange"]): {
  label?: string;
  disabled?: boolean;
  onTrigger?: () => void;
} {
  const calls = vi
    .mocked(onPrimaryActionChange)
    .mock.calls.map((call) => call[0])
    .filter(Boolean);
  return calls[calls.length - 1] ?? {};
}

describe("NewGameIdentityScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the five fields with spec-correct defaults", () => {
    setupUi();
    expect((screen.getByLabelText("Admiral name") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Campaign name") as HTMLInputElement).value).toBe("");
    expect(document.getElementById("naming-convention")?.textContent).toBe("Historical");
    expect(document.getElementById("ship-name-reuse")?.textContent).toBe("Disabled");
    expect(document.getElementById("measurement-system")?.textContent).toBe("Imperial");
  });

  it("shows a description line for each option in the identity selects", () => {
    setupUi();
    fireEvent.click(document.getElementById("naming-convention")!);

    expect(screen.getByText("Real names from the period")).toBeTruthy();
    expect(screen.getByText("The Admiralty names your ships")).toBeTruthy();
    expect(screen.getByText("Name every ship yourself")).toBeTruthy();
  });

  it("shows the spec placeholders on the required text fields", () => {
    setupUi();
    expect(screen.getByPlaceholderText("e.g. John Fisher")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. Britannia Ascendant")).toBeTruthy();
  });

  it("disables the primary action until both names are non-empty after trimming", () => {
    const { onPrimaryActionChange } = setupUi();
    expect(lastPrimary(onPrimaryActionChange).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Admiral name"), {
      target: { value: "  " },
    });
    expect(lastPrimary(onPrimaryActionChange).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Admiral name"), {
      target: { value: "John Fisher" },
    });
    expect(lastPrimary(onPrimaryActionChange).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Campaign name"), {
      target: { value: "Britannia Ascendant" },
    });
    expect(lastPrimary(onPrimaryActionChange).disabled).toBe(false);
  });

  it("the three enum fields never block progress since they carry a valid default", () => {
    const { onPrimaryActionChange } = setupUi();
    // Names are still empty, so Next stays disabled — but the enum fields
    // themselves are already at a valid default and never the blocker.
    const identity = defaultCampaignIdentity();
    expect(identity.namingConvention).toBe("historical");
    expect(identity.shipNameReuse).toBe("disabled");
    expect(identity.measurementSystem).toBe("imperial");
    expect(lastPrimary(onPrimaryActionChange).disabled).toBe(true);
  });

  it("emits the full identity draft, including enum fields, on Next", () => {
    const { onPrimaryActionChange, onNext } = setupUi();
    fireEvent.change(screen.getByLabelText("Admiral name"), {
      target: { value: "John Fisher" },
    });
    fireEvent.change(screen.getByLabelText("Campaign name"), {
      target: { value: "Britannia Ascendant" },
    });
    lastPrimary(onPrimaryActionChange).onTrigger?.();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext.mock.calls[0]![0]).toEqual({
      admiralName: "John Fisher",
      campaignName: "Britannia Ascendant",
      namingConvention: "historical",
      shipNameReuse: "disabled",
      measurementSystem: "imperial",
    });
  });

  it("calls onBack when Back to Archetype is clicked", () => {
    const { onBack } = setupUi();
    fireEvent.click(screen.getByRole("button", { name: "Back to Archetype" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("starts from the provided initial identity", () => {
    setupUi({
      admiralName: "Togo",
      campaignName: "Rising Sun",
      namingConvention: "generated",
      shipNameReuse: "allowed",
      measurementSystem: "metric",
    });
    expect((screen.getByLabelText("Admiral name") as HTMLInputElement).value).toBe("Togo");
    expect((screen.getByLabelText("Campaign name") as HTMLInputElement).value).toBe("Rising Sun");
    expect(document.getElementById("naming-convention")?.textContent).toBe("Generated");
    expect(document.getElementById("ship-name-reuse")?.textContent).toBe("Allowed");
    expect(document.getElementById("measurement-system")?.textContent).toBe("Metric");
  });
});
