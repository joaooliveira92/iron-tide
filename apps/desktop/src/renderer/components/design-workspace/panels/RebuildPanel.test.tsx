import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "../content.js";
import { RebuildPanel } from "./RebuildPanel.js";

vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 3,
  useActiveCampaignCurrencyContext: () => ({}),
}));

const content = loadDrawingBoardContent();
const draft = content.references[0]!.draft;

const execute = vi.fn();
/** The preload global as the panel reads it, without an `as unknown` bridge in the test. */
const testWindow = window as { bluewave?: unknown };
beforeEach(() => {
  execute.mockReset();
  testWindow.bluewave = { campaign: { execute } };
});
afterEach(() => {
  cleanup();
  delete testWindow.bluewave;
});

const ship = {
  shipId: "s1",
  name: "HMS Test",
  className: "Test class",
  designVersionId: "des_test",
};

describe("RebuildPanel rebuild action selector (SB3-R25/R34)", () => {
  it("offers the early-band actions and not the deferred conversions", async () => {
    execute.mockImplementation((method: string) =>
      method === "listRebuildableShips"
        ? Promise.resolve({ outcome: "success", value: [ship], diagnostics: [] })
        : Promise.resolve({ outcome: "success", value: {}, diagnostics: [] }),
    );
    render(
      <RebuildPanel
        sessionId="s"
        draft={draft}
        content={content}
        onLoad={() => {}}
        dirty={false}
      />,
    );
    const select = (await screen.findByRole("combobox", {
      name: "Rebuild action",
    })) as HTMLSelectElement;
    const labels = [...select.querySelectorAll("option")].map((o) => o.textContent ?? "");
    expect(labels).toContain("Standard rebuild");
    expect(labels).toContain("Armament change");
    expect(labels).toContain("Bulge (add torpedo blister)");
    expect(labels.join(" ")).not.toMatch(/conversion|reclassif/i);
  });
});
