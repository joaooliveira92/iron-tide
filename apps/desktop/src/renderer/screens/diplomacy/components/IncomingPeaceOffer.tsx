import type { DiplomacyIncomingPeaceOffer } from "@bluewave/campaign-engine";
import { Handshake } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { capitalizeFirst } from "../diplomacy-presentation.js";

export interface IncomingPeaceOfferProps {
  readonly offer: DiplomacyIncomingPeaceOffer;
  readonly enemyName: string;
  readonly busy: boolean;
  readonly onAccept: () => void;
}

const REASON_COPY: Readonly<Record<string, string>> = {
  PROPOSER_TRAILS_BY_MARGIN: "is losing the war and wants it ended",
  PROPOSER_LEADS_BY_MARGIN: "is winning the war and names its price",
};

function termCopy(offer: DiplomacyIncomingPeaceOffer): string {
  if (offer.term._tag === "StatusQuo") return "Peace with every area left where it stands";
  return `Peace if you cede ${offer.areaName ?? offer.term.areaId}`;
}

export function IncomingPeaceOffer({ offer, enemyName, busy, onAccept }: IncomingPeaceOfferProps) {
  const name = capitalizeFirst(enemyName);
  return (
    <div
      role="group"
      aria-label={`Peace offer from ${name}`}
      data-testid="incoming-peace-offer"
      className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
    >
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {name} proposes peace
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            since {offer.month}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {termCopy(offer)}. {name} {REASON_COPY[offer.reasonCode] ?? "proposes these terms"}.
        </p>
      </div>
      <Button size="sm" disabled={busy} onClick={onAccept} data-testid="accept-peace-offer">
        <Handshake aria-hidden="true" className="size-3.5" />
        Accept offer
      </Button>
    </div>
  );
}
