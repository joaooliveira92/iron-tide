import type { BattleOutcome, StrategicPriority } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { comparePriorities, describeBattle, monthLabel, signed } from "./month-report-format.js";

const nation = (id: string) => ({ uk: "Britain", france: "France" })[id] ?? id;
const area = (id: string) => ({ malta: "Malta" })[id] ?? id;

const battle = (over: Partial<BattleOutcome> = {}): BattleOutcome => ({
  battleId: "b",
  areaId: "malta",
  attackerId: "uk",
  defenderId: "france",
  winnerId: "uk",
  loserId: "france",
  warScoreDelta: 2,
  attackerLosses: ["s1"],
  defenderLosses: ["f1", "f2"],
  explanation: [],
  ...over,
});

const priority = (
  fingerprint: string,
  over: Partial<StrategicPriority> = {},
): StrategicPriority => ({
  id: fingerprint,
  type: "monthly_deficit",
  severity: "warning",
  title: `Priority ${fingerprint}`,
  summary: "s",
  reason: "r",
  destination: "overview",
  fingerprint,
  ...over,
});

describe("signed", () => {
  it("shows direction explicitly, with a real minus sign", () => {
    expect(signed(20)).toBe("+20");
    expect(signed(-56)).toBe("−56");
    expect(signed(0)).toBe("0");
    expect(signed(12345)).toBe("+12,345");
  });
});

describe("describeBattle", () => {
  it("says who won where and what it cost each side", () => {
    expect(describeBattle(battle(), nation, area)).toBe(
      "Britain defeated France in Malta. Britain lost 1 ship, France lost 2 ships.",
    );
  });

  it("names the defender as winner when the attacker lost", () => {
    expect(describeBattle(battle({ winnerId: "france" }), nation, area)).toBe(
      "France defeated Britain in Malta. Britain lost 1 ship, France lost 2 ships.",
    );
  });

  it("calls an undecided battle a draw, never a win", () => {
    const text = describeBattle(battle({ winnerId: null, loserId: null }), nation, area);
    expect(text).toContain("fought to a draw");
    expect(text).not.toContain("defeated");
  });

  it("falls back to the given names for unknown nations and areas", () => {
    expect(
      describeBattle(battle({ attackerId: "x", areaId: "y", winnerId: "x" }), nation, area),
    ).toContain("x defeated France in y.");
  });
});

describe("comparePriorities", () => {
  it("marks every current priority as new against an empty previous report", () => {
    const { created, resolved, continuing } = comparePriorities([priority("a")], []);
    expect(created.map((p) => p.fingerprint)).toEqual(["a"]);
    expect(resolved).toEqual([]);
    expect(continuing).toEqual([]);
  });

  it("splits new, resolved and continuing by fingerprint", () => {
    const { created, resolved, continuing } = comparePriorities(
      [priority("a"), priority("b")],
      [priority("b"), priority("c")],
    );
    expect(created.map((p) => p.fingerprint)).toEqual(["a"]);
    expect(resolved.map((p) => p.fingerprint)).toEqual(["c"]);
    expect(continuing.map((p) => p.fingerprint)).toEqual(["b"]);
  });

  it("reports nothing continuing when a priority simply changed severity (same fingerprint)", () => {
    const { created, resolved, continuing } = comparePriorities(
      [priority("a", { severity: "critical" })],
      [priority("a", { severity: "warning" })],
    );
    expect(created).toEqual([]);
    expect(resolved).toEqual([]);
    expect(continuing.map((p) => p.fingerprint)).toEqual(["a"]);
  });
});

describe("monthLabel", () => {
  it("formats the campaign month as a human-readable label", () => {
    expect(monthLabel({ year: 1900, month: 3 })).toBe("March 1900");
  });

  it("falls back to the numeric month when out of range", () => {
    expect(monthLabel({ year: 1900, month: 13 })).toBe("13 1900");
  });
});
