/* @vitest-environment jsdom */
import type { BattleManifest } from "@bluewave/campaign-engine";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BattleArenaTab } from "./BattleArenaTab.js";

const manifest = {
  battleId: "battle_1",
  missionType: "surface_action",
  sides: [
    { sideId: "attacker", nationId: "uk", participants: [] },
    { sideId: "defender", nationId: "germany", participants: [] },
  ],
} as unknown as BattleManifest;

const ResizeObserverMock = vi.hoisted(
  () =>
    class implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
);
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

function noop(): void {}

function button(name: string): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
});

describe("BattleArenaTab", () => {
  it("shows the empty state and disables resolution until an engagement exists", () => {
    render(
      <BattleArenaTab
        battleManifest={null}
        battleLoading={false}
        battleError={null}
        autoResolution={null}
        tacticalOutcome={null}
        playerNationId="uk"
        onGenerateBattle={noop}
        onAutoResolve={noop}
        onTacticalResolve={noop}
      />,
    );

    expect(screen.getByText("No engagement generated")).not.toBeNull();
    expect(button("Generate Engagement").disabled).toBe(false);
    expect(button("Auto-Resolve").disabled).toBe(true);
    expect(button("Run Tactical resolver (200t)").disabled).toBe(true);
  });

  it("disables every control and shows the spinner while loading", () => {
    render(
      <BattleArenaTab
        battleManifest={null}
        battleLoading
        battleError={null}
        autoResolution={null}
        tacticalOutcome={null}
        playerNationId="uk"
        onGenerateBattle={noop}
        onAutoResolve={noop}
        onTacticalResolve={noop}
      />,
    );

    expect(screen.getByText(/Running battle simulator engines/)).not.toBeNull();
    expect(button("Generate Engagement").disabled).toBe(true);
    expect(button("Auto-Resolve").disabled).toBe(true);
    expect(button("Run Tactical resolver (200t)").disabled).toBe(true);
  });

  it("surfaces a battle error", () => {
    render(
      <BattleArenaTab
        battleManifest={null}
        battleLoading={false}
        battleError="generateBattle rejected"
        autoResolution={null}
        tacticalOutcome={null}
        playerNationId="uk"
        onGenerateBattle={noop}
        onAutoResolve={noop}
        onTacticalResolve={noop}
      />,
    );

    expect(screen.getByText("generateBattle rejected")).not.toBeNull();
  });

  it("renders the manifest and wires the generate handler", () => {
    const onGenerateBattle = vi.fn();
    render(
      <BattleArenaTab
        battleManifest={manifest}
        battleLoading={false}
        battleError={null}
        autoResolution={null}
        tacticalOutcome={null}
        playerNationId="uk"
        onGenerateBattle={onGenerateBattle}
        onAutoResolve={noop}
        onTacticalResolve={noop}
      />,
    );

    expect(screen.getByText("BATTLE: battle_1")).not.toBeNull();
    expect(button("Auto-Resolve").disabled).toBe(false);

    fireEvent.click(button("Generate Engagement"));
    expect(onGenerateBattle).toHaveBeenCalledTimes(1);
  });
});
