import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { loadDrawingBoardContent } from "../content.js";
import { RebuildPanel } from "./RebuildPanel.js";

const campaign = vi.hoisted(() => ({ revision: 3 }));
vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => campaign.revision,
  useActiveCampaignCurrencyContext: () => ({}),
}));

const content = loadDrawingBoardContent();
const draft = content.references[0]!.draft;

const execute = vi.fn();
const testWindow = window as { bluewave?: unknown };
beforeEach(() => {
  campaign.revision = 3;
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

describe("RebuildPanel while the campaign moves on", () => {
  it("asks again which ships can be rebuilt when the month is committed", async () => {
    let ships: readonly (typeof ship)[] = [];
    execute.mockImplementation((method: string) =>
      method === "listRebuildableShips"
        ? Promise.resolve({ outcome: "success", value: ships, diagnostics: [] })
        : Promise.resolve({ outcome: "success", value: {}, diagnostics: [] }),
    );
    const panel = () => (
      <RebuildPanel sessionId="s" draft={draft} content={content} onLoad={() => {}} dirty={false} />
    );
    const { rerender } = render(panel());
    await screen.findByText(/None of your ships can be rebuilt yet/);
    ships = [ship];
    campaign.revision = 4;
    rerender(panel());
    await waitFor(() =>
      expect(screen.queryByText(/None of your ships can be rebuilt yet/)).toBeNull(),
    );
    expect(await screen.findByRole("combobox", { name: "Ship to rebuild" })).toBeTruthy();
  });
});
