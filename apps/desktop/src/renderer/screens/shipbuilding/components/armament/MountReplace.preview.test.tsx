import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildWorkshopView, type BatteryRole } from "@bluewave/ship-design";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DesignWorkspaceFixture } from "../../../../components/design-workspace/DesignWorkspaceFixture.js";
import { batteryCards } from "../../../../components/design-workspace/batteryView.js";
import { loadDrawingBoardContent } from "../../../../components/design-workspace/content.js";
import { createPresentationFormat } from "../../../../lib/presentation-format/profile.js";
import { armamentEntries, allMounts } from "../../armament.js";
import { replaceEdit } from "../../armament-edits.js";
import { ArmamentEditingProvider } from "./ArmamentEditing.js";
import { MountReplace } from "./MountReplace.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const view = buildWorkshopView(ref.draft, env);
const format = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});
const cards = batteryCards(view, ref.draft);
const roles: readonly BatteryRole[] = ["MAIN", "SECONDARY"];
const entries = roles.flatMap((role) =>
  armamentEntries(role, cards, ref.draft, view, content, format),
);
const mount = allMounts(entries)[0]!;

function mountPicker(edit = vi.fn()) {
  render(
    <DesignWorkspaceFixture content={content} draft={ref.draft} view={view} month={ref.month}>
      <ArmamentEditingProvider
        entries={entries}
        draft={ref.draft}
        content={content}
        findings={[]}
        month={ref.month}
        unlockedTechs={env.ctx.unlockedTechs}
        edit={edit}
        selectedInstanceId={mount.instanceId}
      >
        <MountReplace />
      </ArmamentEditingProvider>
    </DesignWorkspaceFixture>,
  );
  fireEvent.click(screen.getByRole("combobox", { name: /Replace .* with/ }));
  return edit;
}

function firstOption(): HTMLElement {
  const trigger = screen.getByRole("combobox", { name: /Replace .* with/ });
  const listbox = document.getElementById(trigger.getAttribute("aria-controls")!)!;
  return listbox.querySelector<HTMLElement>('[role="option"]')!;
}

describe("armament replace hover preview", () => {
  it("shows toned deltas for the highlighted gun and clears them when the list closes", () => {
    mountPicker();
    expect(screen.queryByTestId("delta-preview")).toBeNull();
    const option = firstOption();
    fireEvent.pointerMove(option);
    const preview = screen.getByTestId("delta-preview");
    expect(preview.getAttribute("aria-label")).toBe("Effect of the highlighted gun");
    expect(preview.querySelectorAll("li[data-tone]").length).toBeGreaterThan(0);
    fireEvent.keyDown(screen.getByRole("combobox", { name: /Replace .* with/ }), {
      key: "Escape",
    });
    expect(screen.queryByTestId("delta-preview")).toBeNull();
  });

  it("previews the same edit that Replace would commit", () => {
    const edit = mountPicker();
    const option = firstOption();
    const componentId = option.getAttribute("data-value")!;
    fireEvent.pointerMove(option);
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(edit).toHaveBeenCalledWith(replaceEdit(mount, componentId));
  });
});
