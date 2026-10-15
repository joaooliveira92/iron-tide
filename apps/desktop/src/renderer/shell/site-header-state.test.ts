import { describe, expect, it } from "vite-plus/test";
import type { HeaderCampaign } from "./site-header-state.js";
import {
  describeSecondaryRow,
  formatCampaignMonth,
  formatTreasury,
  headerTitleFor,
} from "./site-header-state.js";

const campaign: HeaderCampaign = {
  month: { year: 1900, month: 1 },
  treasury: 24_500_000,
  nationName: "United Kingdom",
  projectedSurplusDeficit: 1_500_000,
  activeAlertsCount: null,
  atWar: false,
};

describe("formatTreasury", () => {
  it("renders sums below a thousand in whole pounds", () => {
    expect(formatTreasury(0)).toBe("£0");
    expect(formatTreasury(523)).toBe("£523");
  });

  it("renders larger sums in grouped thousands", () => {
    expect(formatTreasury(24_500_000)).toBe("£24,500k");
    expect(formatTreasury(1_000)).toBe("£1k");
  });

  it("truncates rather than rounding, so the toolbar never overstates the treasury", () => {
    expect(formatTreasury(1_999)).toBe("£1k");
  });

  it("keeps the sign outside the currency symbol for a deficit", () => {
    expect(formatTreasury(-1_200_000)).toBe("-£1,200k");
  });

  it("falls back to a dash when the amount is not a finite number", () => {
    expect(formatTreasury(Number.NaN)).toBe("—");
    expect(formatTreasury(Number.POSITIVE_INFINITY)).toBe("—");
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
    expect(describeSecondaryRow("menu", null)).toEqual({
      kind: "status",
      leading: "Active database (SQLite)",
      trailing: "Ready for operation",
    });
  });

  it("drives the playing view budget from the campaign treasury", () => {
    const row = describeSecondaryRow("playing", campaign);

    expect(row.kind).toBe("campaign");
    if (row.kind !== "campaign") return;

    const budget = row.metrics.find((metric) => metric.icon === "budget");
    expect(budget).toEqual({
      icon: "budget",
      label: "Budget",
      value: "£24,500k",
      placeholder: false,
    });
  });

  it("drives the nation and projected-balance metrics from the INC-1 fields", () => {
    const row = describeSecondaryRow("playing", campaign);
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    const nation = row.metrics.find((metric) => metric.icon === "nation");
    expect(nation).toEqual({
      icon: "nation",
      label: "Nation",
      value: "United Kingdom",
      placeholder: false,
    });

    const balance = row.metrics.find((metric) => metric.icon === "balance");
    expect(balance).toEqual({
      icon: "balance",
      label: "Projected balance",
      value: "£1,500k",
      placeholder: false,
    });
  });

  it("renders a projected deficit with the sign outside the currency symbol", () => {
    const row = describeSecondaryRow("playing", {
      ...campaign,
      projectedSurplusDeficit: -1_200_000,
    });
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    const balance = row.metrics.find((metric) => metric.icon === "balance");
    expect(balance?.value).toBe("-£1,200k");
    expect(balance?.placeholder).toBe(false);
  });

  it("keeps the alert-count slot empty (placeholder) until INC-2 lands", () => {
    const row = describeSecondaryRow("playing", campaign);
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    const alerts = row.metrics.find((metric) => metric.icon === "alerts");
    expect(alerts).toEqual({
      icon: "alerts",
      label: "Alerts",
      value: "—",
      placeholder: true,
    });
  });

  it("shows the real alert count once the forward-wired slot is populated", () => {
    const row = describeSecondaryRow("playing", { ...campaign, activeAlertsCount: 3 });
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    const alerts = row.metrics.find((metric) => metric.icon === "alerts");
    expect(alerts).toEqual({
      icon: "alerts",
      label: "Alerts",
      value: "3",
      placeholder: false,
    });
  });

  it("marks metrics the engine does not yet expose as placeholders", () => {
    const row = describeSecondaryRow("playing", campaign);
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    const unbacked = row.metrics.filter((metric) => metric.placeholder);
    // The alert slot is forward-wired (INC-2), so it is a placeholder while
    // its projection is absent; prestige/tension are not projected at all.
    expect(unbacked.map((metric) => metric.icon)).toEqual(["alerts", "prestige", "tension"]);
  });

  it("shows a dash for the budget when the campaign has not loaded", () => {
    const row = describeSecondaryRow("playing", null);
    if (row.kind !== "campaign") throw new Error("expected a campaign row");

    const budget = row.metrics.find((metric) => metric.icon === "budget");
    expect(budget?.value).toBe("—");
    expect(budget?.placeholder).toBe(true);
  });

  it("describes the remaining views without needing campaign data", () => {
    expect(describeSecondaryRow("new_game", null).kind).toBe("wizard");
    expect(describeSecondaryRow("options", null).kind).toBe("preferences");
    expect(describeSecondaryRow("editor", null).kind).toBe("editor");
  });

  it("lets a wizard step replace the default heading and hint", () => {
    const row = describeSecondaryRow("new_game", null, {
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
    expect(describeSecondaryRow("new_game", null)).toEqual({
      kind: "wizard",
      heading: "Campaign setup assistant",
      hint: "Select the historical scenario to continue",
    });
  });

  it("names the scenario year on the editor view", () => {
    const row = describeSecondaryRow("editor", campaign);
    if (row.kind !== "editor") throw new Error("expected an editor row");

    expect(row.scenario).toContain("1900");
  });
});
