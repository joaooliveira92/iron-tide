import type { DeclineCounterEntry, DeclinedBattleRecord } from "./declineRecords.js";
import type { PeaceOffer } from "./peaceOffer.js";

export interface WarOptionalRecords {
  declinedBattles?: DeclinedBattleRecord[];
  declineCounters?: DeclineCounterEntry[];
  peaceOffers?: PeaceOffer[];
}
