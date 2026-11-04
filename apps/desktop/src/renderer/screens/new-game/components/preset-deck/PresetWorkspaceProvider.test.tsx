/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { isBluewaveError } from "@bluewave/contracts";
import type { NewGameOptions } from "../../../../../shared/new-game-contract.js";
import type { AdmiralPresetValues } from "../../admiral-preset.js";
import type { DraftPreferences } from "../../new-game-preferences-screen-state.js";
import { PresetDeckPane } from "./PresetDeckPane.js";
import { PresetDetailPanel } from "./PresetDetailPanel.js";
import {
  PresetWorkspaceProvider,
  usePresetActions,
  usePresetMeta,
  usePresetState,
} from "./PresetWorkspaceProvider.js";
import {
  usePresetWorkspace,
  type PresetWorkspace,
  type PresetWorkspaceActions,
} from "./usePresetWorkspace.js";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }
});

function Probe({ onRead }: { onRead: (workspace: PresetWorkspace) => void }) {
  const state = usePresetState();
  const actions = usePresetActions();
  const meta = usePresetMeta();
  onRead({ state, actions, meta });
  return null;
}

function Harness({
  recommendedPreset,
  onNext,
  latest,
}: {
  readonly recommendedPreset: AdmiralPresetValues | null;
  readonly onNext: (preferences: DraftPreferences, options: NewGameOptions) => void;
  readonly latest: { current: PresetWorkspace | null };
}) {
  const workspace = usePresetWorkspace({ recommendedPreset, onNext });
  return (
    <PresetWorkspaceProvider workspace={workspace}>
      <PresetDeckPane />
      <section aria-label="Preset details">
        <PresetDetailPanel key={workspace.meta.detail.preset?.id ?? "none"} />
      </section>
      <Probe onRead={(value) => void (latest.current = value)} />
    </PresetWorkspaceProvider>
  );
}

async function setup() {
  const latest: { current: PresetWorkspace | null } = { current: null };
  const onNext = vi.fn();
  await act(async () => {
    render(<Harness recommendedPreset={null} onNext={onNext} latest={latest} />);
  });
  const read = () => {
    const current = latest.current;
    if (current === null) throw new Error("the probe has not read the workspace");
    return current;
  };
  return {
    onNext,
    read,
    run: (action: (actions: PresetWorkspaceActions) => void) => {
      act(() => {
        action(read().actions);
      });
    },
  };
}

function deckOption(name: string): HTMLElement {
  return within(screen.getByRole("listbox", { name: "Campaign presets" })).getByRole("option", {
    name,
  });
}

function detailRegion(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

function detailHeading(): string {
  const heading = screen.getByRole("region", { name: "Preset details" }).querySelector("h2");
  return heading?.textContent as string;
}

describe("PresetWorkspaceProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("feeds the deck selection and the detail heading from one workspace", async () => {
    const { read, run } = await setup();

    expect(detailHeading()).toBe("Cadet");
    expect(read().state.focusedIndex).toBe(0);

    run((actions) => actions.focusIndex(2));

    expect(detailHeading()).toBe("Naval Historian");
    expect(read().state.focusedIndex).toBe(2);
    expect(read().meta.deck.focusedIndex).toBe(2);
  });

  it("moves the detail panel when the deck part takes keyboard input", async () => {
    const { read } = await setup();

    fireEvent.keyDown(screen.getByRole("listbox", { name: "Campaign presets" }), {
      key: "ArrowRight",
    });

    expect(detailHeading()).toBe("Admiral");
    expect(read().state.focusedIndex).toBe(1);
  });

  it("applies the activated preset through actions into state and meta", async () => {
    const { read, run } = await setup();

    run((actions) => actions.activateIndex(1));

    expect(read().meta.deck.activePresetId).toBe("admiral");
    expect(read().meta.detail.applied).toBe(true);
    expect(deckOption("Admiral").getAttribute("aria-selected")).toBe("true");
    expect(within(detailRegion("Admiral")).getByText("Active")).toBeTruthy();
  });

  it("marks a focused preset pending without applying it", async () => {
    const { read, run } = await setup();

    run((actions) => actions.focusIndex(2));

    expect(read().state.pendingPresetId).toBe("naval_historian");
    expect(read().meta.detail.pending).toBe(true);
    expect(within(detailRegion("Naval Historian")).getByText("Applies on Next")).toBeTruthy();
  });

  it("clears the pending preset when a preference is edited", async () => {
    const { read, run } = await setup();

    run((actions) => actions.focusIndex(2));
    run((actions) => actions.changePreference("fleetSize", "large"));

    expect(read().state.pendingPresetId).toBeNull();
    expect(read().state.preferences.fleetSize).toBe("large");
    expect(read().meta.detail.pending).toBe(false);
  });

  it("keeps the pending preset when only the scenario changes", async () => {
    const { read, run } = await setup();

    run((actions) => actions.focusIndex(2));
    run((actions) => actions.changeScenario("scen_1900"));

    expect(read().state.pendingPresetId).toBe("naval_historian");
  });

  it("keeps the pending preset when only the campaign seed changes", async () => {
    const { read, run } = await setup();

    run((actions) => actions.focusIndex(2));
    run((actions) => actions.changeSeed("1900-seed"));

    expect(read().state.pendingPresetId).toBe("naval_historian");
    expect(read().state.preferences.campaignSeed).toBe("1900-seed");
  });

  it("holds the commit until the campaign options arrive", async () => {
    const { onNext, read, run } = await setup();

    expect(read().state.options).toBeNull();
    run((actions) => actions.commit());

    expect(onNext).not.toHaveBeenCalled();
  });

  it("refuses to read the workspace outside the provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let caught: unknown = null;
    try {
      render(<Probe onRead={() => undefined} />);
    } catch (error) {
      caught = error;
    }
    consoleError.mockRestore();

    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as { message: string }).message).toBe("PRESET_WORKSPACE_PROVIDER_MISSING");
  });
});
