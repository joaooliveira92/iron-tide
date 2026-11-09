import { CONSTRUCTION_PROJECT_STATUSES, type ConstructionProjectStatus } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import { EN_US_MESSAGES } from "../../lib/en-us-messages.js";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { readoutLines } from "./components/ProjectReadout.js";
import { formatMonthKey } from "./month-key.js";
import type { ProjectRow } from "./project-progress.js";
import { statusMeta } from "./yard-workspace.js";

const RAW_ENUM = /[A-Z]{2,}_[A-Z]/;
const RAW_MONTH = /\d{4}-\d{2}/;

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const UNAVAILABLE_REASONS = [
  ...CONSTRUCTION_PROJECT_STATUSES,
  "REVISION_HOLD",
  "FOREIGN_CONTRACT_MISSING",
] as const;

const rowWith = (
  status: ConstructionProjectStatus,
  readout: ProjectRow["readout"],
): ProjectRow => ({
  projectId: "project-1",
  className: "Havock class",
  shipType: "destroyer",
  status,
  percent: 45,
  yard: null,
  packages: [],
  holdUntilMonth: "1880-05",
  isForeign: false,
  revisable: false,
  readout,
});

describe("construction status labels", () => {
  it.each(CONSTRUCTION_PROJECT_STATUSES)("labels %s without a raw enum fallback", (status) => {
    const { label } = statusMeta(status);
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toMatch(RAW_ENUM);
    expect(label).not.toContain("_");
  });

  it.each(UNAVAILABLE_REASONS)("renders unavailable reason %s without a raw enum", (reason) => {
    const lines = readoutLines(
      rowWith("ACTIVE", {
        totalCostUnits: 640,
        monthlyInstalmentUnits: 120,
        remainingMonths: 6,
        launchMonth: null,
        scheduleBasis: "UNAVAILABLE",
        scheduleUnavailableReason: reason,
        haltedCarryingCostUnits: null,
      }),
      FORMAT,
    );
    const schedule = lines.find((line) => line.label === "Schedule");
    expect(schedule?.value).not.toMatch(RAW_ENUM);
  });
});

describe("construction month text", () => {
  it("formats a campaign month key through the presentation locale", () => {
    expect(formatMonthKey(FORMAT, "1880-05")).toBe("May 1880");
    expect(formatMonthKey(FORMAT, "1880-05")).not.toMatch(RAW_MONTH);
  });

  it("does not echo a malformed month key", () => {
    expect(formatMonthKey(FORMAT, "sometime")).toBe("unknown month");
  });

  it("prints no raw YYYY-MM in the launch line", () => {
    const lines = readoutLines(
      rowWith("ACTIVE", {
        totalCostUnits: 640,
        monthlyInstalmentUnits: 120,
        remainingMonths: 6,
        launchMonth: "1880-07",
        scheduleBasis: "YARD_CAPACITY",
        scheduleUnavailableReason: null,
        haltedCarryingCostUnits: null,
      }),
      FORMAT,
    );
    const launch = lines.find((line) => line.label === "Launch");
    expect(launch?.value).toBe("July 1880");
  });
});

describe("gauge vocabulary", () => {
  const gaugeKeys = Object.keys(EN_US_MESSAGES).filter((key) =>
    key.startsWith("construction.gauge."),
  );

  it("defines each gauge term once, with a distinct English value", () => {
    expect(gaugeKeys).toHaveLength(6);
    const values = gaugeKeys.map((key) => EN_US_MESSAGES[key as keyof typeof EN_US_MESSAGES]);
    expect(new Set(values).size).toBe(values.length);
  });
});
