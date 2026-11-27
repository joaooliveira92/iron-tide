import type {
  MonthlyReportNeutralWar,
  MonthlyReportRaiderEntry,
  MonthlyReportWarshipAttackEntry,
} from "../../shared/reports-contract.js";

type Slot<K extends keyof MonthlyReportRaiderEntry> =
  | NonNullable<MonthlyReportRaiderEntry[K]>
  | "NONE";

type SentenceKey =
  | `reports.trade.raider.engaged.${Slot<"encounter">}.${Slot<"outcome">}`
  | `reports.trade.raider.interned.${Slot<"cause">}`
  | `reports.trade.neutralWar.${MonthlyReportNeutralWar["role"]}`
  | `reports.trade.warshipAttack.${MonthlyReportWarshipAttackEntry["outcome"]}`;

export const TRADE_REPORT_MESSAGES = {
  "reports.trade.title": "Trade protection",
  "reports.trade.noQuota": "No trade protection quota was in force.",
  "reports.trade.quota": "Quota {quota} ships, {assigned} counted. {standing}",
  "reports.trade.met": "The quota was met.",
  "reports.trade.short": "Short by {shortfall} ships ({percent}% of the quota).",
  "reports.trade.loss": "Merchant pool fell from {before}% to {after}% ({delta}%): {causes}.",
  "reports.trade.loss.raiderHits.one": "1 raider hit",
  "reports.trade.loss.raiderHits.many": "{n} raider hits",
  "reports.trade.loss.submarineHits.one": "1 submarine hit",
  "reports.trade.loss.submarineHits.many": "{n} submarine hits",
  "reports.trade.loss.pressure": "blockade pressure",
  "reports.trade.loss.unattributed": "no single cause recorded",
  "reports.trade.raider.engaged.INTERCEPTION.SURVIVED":
    "{ship} intercepted a convoy of {nation} and survived.",
  "reports.trade.raider.engaged.INTERCEPTION.SUNK":
    "{ship} intercepted a convoy of {nation} and was sunk.",
  "reports.trade.raider.engaged.INTERCEPTION.SCUTTLED":
    "{ship} intercepted a convoy of {nation} and was scuttled.",
  "reports.trade.raider.engaged.INTERCEPTION.INTERNED":
    "{ship} intercepted a convoy of {nation} and was interned.",
  "reports.trade.raider.engaged.INTERCEPTION.NONE": "{ship} intercepted a convoy of {nation}.",
  "reports.trade.raider.engaged.BREAKOUT.SURVIVED":
    "{ship} broke out against the trade of {nation} and survived.",
  "reports.trade.raider.engaged.BREAKOUT.SUNK":
    "{ship} broke out against the trade of {nation} and was sunk.",
  "reports.trade.raider.engaged.BREAKOUT.SCUTTLED":
    "{ship} broke out against the trade of {nation} and was scuttled.",
  "reports.trade.raider.engaged.BREAKOUT.INTERNED":
    "{ship} broke out against the trade of {nation} and was interned.",
  "reports.trade.raider.engaged.BREAKOUT.NONE": "{ship} broke out against the trade of {nation}.",
  "reports.trade.raider.engaged.NONE.SURVIVED": "{ship} was engaged and survived.",
  "reports.trade.raider.engaged.NONE.SUNK": "{ship} was engaged and was sunk.",
  "reports.trade.raider.engaged.NONE.SCUTTLED": "{ship} was engaged and was scuttled.",
  "reports.trade.raider.engaged.NONE.INTERNED": "{ship} was engaged and was interned.",
  "reports.trade.raider.engaged.NONE.NONE": "{ship} was engaged.",
  "reports.trade.raider.interned.FUEL_EXHAUSTION": "{ship} was interned after running out of fuel.",
  "reports.trade.raider.interned.BREAKDOWN": "{ship} was interned after a breakdown.",
  "reports.trade.raider.interned.DAMAGE": "{ship} was interned after taking damage.",
  "reports.trade.raider.interned.NONE": "{ship} was interned.",
  "reports.trade.raider.released": "{ship} was released from internment.",
  "reports.trade.warshipAttack.DAMAGED":
    "A submarine of {nation} attacked {ship} and damaged it ({percent}%).",
  "reports.trade.warshipAttack.SUNK": "A submarine of {nation} attacked {ship} and sank it.",
  "reports.trade.neutralWar.DECLARER":
    "Unrestricted submarine incidents with {nation} reached tension {tension}, and your nation was forced into war against {nation}.",
  "reports.trade.neutralWar.TARGET":
    "{nation} declared war on your nation after unrestricted submarine incidents reached tension {tension}.",
} as const satisfies Readonly<Record<string, string>> & Record<SentenceKey, string>;
