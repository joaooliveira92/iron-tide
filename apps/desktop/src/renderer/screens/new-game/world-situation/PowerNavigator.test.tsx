/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { worldSituationSource } from "../world-situation-source.js";
import { buildWorldSituation, type WorldSituation } from "../world-situation.js";
import { japanProjection } from "../world-situation-fixture.js";
import { NationGlyph } from "./NationGlyph.js";
import { PowerNavigator } from "./PowerNavigator.js";
import type { WorldSituationWorkspace } from "./useWorldSituationWorkspace.js";
import { WorldSituationWorkspaceProvider } from "./WorldSituationWorkspaceProvider.js";

vi.mock("./NationGlyph.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./NationGlyph.js")>();
  return { ...original, NationGlyph: vi.fn(original.NationGlyph) };
});

const situation = buildWorldSituation(worldSituationSource(japanProjection()));
const QING_ID = situation.defaultSelectionId;

function nationIdNamed(pattern: RegExp): string {
  const power = situation.ordered.find((candidate) => pattern.test(candidate.name));
  if (power === undefined) throw new Error(`no power named ${pattern.source}`);
  return power.nationId;
}

function glyphRenders(): readonly string[] {
  return vi.mocked(NationGlyph).mock.calls.map(([props]) => props.nationId);
}

function workspaceFor(
  source: WorldSituation,
  selectedId: string | null,
  selectPower: (nationId: string) => void,
): WorldSituationWorkspace {
  const selected = source.ordered.find((power) => power.nationId === selectedId) ?? null;
  return {
    state: { chosenId: selectedId, announcement: "" },
    actions: { selectPower },
    meta: { situation: source, selectedId: selected?.nationId ?? null, selected },
  };
}

function renderNavigator(workspace: WorldSituationWorkspace) {
  return render(
    <WorldSituationWorkspaceProvider workspace={workspace}>
      <PowerNavigator>{null}</PowerNavigator>
    </WorldSituationWorkspaceProvider>,
  );
}

beforeEach(() => {
  vi.mocked(NationGlyph).mockClear();
});

afterEach(cleanup);

describe("PowerNavigator", () => {
  it("re-renders only the cards whose selection changed", () => {
    const ukId = nationIdNamed(/United Kingdom/);
    const selectPower = vi.fn();
    const { rerender } = renderNavigator(workspaceFor(situation, QING_ID, selectPower));
    vi.mocked(NationGlyph).mockClear();

    rerender(
      <WorldSituationWorkspaceProvider workspace={workspaceFor(situation, ukId, selectPower)}>
        <PowerNavigator>{null}</PowerNavigator>
      </WorldSituationWorkspaceProvider>,
    );

    expect(new Set(glyphRenders())).toEqual(new Set([QING_ID, ukId]));
  });

  it("selects through the workspace action of the latest render", () => {
    const stale = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderNavigator(workspaceFor(situation, QING_ID, stale));
    rerender(
      <WorldSituationWorkspaceProvider workspace={workspaceFor(situation, QING_ID, latest)}>
        <PowerNavigator>{null}</PowerNavigator>
      </WorldSituationWorkspaceProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /United Kingdom/ }));

    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(nationIdNamed(/United Kingdom/));
  });

  it("keys through powers revealed by expanding a collapsed tier", () => {
    const selectPower = vi.fn();
    renderNavigator(workspaceFor(situation, QING_ID, selectPower));
    const lastBefore = situation.groups
      .filter((group) => group.tier !== "distant")
      .flatMap((group) => group.powers)
      .at(-1);
    const lastAfter = situation.ordered.at(-1);

    fireEvent.keyDown(screen.getByRole("button", { name: /Qing Dynasty/ }), { key: "End" });
    expect(selectPower).toHaveBeenLastCalledWith(lastBefore?.nationId);

    const distantToggle = screen
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-controls") === "world-tier-distant");
    if (distantToggle === undefined) throw new Error("no distant tier toggle");
    fireEvent.click(distantToggle);

    fireEvent.keyDown(screen.getByRole("button", { name: /Qing Dynasty/ }), { key: "End" });
    expect(selectPower).toHaveBeenLastCalledWith(lastAfter?.nationId);
  });

  it("renders the dossier slot only under the selected card", () => {
    const ukId = nationIdNamed(/United Kingdom/);
    const { container } = render(
      <WorldSituationWorkspaceProvider workspace={workspaceFor(situation, ukId, vi.fn())}>
        <PowerNavigator>
          <p data-testid="dossier-slot">dossier</p>
        </PowerNavigator>
      </WorldSituationWorkspaceProvider>,
    );

    const slots = container.querySelectorAll('[data-testid="dossier-slot"]');
    expect(slots).toHaveLength(1);
    expect(slots[0]?.closest("li")?.textContent).toContain("United Kingdom");
  });

  it("moves selection to a visible power when closing the tier hides it", () => {
    const distantId = situation.groups
      .find((group) => group.tier === "distant")
      ?.powers.at(-1)?.nationId;
    if (distantId === undefined) throw new Error("no distant power");
    const selectPower = vi.fn();
    renderNavigator(workspaceFor(situation, distantId, selectPower));

    const distantToggle = () => {
      const button = screen
        .getAllByRole("button")
        .find((candidate) => candidate.getAttribute("aria-controls") === "world-tier-distant");
      if (button === undefined) throw new Error("no distant tier toggle");
      return button;
    };

    fireEvent.click(distantToggle());
    expect(selectPower).not.toHaveBeenCalled();

    selectPower.mockClear();
    fireEvent.click(distantToggle());

    expect(selectPower).toHaveBeenCalledWith(
      situation.groups.find((group) => group.tier !== "distant")?.powers[0]?.nationId,
    );
  });
});
