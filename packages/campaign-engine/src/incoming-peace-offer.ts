import type { CampaignState, WarDeclaration } from "@bluewave/campaign";
import type { DiplomacyPeaceTermRef } from "./peace-offer.js";

export interface DiplomacyIncomingPeaceOffer {
  readonly proposerId: string;
  readonly term: DiplomacyPeaceTermRef;
  readonly areaName?: string;
  readonly reasonCode: string;
  readonly month: string;
}

export function incomingPeaceOfferField(
  snapshot: CampaignState["snapshot"],
  war: WarDeclaration,
  playerNationId: string,
): { readonly incomingPeaceOffer?: DiplomacyIncomingPeaceOffer } {
  if (war.status !== "ACTIVE") return {};
  const offer = snapshot.wars.peaceOffers?.find(
    (o) => o.warId === war.id && o.targetId === playerNationId,
  );
  if (offer === undefined) return {};
  const term: DiplomacyPeaceTermRef =
    offer.term._tag === "CedeArea"
      ? { _tag: "CedeArea", areaId: offer.term.areaId }
      : { _tag: "StatusQuo" };
  const areaName =
    term._tag === "CedeArea"
      ? snapshot.world.areas.find((a) => a.id === term.areaId)?.name
      : undefined;
  return {
    incomingPeaceOffer: {
      proposerId: offer.proposerId,
      term,
      ...(areaName === undefined ? {} : { areaName }),
      reasonCode: offer.reasonCode,
      month: offer.month,
    },
  };
}
