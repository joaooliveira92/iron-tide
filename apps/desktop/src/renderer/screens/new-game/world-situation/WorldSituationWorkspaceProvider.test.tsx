/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { isBluewaveError } from "@bluewave/contracts";
import { worldSituationSource } from "../world-situation-source.js";
import { buildWorldSituation } from "../world-situation.js";
import { japanProjection } from "../world-situation-fixture.js";
import { PowerNavigator } from "./PowerNavigator.js";
import { SelectedPowerDossier } from "./SelectedPowerDossier.js";
import {
  useWorldSituationWorkspace,
  type WorldSituationWorkspace,
  type WorldSituationWorkspaceActions,
} from "./useWorldSituationWorkspace.js";
import {
  useWorldSituationActions,
  useWorldSituationMeta,
  useWorldSituationState,
  WorldSituationWorkspaceProvider,
} from "./WorldSituationWorkspaceProvider.js";

const situation = buildWorldSituation(worldSituationSource(japanProjection()));

function nationIdNamed(pattern: RegExp): string {
  const power = situation.ordered.find((candidate) => pattern.test(candidate.name));
  if (power === undefined) throw new Error(`no power named ${pattern.source}`);
  return power.nationId;
}

function Probe({ onRead }: { onRead: (workspace: WorldSituationWorkspace) => void }) {
  const state = useWorldSituationState();
  const actions = useWorldSituationActions();
  const meta = useWorldSituationMeta();
  onRead({ state, actions, meta });
  return null;
}

function Harness({ onRead }: { readonly onRead: (workspace: WorldSituationWorkspace) => void }) {
  const workspace = useWorldSituationWorkspace({ situation });
  return (
    <WorldSituationWorkspaceProvider workspace={workspace}>
      <PowerNavigator>
        <SelectedPowerDossier />
      </PowerNavigator>
      <Probe onRead={onRead} />
      <p role="status">{workspace.state.announcement}</p>
    </WorldSituationWorkspaceProvider>
  );
}

function setup() {
  const latest: { current: WorldSituationWorkspace | null } = { current: null };
  render(
    <Harness
      onRead={(workspace) => {
        latest.current = workspace;
      }}
    />,
  );
  return {
    read: () => {
      const current = latest.current;
      if (current === null) throw new Error("the probe has not read the workspace");
      return current;
    },
    run: (action: (actions: WorldSituationWorkspaceActions) => void) => {
      const current = latest.current;
      if (current === null) throw new Error("the probe has not read the workspace");
      act(() => {
        action(current.actions);
      });
    },
  };
}

describe("WorldSituationWorkspaceProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens on the default selection shared by the navigator and the dossier", () => {
    const { read } = setup();

    expect(read().meta.selectedId).toBe(situation.defaultSelectionId);
    expect(read().state.chosenId).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
    const defaultName = situation.ordered.find(
      (power) => power.nationId === situation.defaultSelectionId,
    )?.name;
    expect(screen.getByRole("heading", { name: defaultName ?? "" })).toBeTruthy();
  });

  it("moves the navigator card, the dossier and the meta together on select", () => {
    const { read, run } = setup();
    const ukId = nationIdNamed(/United Kingdom/);

    run((actions) => actions.selectPower(ukId));

    expect(read().state.chosenId).toBe(ukId);
    expect(read().meta.selectedId).toBe(ukId);
    expect(read().meta.selected?.name).toBe("United Kingdom");
    expect(screen.getByRole("heading", { name: "United Kingdom" })).toBeTruthy();
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-current") === "true"),
    ).toHaveLength(1);
  });

  it("announces the dossier through state once a power is selected", () => {
    const { read, run } = setup();

    run((actions) => actions.selectPower(nationIdNamed(/German/)));

    expect(read().state.announcement).toBe(screen.getByRole("status").textContent);
    expect(screen.getByRole("status").textContent).toContain("Dossier: ");
  });

  it("keeps a selection for an unknown power without inventing an announcement", () => {
    const { read, run } = setup();

    run((actions) => actions.selectPower("not-a-nation"));

    expect(read().state.chosenId).toBe("not-a-nation");
    expect(read().meta.selectedId).toBe(situation.defaultSelectionId);
    expect(read().state.announcement).toBe("");
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
    expect((caught as { message: string }).message).toBe(
      "WORLD_SITUATION_WORKSPACE_PROVIDER_MISSING",
    );
  });

  it("drives selection from the keyboard of the navigator part", () => {
    const { read } = setup();

    fireEvent.keyDown(screen.getByRole("button", { name: /Qing Dynasty/ }), { key: "ArrowDown" });

    expect(read().state.chosenId).not.toBeNull();
    expect(read().meta.selected?.nationId).toBe(read().state.chosenId);
  });
});
