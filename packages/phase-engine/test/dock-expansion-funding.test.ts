import type { CampaignSnapshot, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  dockExpansionDueUnits,
  dockExpansionEarliestCompletionMonth,
  dockExpansionInstalmentUnits,
  dockExpansionProjectFor,
  dockExpansionTotalUnits,
} from "../src/dockExpansion.js";
import { MonthExecutor } from "../src/index.js";
import { snapshot } from "./helpers/constructionFixtures.js";

const monthOfTurn = (turn: number): string => {
  const index = 1880 * 12 + turn;
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, "0")}`;
};

const DOCK = {
  maximumNewConstructionMassKg: 10_000_000,
  maximumMajorRepairMassKg: 10_000_000,
  maximumRebuildMassKg: 10_000_000,
  maximumConversionMassKg: 10_000_000,
};

function planned(durationMonths?: number): ConstructionProject {
  return dockExpansionProjectFor({
    projectId: "dock-expansion-GBR-home-1880-02",
    possessionId: "gbr-home",
    authorizedMonth: "1880-02",
    stepKg: 1_000_000,
    ...(durationMonths === undefined ? {} : { durationMonths }),
  });
}

function startState(project: ConstructionProject, treasury: number): CampaignSnapshot {
  const base = snapshot([project], new Map(), 0, treasury);
  const gbr = base.nations.get("GBR")!;
  return { ...base, nations: new Map([["GBR", { ...gbr, dock: DOCK }]]) };
}

interface MonthRecord {
  readonly turn: number;
  readonly debit: number;
  readonly paidWork: number;
  readonly status: ConstructionProject["status"];
}

function runMonths(from: CampaignSnapshot, months: number): MonthRecord[] {
  const records: MonthRecord[] = [];
  let state = from;
  for (let turn = 1; turn <= months; turn++) {
    const before = Number(state.nations.get("GBR")!.treasury);
    const result = new MonthExecutor().execute(
      { ...state, turnNumber: SafeInt(turn) },
      [],
      "dock-funding",
      new DiagnosticCollector(),
    );
    state = result.finalSnapshot;
    const nation = state.nations.get("GBR")!;
    const after = nation.constructionProjects[0]!;
    records.push({
      turn,
      debit: before - Number(nation.treasury),
      paidWork: Number(after.paidWork),
      status: after.status,
    });
  }
  return records;
}

describe("dock expansion monthly funding", () => {
  it("prices the expansion at its total work and pays one instalment a month", () => {
    const project = planned();
    expect(dockExpansionTotalUnits(project)).toBe(1_200);
    expect(dockExpansionInstalmentUnits(project)).toBe(100);
    const records = runMonths(startState(project, 1_000_000), 12);
    expect(records.map((r) => r.debit)).toEqual(Array(12).fill(100));
    expect(records.at(-1)!.paidWork).toBe(1_200);
  });

  it("debits what the shared function says is due each month", () => {
    const project = planned();
    const records = runMonths(startState(project, 1_000_000), 12);
    let paid = 0;
    for (const [index, record] of records.entries()) {
      const due = dockExpansionDueUnits({
        ...project,
        paidWork: SafeInt(paid),
        elapsedActiveMonths: index,
      });
      expect(record.debit).toBe(due);
      paid += record.debit;
    }
  });

  it("completes in the earliest completion month and stops drawing", () => {
    const project = planned();
    const records = runMonths(startState(project, 1_000_000), 16);
    const done = records.find((r) => r.status === "COMPLETED")!;
    expect(monthOfTurn(done.turn)).toBe(dockExpansionEarliestCompletionMonth(project));
    expect(records.filter((r) => r.turn > done.turn).every((r) => r.debit === 0)).toBe(true);
    expect(records.reduce((sum, r) => sum + r.debit, 0)).toBe(1_200);
  });

  it("rounds the instalment up and trims the last one", () => {
    const project = planned(9);
    expect(dockExpansionInstalmentUnits(project)).toBe(134);
    const records = runMonths(startState(project, 1_000_000), 9);
    expect(records.map((r) => r.debit)).toEqual([134, 134, 134, 134, 134, 134, 134, 134, 128]);
  });

  it("catches up arrears when the treasury ran short", () => {
    const project = planned();
    const records = runMonths(startState(project, 150), 12);
    expect(records.reduce((sum, r) => sum + r.debit, 0)).toBe(150);
    expect(records[0]!.debit).toBe(100);
    expect(records[1]!.debit).toBe(50);
  });
});
