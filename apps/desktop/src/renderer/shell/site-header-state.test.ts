import { describe, expect, it } from "vite-plus/test";
import type { HeaderCampaign } from "./site-header-state.js";
import {
  describeSecondaryRow,
  formatCampaignMonth,
  formatTreasury,
  headerTitleFor,
} from "./site-header-state.js";
import { createPresentationFormat } from "../lib/presentation-format/profile.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const treasury = (value: number) => formatTreasury(value, FORMAT);
const describeRow = (
  view: Parameters<typeof describeSecondaryRow>[0],
  campaign: Parameters<typeof describeSecondaryRow>[1],
  wizardStep?: Parameters<typeof describeSecondaryRow>[3],
) => describeSecondaryRow(view, campaign, FORMAT, wizardStep);

const campaign: HeaderCampaign = {
  prestige: { current: 20, sackingThreshold: 16, dismissalRisk: false },
  month: { year: 1900, month: 1 },
  atWar: false,
};

describe("formatTreasury", () => {
  it("renders sums below a thousand in whole pounds", () => {
    expect(treasury(0)).toBe("0 NC");
    expect(treasury(523)).toBe("523 NC");
  });

  it("renders larger sums in grouped thousands", () => {
    expect(treasury(24_500_000)).toBe("24,500k NC");
    expect(treasury(1_000)).toBe("1k NC");
  });

  it("truncates rather than rounding, so the toolbar never overstates the treasury", () => {
    expect(treasury(1_999)).toBe("1k NC");
  });

  it("keeps the sign outside the currency symbol for a deficit", () => {
    expect(treasury(-1_200_000)).toBe("-1,200k NC");
  });

  it("falls back to a dash when the amount is not a finite number", () => {
    expect(treasury(Number.NaN)).toBe("—");
    expect(treasury(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatCampaignMonth", () => {
  it("names the month", () => {
    expect(formatCampaignMonth({ year: 1900, month: 1 })).toBe("January 1900");
    expect(formatCampaignMonth({ year: 1906, month: 12 })).toBe("December 1906");
  });

  it("falls back to a numeric form for an out-of-range month", () => {
    expect(formatCampaignMonth({ year: 1900, month: 0 })).toBe("0/1900");
    expect(formatCampaignMonth({ year: 1900, month: 13 })).toBe("13/1900");
  });
});

describe("headerTitleFor", () => {
  it("shows the campaign date once a campaign is loaded", () => {
    expect(headerTitleFor(campaign)).toBe("Bluewave — January 1900");
  });

  it("shows the bare application name before a campaign is loaded", () => {
    expect(headerTitleFor(null)).toBe("Bluewave");
  });
});

describe("describeSecondaryRow", () => {
  it("reports database readiness on the menu view", () => {
    expect(describeRow("menu", null)).toEqual({
      kind: "status",
      leading: "Active database (SQLite)",
      trailing: "Ready for operation",
    });
  });

  it("leaves the campaign row to the priorities briefing while prestige is safe", () => {
    const row = describeRow("playing", campaign);

    expect(row).toEqual({ kind: "campaign", metrics: [], status: "Armed peace" });
  });

  it("promotes prestige into the row only when dismissal is at risk", () => {
    const row = describeRow("playing", {
      ...campaign,
      prestige: { current: 15, sackingThreshold: 16, dismissalRisk: true },
    });
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    expect(row.metrics).toEqual([
      {
        icon: "prestige",
        label: "Prestige",
        value: "15 — at risk of dismissal",
        placeholder: false,
        alert: true,
      },
    ]);
  });

  it("reports war in the status text", () => {
    const row = describeRow("playing", { ...campaign, atWar: true });
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    expect(row.status).toBe("At war");
  });

  it("shows no metrics when the campaign has not loaded", () => {
    const row = describeRow("playing", null);
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    expect(row.metrics).toEqual([]);
  });

  it("describes the remaining views without needing campaign data", () => {
    expect(describeRow("new_game", null).kind).toBe("wizard");
    expect(describeRow("options", null).kind).toBe("preferences");
    expect(describeRow("editor", null).kind).toBe("editor");
  });

  it("lets a wizard step replace the default heading and hint", () => {
    const row = describeRow("new_game", null, {
      heading: "Rules of the Naval Age",
      hint: "Set the era, scale, and historical uncertainty for this campaign.",
    });
    expect(row).toEqual({
      kind: "wizard",
      heading: "Rules of the Naval Age",
      hint: "Set the era, scale, and historical uncertainty for this campaign.",
    });
  });

  it("keeps the generic wizard copy when no step supplies its own", () => {
    expect(describeRow("new_game", null)).toEqual({
      kind: "wizard",
      heading: "Campaign setup assistant",
      hint: "Select the historical scenario to continue",
    });
  });

  it("names the scenario year on the editor view", () => {
    const row = describeRow("editor", campaign);
    if (row.kind !== "editor") throw new Error("expected an editor row");

    expect(row.scenario).toContain("1900");
  });
});
