import type { DeclineCounterEntry, PeaceOffer } from "@bluewave/campaign";

export function cloneDeclineCounters(
  entries: readonly DeclineCounterEntry[] | undefined,
): DeclineCounterEntry[] | undefined {
  return entries?.map((entry) => ({
    key: entry.key,
    nationId: entry.nationId,
    lastWarId: entry.lastWarId,
    count: entry.count,
    decayAnchorMonth: entry.decayAnchorMonth,
  }));
}

export function clonePeaceOffers(
  offers: readonly PeaceOffer[] | undefined,
): PeaceOffer[] | undefined {
  return offers?.map((offer) => ({
    warId: offer.warId,
    proposerId: offer.proposerId,
    targetId: offer.targetId,
    month: offer.month,
    term: { ...offer.term },
    reasonCode: offer.reasonCode,
  }));
}
