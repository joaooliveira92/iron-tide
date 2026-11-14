import type { DeclineCounterEntry, PeaceOffer } from "@bluewave/campaign";

function fields<T>() {
  return <U extends readonly (keyof T)[]>(
    ...keys: U &
      (Exclude<keyof T, U[number]> extends never ? unknown : never) &
      (Exclude<U[number], keyof T> extends never ? unknown : never)
  ): U => keys;
}

export const WAR_RECORD_FIELDS = {
  DeclineCounterEntry: fields<DeclineCounterEntry>()(
    "key",
    "nationId",
    "lastWarId",
    "count",
    "decayAnchorMonth",
  ),
  PeaceOffer: fields<PeaceOffer>()(
    "warId",
    "proposerId",
    "targetId",
    "month",
    "term",
    "reasonCode",
  ),
} as const;

function copyFields<T extends object>(source: T, keys: readonly (keyof T)[]): T {
  const out: Partial<T> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
  }
  return out as T;
}

export function cloneDeclineCounters(
  entries: readonly DeclineCounterEntry[] | undefined,
): DeclineCounterEntry[] | undefined {
  return entries?.map((entry) => copyFields(entry, WAR_RECORD_FIELDS.DeclineCounterEntry));
}

export function clonePeaceOffers(
  offers: readonly PeaceOffer[] | undefined,
): PeaceOffer[] | undefined {
  return offers?.map((offer) => ({
    ...copyFields(offer, WAR_RECORD_FIELDS.PeaceOffer),
    term: { ...offer.term },
  }));
}
