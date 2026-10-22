import type { DeclineCounterEntry, WarDeclaration } from "@bluewave/campaign";
import type { BattleOfferRules } from "@bluewave/content-schema";

export type DeclineCounterRules = BattleOfferRules["declineCounter"];

export interface TallyInput {
  readonly rules: DeclineCounterRules;
  readonly repeatEachDecline: boolean;
  readonly warId: string;
  readonly nationId: string;
  readonly month: string;
  readonly wars: readonly Pick<WarDeclaration, "id" | "status">[];
}

export interface TallyResult {
  readonly entries: DeclineCounterEntry[];
  readonly count: number;
  readonly thresholdReached: boolean;
}

export function declineScopeKey(
  scope: DeclineCounterRules["scope"],
  warId: string,
  nationId: string,
): string {
  switch (scope) {
    case "WAR":
      return `WAR|${warId}|${nationId}`;
    case "NATION":
      return `NATION|${nationId}`;
    case "CAMPAIGN":
      return "CAMPAIGN";
  }
}

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

function monthLabel(index: number): string {
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function settled(
  entry: DeclineCounterEntry,
  input: TallyInput,
): { readonly count: number; readonly anchor: string } {
  const reset = input.rules.reset;
  switch (reset.kind) {
    case "NONE":
      return { count: entry.count, anchor: entry.decayAnchorMonth };
    case "ON_WAR_END": {
      if (entry.lastWarId === input.warId)
        return { count: entry.count, anchor: entry.decayAnchorMonth };
      const last = input.wars.find((w) => w.id === entry.lastWarId);
      return last === undefined || last.status === "ENDED"
        ? { count: 0, anchor: input.month }
        : { count: entry.count, anchor: entry.decayAnchorMonth };
    }
    case "DECAY": {
      const elapsed = monthIndex(input.month) - monthIndex(entry.decayAnchorMonth);
      const periods = elapsed > 0 ? Math.floor(elapsed / reset.perMonths) : 0;
      if (periods === 0) return { count: entry.count, anchor: entry.decayAnchorMonth };
      const count = Math.max(0, entry.count - periods * reset.countRemoved);
      return {
        count,
        anchor:
          count === 0
            ? input.month
            : monthLabel(monthIndex(entry.decayAnchorMonth) + periods * reset.perMonths),
      };
    }
  }
}

export function tallyDecline(
  entries: readonly DeclineCounterEntry[] | undefined,
  input: TallyInput,
): TallyResult {
  const key = declineScopeKey(input.rules.scope, input.warId, input.nationId);
  const existing = entries ?? [];
  const current = existing.find((e) => e.key === key);
  const before =
    current === undefined ? { count: 0, anchor: input.month } : settled(current, input);
  const anchor = before.count === 0 ? input.month : before.anchor;
  const count = before.count + 1;
  const next: DeclineCounterEntry = {
    key,
    nationId: input.nationId,
    lastWarId: input.warId,
    count,
    decayAnchorMonth: anchor,
  };
  const threshold = input.rules.threshold;
  return {
    entries:
      current === undefined ? [...existing, next] : existing.map((e) => (e.key === key ? next : e)),
    count,
    thresholdReached: count >= threshold && (before.count < threshold || input.repeatEachDecline),
  };
}
