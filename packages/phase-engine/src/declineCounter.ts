// T-1 05 (spec #109 R9, ticket #114): the declined-battle tally. Pure and integer-only: given the saved tallies and one
// recorded decline, return the new tallies, the post-decline count and whether the ruleset threshold was just reached.
// The tally scope (WAR, NATION, CAMPAIGN), its reset (NONE, ON_WAR_END) and its decay (whole periods of months) all come
// from the ruleset section; nothing here is a default. Resets and decay are applied lazily at the next decline, so a
// campaign that never declines never writes the collection and keeps its hash.
import type { DeclineCounterEntry, WarDeclaration } from "@bluewave/campaign";
import type { BattleOfferRules } from "@bluewave/content-schema";

export type DeclineCounterRules = BattleOfferRules["declineCounter"];

export interface TallyInput {
  readonly rules: DeclineCounterRules;
  /**
   * The ruleset's declared repeat rule (`EACH_FURTHER_DECLINE`): the threshold event then fires on every decline at or
   * above the threshold instead of only when the count reaches it. Absent the prestige sub-rule this is false.
   */
  readonly repeatEachDecline: boolean;
  readonly warId: string;
  readonly nationId: string;
  /** Campaign month (YYYY-MM) of the decline. */
  readonly month: string;
  readonly wars: readonly Pick<WarDeclaration, "id" | "status">[];
}

export interface TallyResult {
  readonly entries: DeclineCounterEntry[];
  /** The count after this decline (reset and decay applied first). */
  readonly count: number;
  readonly thresholdReached: boolean;
}

/** The canonical key of the tally this decline belongs to; keys of different scopes never collide. */
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

/** The entry's count and decay anchor once the ruleset's reset or decay has been applied up to `month`. */
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

/** Record one decline of the player nation. Never mutates `entries`. */
export function tallyDecline(
  entries: readonly DeclineCounterEntry[] | undefined,
  input: TallyInput,
): TallyResult {
  const key = declineScopeKey(input.rules.scope, input.warId, input.nationId);
  const existing = entries ?? [];
  const current = existing.find((e) => e.key === key);
  const before =
    current === undefined ? { count: 0, anchor: input.month } : settled(current, input);
  // A tally at zero restarts its decay clock at the month of the decline that raises it.
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
