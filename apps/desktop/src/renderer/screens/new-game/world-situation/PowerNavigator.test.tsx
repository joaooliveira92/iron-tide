/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { worldSituationSource } from "../world-situation-source.js";
import { buildWorldSituation } from "../world-situation.js";
import { japanProjection } from "../world-situation-fixture.js";
import { NationGlyph } from "./NationGlyph.js";
import { PowerNavigator } from "./PowerNavigator.js";

vi.mock("./NationGlyph.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./NationGlyph.js")>();
  return { ...original, NationGlyph: vi.fn(original.NationGlyph) };
});

const situation = buildWorldSituation(worldSituationSource(japanProjection()));
const renderDossier = () => null;
const QING_ID = situation.defaultSelectionId;

function nationIdNamed(pattern: RegExp): string {
  const power = situation.ordered.find((candidate) => pattern.test(candidate.name));
  if (power === undefined) throw new Error(`no power named ${pattern.source}`);
  return power.nationId;
}

function glyphRenders(): readonly string[] {
  return vi.mocked(NationGlyph).mock.calls.map(([props]) => props.nationId);
}

beforeEach(() => {
  vi.mocked(NationGlyph).mockClear();
});

afterEach(cleanup);

describe("PowerNavigator", () => {
  it("re-renders only the cards whose selection changed", () => {
    const ukId = nationIdNamed(/United Kingdom/);
    const onSelect = vi.fn();
    const { rerender } = render(
      <PowerNavigator
        groups={situation.groups}
        selectedId={QING_ID}
        onSelect={onSelect}
        renderDossier={renderDossier}
      />,
    );
    vi.mocked(NationGlyph).mockClear();

    rerender(
      <PowerNavigator
        groups={situation.groups}
        selectedId={ukId}
        onSelect={vi.fn()}
        renderDossier={renderDossier}
      />,
    );

    expect(new Set(glyphRenders())).toEqual(new Set([QING_ID, ukId]));
  });

  it("selects through the latest handler after a parent re-render", () => {
    const stale = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <PowerNavigator
        groups={situation.groups}
        selectedId={QING_ID}
        onSelect={stale}
        renderDossier={renderDossier}
      />,
    );
    rerender(
      <PowerNavigator
        groups={situation.groups}
        selectedId={QING_ID}
        onSelect={latest}
        renderDossier={renderDossier}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /United Kingdom/ }));

    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(nationIdNamed(/United Kingdom/));
  });

  it("keys through powers revealed by expanding a collapsed tier", () => {
    const onSelect = vi.fn();
    render(
      <PowerNavigator
        groups={situation.groups}
        selectedId={QING_ID}
        onSelect={onSelect}
        renderDossier={renderDossier}
      />,
    );
    const lastBefore = situation.groups
      .filter((group) => group.tier !== "distant")
      .flatMap((group) => group.powers)
      .at(-1);
    const lastAfter = situation.ordered.at(-1);

    fireEvent.keyDown(screen.getByRole("button", { name: /Qing Dynasty/ }), { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith(lastBefore?.nationId);

    const distantToggle = screen
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-controls") === "world-tier-distant");
    if (distantToggle === undefined) throw new Error("no distant tier toggle");
    fireEvent.click(distantToggle);

    fireEvent.keyDown(screen.getByRole("button", { name: /Qing Dynasty/ }), { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith(lastAfter?.nationId);
  });
});
