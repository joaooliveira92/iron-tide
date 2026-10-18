import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { describe, expect, it } from "vite-plus/test";
import { compileProductionCampaign } from "./economy-scenarios.helper.js";

// Economy spec #138 slice 7: metamorphic gates over the shipped 1880 pack. Relabelling nations, permuting their order and
// scaling the money inputs together must leave the economy's outcomes unchanged (or scaled), which proves the model has no
// branch on a nation's name or position.
const MONTHS = 12;
const { state } = compileProductionCampaign();

interface MonthSummary {
  readonly treasuries: Record<string, number>;
  readonly ledger: Record<string, number[]>;
}

/** Deep-clone a value, rewriting every exact string equal to a key of `rename` (strings and Map keys alike). */
function relabel<T>(value: T, rename: ReadonlyMap<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return rename.get(v) ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v instanceof Map) return new Map([...v].map(([k, x]) => [walk(k), walk(x)]));
    if (v !== null && typeof v === "object")
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

function advance(initial: CampaignSnapshot, months: number): MonthSummary[] {
  let snapshot = initial;
  const out: MonthSummary[] = [];
  for (let i = 0; i < months; i++) {
    const result = new MonthExecutor().execute(
      snapshot,
      [],
      `economy-metamorphic:${String(snapshot.turnNumber)}`,
      new DiagnosticCollector(),
    );
    const treasuries: Record<string, number> = {};
    for (const [id, n] of result.finalSnapshot.nations) treasuries[id] = n.treasury as number;
    const ledger: Record<string, number[]> = {};
    for (const e of result.financialLedger.all)
      (ledger[`${e.nationId}:${e.categoryId}`] ??= []).push(e.debit as number, e.credit as number);
    out.push({ treasuries, ledger });
    snapshot = {
      ...result.finalSnapshot,
      turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
    };
  }
  return out;
}

describe("economy metamorphic gates", () => {
  const baseline = advance(state.snapshot, MONTHS);

  it("relabelling every nation id leaves every treasury and ledger amount unchanged", () => {
    const rename = new Map([...state.snapshot.nations.keys()].map((id) => [id, `zz_${id}`]));
    const relabelled = advance(relabel(state.snapshot, rename), MONTHS);
    const back = (id: string): string => id.replace(/^zz_/u, "");
    expect(Object.keys(baseline[0]!.treasuries)).toHaveLength(14);
    expect(Object.keys(relabelled[0]!.treasuries).every((id) => id.startsWith("zz_"))).toBe(true);
    expect(Object.keys(baseline[0]!.ledger).length).toBeGreaterThan(28);
    relabelled.forEach((month, index) => {
      expect(
        Object.fromEntries(Object.entries(month.treasuries).map(([id, v]) => [back(id), v])),
      ).toEqual(baseline[index]!.treasuries);
      expect(
        Object.fromEntries(
          Object.entries(month.ledger).map(([key, v]) => [back(key.replace(/^zz_/u, "")), v]),
        ),
      ).toEqual(baseline[index]!.ledger);
    });
  });

  it("permuting the nation order leaves the closing snapshot hash unchanged", () => {
    const reversed: CampaignSnapshot = {
      ...state.snapshot,
      nations: new Map([...state.snapshot.nations].reverse()),
    };
    const hash = (s: CampaignSnapshot): string => sha256Hex(canonicalSerialize(s));
    const run = (initial: CampaignSnapshot): string => {
      const r = new MonthExecutor().execute(
        initial,
        [],
        "economy-permute",
        new DiagnosticCollector(),
      );
      return hash(r.finalSnapshot);
    };
    expect(run(reversed)).toBe(run(state.snapshot));
  });

  it("scaling income, expenses and treasury together scales revenue and obligations", () => {
    const k = 3;
    const scaled: CampaignSnapshot = {
      ...state.snapshot,
      nations: new Map(
        [...state.snapshot.nations].map(([id, n]): [string, NationState] => [
          id,
          {
            ...n,
            treasury: SafeInt(n.treasury * k),
            income: SafeInt(n.income * k),
            expenses: SafeInt(n.expenses * k),
            baseResources: SafeInt(n.baseResources * k),
          },
        ]),
      ),
    };
    const first = new MonthExecutor().execute(
      scaled,
      [],
      "economy-scale",
      new DiagnosticCollector(),
    );
    const reference = new MonthExecutor().execute(
      state.snapshot,
      [],
      "economy-scale",
      new DiagnosticCollector(),
    );
    const total = (
      entries: typeof first.financialLedger.all,
      nationId: string,
      category: string,
      side: "debit" | "credit",
    ): number =>
      entries
        .filter((e) => e.nationId === nationId && e.categoryId === category)
        .reduce((sum, e) => sum + (e[side] as number), 0);
    for (const id of state.snapshot.nations.keys()) {
      expect(total(first.financialLedger.all, id, "NAVAL_APPROPRIATION", "credit")).toBe(
        k * total(reference.financialLedger.all, id, "NAVAL_APPROPRIATION", "credit"),
      );
      expect(total(first.financialLedger.all, id, "OBLIGATION", "debit")).toBe(
        k * total(reference.financialLedger.all, id, "OBLIGATION", "debit"),
      );
    }
  });
});
